"""BoardSnap - FastAPI backend.

Serves the API and, in production, the built React frontend.
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from gemma_service import (  # noqa: E402
    MODEL_ID,
    explain_in_simple_bangla,
    explain_step_by_step,
    generate_more_flashcards,
    generate_more_quiz,
    generate_study_pack,
)
from schemas import (  # noqa: E402
    ExplainRequest,
    ExplainResponse,
    GenerateResponse,
    MoreFlashcardsRequest,
    MoreFlashcardsResponse,
    MoreQuizRequest,
    MoreQuizResponse,
    StepLogicRequest,
    StepLogicResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="BoardSnap", description="Whiteboard to Interactive Study Guide, powered by Gemma 4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def _require_api_key() -> None:
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(500, "GEMINI_API_KEY is not configured on the server")


@app.api_route("/api/health", methods=["GET", "HEAD"])
def health() -> dict:
    """UptimeRobot / Render health probe — supports GET and HEAD."""
    return {"status": "ok", "model": MODEL_ID, "api_key_configured": bool(os.environ.get("GEMINI_API_KEY"))}


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(
    image: UploadFile = File(...),
    output_language: str = Form("bilingual"),
) -> GenerateResponse:
    _require_api_key()

    mime = image.content_type or ""
    if mime not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported image type '{mime}'. Use JPEG, PNG or WebP.")

    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Image too large (max 10 MB)")

    try:
        pack = generate_study_pack(data, mime, output_language)
    except Exception as exc:
        logger.exception("Study pack generation failed")
        raise HTTPException(502, f"Gemma generation failed: {exc}") from exc

    return GenerateResponse(study_pack=pack, model=MODEL_ID, output_language=output_language)


@app.post("/api/more-quiz", response_model=MoreQuizResponse)
def more_quiz(body: MoreQuizRequest) -> MoreQuizResponse:
    _require_api_key()
    try:
        quiz = generate_more_quiz(
            notes_markdown=body.notes_markdown,
            existing_questions=body.existing_questions,
            count=body.count,
            difficulty=body.difficulty,
        )
    except Exception as exc:
        logger.exception("More quiz generation failed")
        raise HTTPException(502, f"Gemma generation failed: {exc}") from exc
    return MoreQuizResponse(quiz=quiz, model=MODEL_ID)


@app.post("/api/explain-bangla", response_model=ExplainResponse)
def explain_bangla(body: ExplainRequest) -> ExplainResponse:
    _require_api_key()
    try:
        text = explain_in_simple_bangla(body.notes_markdown, body.title)
    except Exception as exc:
        logger.exception("Bangla explanation failed")
        raise HTTPException(502, f"Gemma generation failed: {exc}") from exc
    return ExplainResponse(explanation_markdown=text, model=MODEL_ID)


@app.post("/api/step-logic", response_model=StepLogicResponse)
def step_logic(body: StepLogicRequest) -> StepLogicResponse:
    _require_api_key()
    try:
        text = explain_step_by_step(body.notes_markdown, body.title, body.code_snippets)
    except Exception as exc:
        logger.exception("Step-by-step logic failed")
        raise HTTPException(502, f"Gemma generation failed: {exc}") from exc
    return StepLogicResponse(logic_markdown=text, model=MODEL_ID)


@app.post("/api/more-flashcards", response_model=MoreFlashcardsResponse)
def more_flashcards(body: MoreFlashcardsRequest) -> MoreFlashcardsResponse:
    _require_api_key()
    try:
        cards = generate_more_flashcards(
            notes_markdown=body.notes_markdown,
            existing_questions=body.existing_questions,
            count=body.count,
            difficulty=body.difficulty,
        )
    except Exception as exc:
        logger.exception("More flashcards generation failed")
        raise HTTPException(502, f"Gemma generation failed: {exc}") from exc
    return MoreFlashcardsResponse(flashcards=cards, model=MODEL_ID)


# Serve the built frontend if present (production / Docker).
# Registered last so /api/* routes always win.
_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _dist.is_dir():
    _assets = _dist / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(_dist / "index.html")

    @app.get("/{full_path:path}")
    def spa(full_path: str) -> FileResponse:
        # Never let the SPA catch API paths if routing order changes.
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = _dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")
