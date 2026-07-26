"""Gemma 4 vision service: whiteboard photo -> structured study pack."""

import json
import logging
import os
import re

from google import genai
from google.genai import types

from schemas import Flashcard, QuizQuestion, StudyPack

logger = logging.getLogger(__name__)

MODEL_ID = os.environ.get("GEMMA_MODEL", "gemma-4-26b-a4b-it")

LANGUAGE_INSTRUCTIONS = {
    "bangla": (
        "Write ALL notes, flashcards, quiz questions and explanations in clear, natural Bangla "
        "(বাংলা). Keep technical terms (e.g. loop, if-else, variable names) in English where "
        "translating them would confuse a student, but explain them in Bangla."
    ),
    "english": "Write all notes, flashcards, quiz questions and explanations in clear English.",
    "bilingual": (
        "Write notes in English but add a short Bangla (বাংলা) explanation after each major "
        "concept. Flashcard questions in English, answers in both English and Bangla."
    ),
}

SYSTEM_PROMPT = """You are BoardSnap, an expert study assistant for Bangladeshi students.
You receive a photo of a whiteboard, blackboard, or notebook page containing lecture notes.
The content may mix Bangla and English, and may include flowcharts, pseudocode, diagrams,
math, or messy handwriting.

Your job is to digitize the board into a structured study pack. Follow these rules strictly:

1. Transcribe faithfully. NEVER invent content that is not on the board.
2. If a part is illegible or you are unsure, add a note to "warnings" instead of guessing.
3. Reconstruct structure: turn arrows/flowcharts into ordered logic descriptions, fix obvious
   spelling slips, and organize content with Markdown headings.
4. Extract every code/pseudocode fragment into "code_snippets", cleaned up and runnable where
   possible (convert pseudocode to the closest real language only if the board implies one,
   otherwise keep language as "pseudocode").
5. Create 6-10 flashcards and 3-5 multiple-choice quiz questions that test the ACTUAL content
   of the board, including tracing outputs for specific inputs when code is present.
6. Math: write every formula in LaTeX on ONE line. Use $...$ for inline and $$...$$
   (on their own lines) for display equations. Examples: $0 \\le A \\le 10$, $A > 10$,
   $\\text{{count}} = \\text{{count}} + 1$. NEVER spell operators as separate letters
   (wrong: 0 l e A). NEVER put each symbol on its own line.
7. Keep "warnings" short and concrete - only genuinely illegible or ambiguous handwriting,
   one short line each. Do not add interpretation, speculation or general commentary.
8. Add 3-5 "related_topics" — concrete next topics a Bangladeshi student should study after
   this board (short English topic names).
9. {language_instruction}

Respond ONLY with a single JSON object matching this schema (no markdown fences, no prose).
JSON escaping rules (critical):
- Every backslash in code/notes MUST be written as \\\\ (e.g. \\n for newline in code, \\\\d for regex).
- Newlines inside string values must be \\n, not raw line breaks when avoidable.
- Never emit invalid escapes like \\a \\s \\c \\x — always double the backslash.

{schema}
"""

_JSON_SCHEMA_HINT = json.dumps(
    {
        "title": "string",
        "detected_languages": ["Bangla", "English"],
        "subject": "string",
        "notes_markdown": "string (full Markdown notes)",
        "code_snippets": [
            {"language": "string", "title": "string", "code": "string", "explanation": "string"}
        ],
        "flashcards": [{"question": "string", "answer": "string"}],
        "quiz": [
            {
                "question": "string",
                "options": ["a", "b", "c", "d"],
                "correct_index": 0,
                "explanation": "string",
            }
        ],
        "related_topics": ["topic 1", "topic 2", "topic 3"],
        "warnings": ["string"],
    },
    indent=2,
)


_VALID_JSON_ESCAPES = set('"\\/bfnrt')


