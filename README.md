# BoardSnap — Whiteboard to Interactive Study Guide

**Build With Gemma @Bangladesh · Multimodal Track**

Snap a photo of a messy, multilingual (Bangla + English) whiteboard — BoardSnap uses
**Gemma 4 vision** (`gemma-4-26b-a4b-it`) to digitize it into an interactive study pack:

- **Clean Notes** — structured Markdown reconstruction of the board (flowcharts become ordered logic)
- **Code** — extracted, cleaned-up code / pseudocode snippets with explanations
- **Flashcards** — 6–10 flip cards testing the actual board content
- **Quiz** — multiple-choice questions with instant scoring
- **Honest OCR** — illegible parts go to a *warnings* panel instead of being silently invented

Output language is selectable: **বাংলা / English / Bilingual**.

## Why this matters in Bangladesh

Classrooms and coaching centers rely heavily on whiteboards mixing Bangla and English.
Students photograph boards but the photos are hard to revise from. BoardSnap turns one
photo into revision-ready material — no typing, works from any phone browser.

## Architecture

```
Whiteboard photo (JPG/PNG/WebP)
        │
        ▼
React frontend (Vite + Tailwind) ──► FastAPI /api/generate
                                          │
                                          ▼
                              Gemma 4 (gemma-4-26b-a4b-it)
                              via Gemini API — image + strict
                              JSON-schema prompt, thinking=MINIMAL
                                          │
                                          ▼
                              Pydantic validation (StudyPack)
                                          │
                                          ▼
                    Interactive workspace: Notes / Code / Cards / Quiz
```

- **Model:** `gemma-4-26b-a4b-it` (MoE, ~4B active params) — fast, cheap, vision-capable.
  Swap to `gemma-4-31b-it` via the `GEMMA_MODEL` env var.
- **Key prompt rules:** transcribe faithfully, never invent content, report illegible
  regions as warnings, image part placed before text (required by Gemma 4 multimodal).

## Run locally

```bash
# 1. API key (https://aistudio.google.com/apikey)
cp .env.example .env   # then paste your GEMINI_API_KEY

# 2. Backend
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt

# 3. Frontend
cd frontend && npm install && npm run build && cd ..

# 4. Serve (FastAPI serves both API and the built frontend)
cd backend && ../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000

### Development mode (hot reload)

```bash
# terminal 1
cd backend && ../.venv/bin/uvicorn main:app --reload
# terminal 2
cd frontend && npm run dev   # http://localhost:5173, proxies /api to :8000
```

## Docker

```bash
docker build -t boardsnap .
docker run -p 8000:8000 -e GEMINI_API_KEY=your-key boardsnap
```

## API

- `GET /api/health` — model + key status
- `POST /api/generate` — multipart form: `image` (file), `output_language` (`bangla` | `english` | `bilingual`)

## Limitations & future work

- Very low-light or extreme-angle photos reduce OCR accuracy (warnings panel mitigates this)
- Handwritten Bangla diacritics are occasionally misread — a fine-tuned Gemma variant on
  Bangla handwriting is the natural next step
- Planned: spaced-repetition export (Anki), offline on-device mode with Gemma 4 E4B
