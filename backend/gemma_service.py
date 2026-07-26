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
6. Math: write every formula in LaTeX. Use $...$ for inline math and $$...$$ on its own lines
   for displayed equations. Never write formulas as plain text or unicode symbols.
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


def _extract_json(text: str) -> dict:
    """Parse model output into a dict, tolerating fences and bad escapes."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model response contained no JSON object")
    blob = text[start : end + 1]
    try:
        return json.loads(blob)
    except json.JSONDecodeError as first_err:
        repaired = _fix_invalid_escapes(blob)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            logger.warning("JSON parse failed even after escape repair: %s", first_err)
            raise ValueError(f"Invalid JSON from model: {first_err}") from first_err


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


def _markdown_from_model(prompt: str, json_key: str, temperature: float = 0.25) -> str:
    """Ask Gemma for JSON {json_key: markdown}; fall back to raw markdown if needed."""
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
    raw = (response.text or "").strip()
    logger.info("Gemma markdown response length: %d chars", len(raw))

    if not raw:
        raise ValueError("Empty response from model")

    # Prefer structured JSON when present.
    if "{" in raw:
        try:
            data = _extract_json(raw)
            text = str(data.get(json_key, "")).strip()
            if text:
                return text
        except ValueError as err:
            logger.warning("Markdown JSON parse failed (%s); using raw text fallback", err)

    # Model sometimes ignores JSON and returns markdown / fenced markdown.
    fence = re.search(r"```(?:markdown|md)?\s*(.*?)```", raw, re.DOTALL)
    if fence:
        return fence.group(1).strip()
    return raw


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

Respond ONLY with JSON:
{{"quiz":[{{"question":"string","options":["a","b","c","d"],"correct_index":0,"explanation":"string"}}]}}
"""
    data = _text_client_call(prompt, temperature=0.4)
    return [QuizQuestion.model_validate(q) for q in data.get("quiz", [])]


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
- Write Markdown with numbered steps
- For each formula or code block: say WHAT it is, WHY it appears, and HOW to apply it
- Use LaTeX ($...$ / $$...$$) for math
- Keep short bilingual hints in Bangla where a hard idea needs grounding
- Do NOT invent content that is not in the notes or code
- End with a 3-bullet "Common mistakes" section
- Escape newlines in the JSON string as \\n and quotes as \\"
- Do NOT wrap the JSON in markdown fences

Notes:
\"\"\"
{notes_markdown[:10000]}
\"\"\"

Code / pseudocode from the board:
\"\"\"
{code_block[:4000]}
\"\"\"

Return ONLY a single JSON object (no other text):
{{"logic_markdown":"# Step 1\\n...markdown content..."}}
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
- Write Markdown
- Short sections with headings
- Use everyday Bangla examples where helpful
- Use LaTeX ($...$ / $$...$$) for formulas
- Do NOT invent content that is not in the notes
- End with a 3-bullet "মনে রাখো" summary
- Escape newlines in the JSON string as \\n and quotes as \\"
- Do NOT wrap the JSON in markdown fences

Notes:
\"\"\"
{notes_markdown[:12000]}
\"\"\"

Return ONLY a single JSON object (no other text):
{{"explanation_markdown":"# শিরোনাম\\n...markdown content..."}}
"""
    text = _markdown_from_model(prompt, "explanation_markdown", temperature=0.25)
    if not text:
        raise ValueError("Empty Bangla explanation from model")
    return text