def _fix_invalid_escapes(blob: str) -> str:
    """Turn invalid JSON escapes (e.g. \\d, \\s) into escaped backslashes."""
    out: list[str] = []
    i = 0
    n = len(blob)
    while i < n:
        ch = blob[i]
        if ch == "\\" and i + 1 < n:
            nxt = blob[i + 1]
            if nxt in _VALID_JSON_ESCAPES:
                out.append(blob[i : i + 2])
                i += 2
                continue
            if nxt == "u" and i + 5 < n and all(
                c in "0123456789abcdefABCDEF" for c in blob[i + 2 : i + 6]
            ):
                out.append(blob[i : i + 6])
                i += 6
                continue
            # Invalid escape like \d or \s in code — escape the backslash.
            out.append("\\\\")
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


# LaTeX commands whose first letter is also a valid JSON escape, so json.loads()
# silently turns e.g. "\frac" into FORMFEED + "rac". Restore the backslash.
_LATEX_CONTROL_REPAIRS: list[tuple[str, str]] = [
    (f"\x0c{tail}", f"\\f{tail}") for tail in ("rac", "orall", "lat", "box")
] + [
    (f"\x08{tail}", f"\\b{tail}")
    for tail in ("egin", "eta", "ar", "inom", "ullet", "oldsymbol", "mod", "ig")
] + [
    (f"\t{tail}", f"\\t{tail}")
    for tail in ("ext", "imes", "heta", "au", "frac", "riangle", "ilde", "op")
] + [
    (f"\r{tail}", f"\\r{tail}")
    for tail in ("ightarrow", "ight", "angle", "ho", "brack")
] + [
    (f"\n{tail}", f"\\n{tail}") for tail in ("abla", "onumber", "eq ", "u_")
]


def _repair_latex_control_chars(value: str) -> str:
    """Undo JSON escapes that ate LaTeX backslashes (\\frac, \\theta, \\rho ...)."""
    if not value:
        return value
    for broken, fixed in _LATEX_CONTROL_REPAIRS:
        if broken in value:
            value = value.replace(broken, fixed)
    return value


def _repair_tree(node):
    """Recursively repair LaTeX escapes in every string of a parsed JSON tree."""
    if isinstance(node, str):
        return _repair_latex_control_chars(node)
    if isinstance(node, list):
        return [_repair_tree(item) for item in node]
    if isinstance(node, dict):
        return {key: _repair_tree(val) for key, val in node.items()}
    return node


def _loads_first_json(blob: str):
    """Parse the first JSON value; ignore trailing junk Gemma sometimes appends."""
    decoder = json.JSONDecoder()
    obj, _end = decoder.raw_decode(blob)
    return obj


def _extract_json(text: str) -> dict:
    """Parse model output into a dict, tolerating fences, bad escapes, and trailing junk."""
    text = (text or "").strip()
    if not text:
        raise ValueError("Model response contained no JSON object")

    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()

    # Prefer object; fall back to array (e.g. bare quiz list).
    start_obj, start_arr = text.find("{"), text.find("[")
    if start_obj == -1 and start_arr == -1:
        logger.warning("No JSON brace in model output preview: %s", text[:400].replace("\n", "\\n"))
        raise ValueError("Model response contained no JSON object")

    if start_obj == -1:
        start = start_arr
    elif start_arr == -1:
        start = start_obj
    else:
        start = min(start_obj, start_arr)

    blob = text[start:]
    try:
        data = _loads_first_json(blob)
    except json.JSONDecodeError as first_err:
        repaired = _fix_invalid_escapes(blob)
        try:
            data = _loads_first_json(repaired)
        except json.JSONDecodeError:
            logger.warning(
                "JSON parse failed even after escape repair: %s | preview=%s",
                first_err,
                blob[:400].replace("\n", "\\n"),
            )
            raise ValueError(f"Invalid JSON from model: {first_err}") from first_err

    if isinstance(data, list):
        # Model sometimes returns a bare quiz/flashcard array.
        if data and isinstance(data[0], dict) and "question" in data[0] and "options" in data[0]:
            data = {"quiz": data}
        elif data and isinstance(data[0], dict) and "question" in data[0] and "answer" in data[0]:
            data = {"flashcards": data}
        else:
            raise ValueError("Model returned a JSON array, expected an object")

    if not isinstance(data, dict):
        raise ValueError(f"Model JSON must be an object, got {type(data).__name__}")

    return _repair_tree(data)


def generate_study_pack(image_bytes: bytes, mime_type: str, output_language: str) -> StudyPack:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    language_instruction = LANGUAGE_INSTRUCTIONS.get(
        output_language, LANGUAGE_INSTRUCTIONS["bilingual"]
    )
    prompt = SYSTEM_PROMPT.format(
        language_instruction=language_instruction, schema=_JSON_SCHEMA_HINT
    )

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[
            # Image must come before text for Gemma 4 multimodal requests.
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            prompt,
        ],
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
            temperature=0.2,
            response_mime_type="application/json",
        ),
    )

    raw = response.text or ""
    logger.info("Gemma raw response length: %d chars", len(raw))
    data = _extract_json(raw)
    return StudyPack.model_validate(data)


def _text_client_call(prompt: str, temperature: float = 0.3) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[prompt],
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
            temperature=temperature,
            response_mime_type="application/json",
        ),
    )
    raw = response.text or ""
    logger.info("Gemma text response length: %d chars", len(raw))
    try:
        return _extract_json(raw)
    except ValueError:
        logger.warning("JSON extract failed; raw preview: %s", raw[:400].replace("\n", "\\n"))
        raise


def _unwrap_markdown_payload(raw: str, json_key: str) -> str:
    """Return clean markdown from raw model output (plain MD or JSON wrapper)."""
    text = raw.strip()
    if not text:
        return ""

    fence = re.search(r"```(?:markdown|md|json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()

    # Proper JSON object
    if text.startswith("{") and json_key in text:
        try:
            data = _extract_json(text)
            got = str(data.get(json_key, "")).strip()
            if got:
                return got
        except ValueError:
            pass

        # Salvage broken JSON where quotes inside the markdown broke parsing.
        m = re.search(
            rf'"{re.escape(json_key)}"\s*:\s*"(.*)"\s*\}}\s*$',
            text,
            re.DOTALL,
        )
        if m:
            salvaged = (
                m.group(1)
                .replace("\\n", "\n")
                .replace("\\t", "\t")
                .replace('\\"', '"')
                .replace("\\\\", "\\")
            )
            return salvaged.strip()

        # Last resort: strip the JSON key wrapper if the model echoed it literally.
        m2 = re.search(
            rf'\{{\s*"{re.escape(json_key)}"\s*:\s*"(.*)"\s*\}}\s*$',
            text,
            re.DOTALL,
        )
        if m2:
            return (
                m2.group(1)
                .replace("\\n", "\n")
                .replace("\\t", "\t")
                .replace('\\"', '"')
                .replace("\\\\", "\\")
            ).strip()

    return text


def _markdown_from_model(prompt: str, json_key: str, temperature: float = 0.25) -> str:
    """Ask Gemma for markdown. Avoid JSON mime-type (quotes/LaTeX break it)."""
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[prompt],
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
            temperature=temperature,
        ),
    )
    raw = (response.text or "").strip()
    logger.info("Gemma markdown response length: %d chars", len(raw))
    if not raw:
        raise ValueError("Empty response from model")

    text = _unwrap_markdown_payload(raw, json_key)
    if not text:
        raise ValueError("Empty markdown from model")
    # If unwrap somehow still left a JSON envelope, strip a leading key line.
    if text.lstrip().startswith("{") and json_key in text[:80]:
        text = _unwrap_markdown_payload(text, json_key)
    return _repair_latex_control_chars(text)


def generate_more_quiz(
    notes_markdown: str,
    existing_questions: list[str],
    count: int = 5,
    difficulty: str = "mixed",
) -> list[QuizQuestion]:
    existing = "\n".join(f"- {q}" for q in existing_questions) or "- (none)"
    prompt = f"""You are BoardSnap. Based ONLY on the study notes below, create {count} NEW
multiple-choice quiz questions for a Bangladeshi student.

Difficulty: {difficulty}
- easy = basic recall / definitions
- mixed = mix of recall and application
- hard = tracing formulas, comparing ideas, applying concepts

Do NOT repeat any of these existing questions:
{existing}

Rules:
- Exactly 4 options per question
- correct_index is 0-based
- Include a short explanation for each answer
- Stay faithful to the notes — do not invent unrelated topics
- Use LaTeX ($...$) for any math

Notes:
\"\"\"
{notes_markdown[:12000]}
\"\"\"

Respond with EXACTLY one JSON object and nothing else (no markdown, no second object, no prose):
{{"quiz":[{{"question":"string","options":["a","b","c","d"],"correct_index":0,"explanation":"string"}}]}}
Inside strings, escape every double-quote as \\" and every backslash as \\\\.
"""
    data = _text_client_call(prompt, temperature=0.4)
    quiz = data.get("quiz") or data.get("questions") or []
    if not isinstance(quiz, list):
        raise ValueError("Model did not return a quiz array")
    return [QuizQuestion.model_validate(q) for q in quiz]


def explain_step_by_step(
    notes_markdown: str,
    title: str = "",
    code_snippets: list[str] | None = None,
) -> str:
    code_block = "\n\n".join(code_snippets or []) or "(no code snippets)"
    prompt = f"""You are a Smart Tutor for Bangladeshi university / HSC students.
Walk through the lecture notes step by step — especially any math derivations,
algorithms, flowcharts, or code logic. Teach like a careful teacher at a whiteboard.

Title: {title or "Lecture notes"}

Rules:
- Respond with Markdown ONLY (no JSON, no code fences around the whole answer)
- Use numbered steps
- For each formula or code block: say WHAT it is, WHY it appears, and HOW to apply it
- Write ALL math in LaTeX with dollar signs, e.g. $0 \\le A \\le 10$ or $$count = count + 1$$
- Never write Greek/operators letter-by-letter (wrong: 0 l e A). Always use LaTeX.
- Keep short bilingual hints in Bangla where a hard idea needs grounding
- Do NOT invent content that is not in the notes or code
- End with a 3-bullet "Common mistakes" section

Notes:
\"\"\"
{notes_markdown[:10000]}
\"\"\"

Code / pseudocode from the board:
\"\"\"
{code_block[:4000]}
\"\"\"
"""
    text = _markdown_from_model(prompt, "logic_markdown", temperature=0.25)
    if not text:
        raise ValueError("Empty step-by-step logic from model")
    return text


def generate_more_flashcards(
    notes_markdown: str,
    existing_questions: list[str],
    count: int = 5,
    difficulty: str = "hard",
) -> list[Flashcard]:
    existing = "\n".join(f"- {q}" for q in existing_questions) or "- (none)"
    prompt = f"""You are BoardSnap. Based ONLY on the study notes below, create {count} NEW
flashcards for a Bangladeshi student.

Difficulty: {difficulty}
- mixed = definitions + short applications
- hard = multi-step reasoning, formula tracing, "why" / "compare" / "what if" prompts

Do NOT repeat any of these existing flashcard questions:
{existing}

Rules:
- question + answer pairs only
- Answers should be concise but complete (2-4 sentences max, or a short formula)
- Stay faithful to the notes — do not invent unrelated topics
- Use LaTeX ($...$) for any math

Notes:
\"\"\"
{notes_markdown[:12000]}
\"\"\"

Respond ONLY with JSON:
{{"flashcards":[{{"question":"string","answer":"string"}}]}}
"""
    data = _text_client_call(prompt, temperature=0.4)
    return [Flashcard.model_validate(c) for c in data.get("flashcards", [])]


def explain_in_simple_bangla(notes_markdown: str, title: str = "") -> str:
    prompt = f"""You are a patient tutor for Bangladeshi students (HSC / early university).
Explain the study notes below in very simple, clear Bangla (বাংলা) so a rural student can
understand. Keep essential English technical terms, but explain each one in Bangla.

Title: {title or "Lecture notes"}

Rules:
- Respond with Markdown ONLY (no JSON, no code fences around the whole answer)
- Short sections with headings
- Use everyday Bangla examples where helpful
- Write ALL math in LaTeX with dollar signs, e.g. $0 \\le A \\le 10$
- Never write operators letter-by-letter
- Do NOT invent content that is not in the notes
- End with a 3-bullet "মনে রাখো" summary

Notes:
\"\"\"
{notes_markdown[:12000]}
\"\"\"
"""
    text = _markdown_from_model(prompt, "explanation_markdown", temperature=0.25)
    if not text:
        raise ValueError("Empty Bangla explanation from model")
    return text
