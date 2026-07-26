"""Generate BoardSnap architecture & user-flow diagrams as PNG images.

Run:  .venv/bin/python docs/make_diagrams.py
Outputs: docs/architecture.png, docs/user-flow.png
"""

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

# ---------------------------------------------------------------- palette
BG = "#ffffff"
INK = "#0f172a"          # slate-900
MUTED = "#64748b"        # slate-500
BLUE = "#eff6ff"         # layer fill
BLUE_EDGE = "#3b82f6"
VIOLET = "#f5f3ff"
VIOLET_EDGE = "#7c3aed"
GREEN = "#ecfdf5"
GREEN_EDGE = "#10b981"
AMBER = "#fffbeb"
AMBER_EDGE = "#f59e0b"
GRAY = "#f8fafc"
GRAY_EDGE = "#94a3b8"

plt.rcParams["font.family"] = "DejaVu Sans"


def box(ax, x, y, w, h, fill, edge, lw=1.6, r=1.6):
    ax.add_patch(
        FancyBboxPatch(
            (x, y), w, h,
            boxstyle=f"round,pad=0,rounding_size={r}",
            facecolor=fill, edgecolor=edge, linewidth=lw, zorder=2,
        )
    )


def arrow(ax, x0, y0, x1, y1, label="", color=MUTED, lw=2.2, label_dx=1.2):
    ax.add_patch(
        FancyArrowPatch(
            (x0, y0), (x1, y1),
            arrowstyle="-|>", mutation_scale=16,
            linewidth=lw, color=color, zorder=3,
        )
    )
    if label:
        ax.text(
            x0 + label_dx, (y0 + y1) / 2, label,
            fontsize=8.6, color=MUTED, style="italic",
            ha="left", va="center", zorder=4,
        )


def title_text(ax, x, y, s, size=11.5, color=INK, weight="bold", ha="left"):
    ax.text(x, y, s, fontsize=size, color=color, fontweight=weight, ha=ha, va="top", zorder=4)


def body_text(ax, x, y, s, size=8.8, color=INK, ha="left"):
    ax.text(x, y, s, fontsize=size, color=color, ha=ha, va="top", zorder=4, linespacing=1.55)


def tag(ax, x, y, s, edge, fill):
    ax.text(
        x, y, s, fontsize=7.6, color=edge, fontweight="bold",
        ha="left", va="center", zorder=4,
        bbox=dict(boxstyle="round,pad=0.35", facecolor=fill, edgecolor=edge, linewidth=1.1),
    )


# ================================================================ ARCHITECTURE
fig, ax = plt.subplots(figsize=(12.2, 15.2), dpi=200)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 100)
ax.set_ylim(0, 152)
ax.axis("off")

# ---- header
ax.text(50, 150.5, "BoardSnap — Technical Architecture", fontsize=19, fontweight="bold",
        color=INK, ha="center", va="top")
ax.text(50, 146.6, "Whiteboard photo  \u2192  Gemma 4 vision  \u2192  Interactive study pack   ·   Build With Gemma @Bangladesh · Multimodal Track",
        fontsize=9.5, color=MUTED, ha="center", va="top")

CX, W, LX = 50, 76, 12  # center x, box width, left x

# ---- 1. input
box(ax, LX, 132, W, 10.5, GRAY, GRAY_EDGE)
title_text(ax, LX + 3, 140.6, "1 · INPUT — Student's phone camera", size=10.5)
body_text(ax, LX + 3, 137.4,
          "One photo of a whiteboard / blackboard / notebook page  ·  JPG, PNG or WebP (max 10 MB)\n"
          "Mixed Bangla + English handwriting, flowcharts, pseudocode, math, diagrams")

arrow(ax, CX, 132, CX, 128.2, "  upload")

# ---- 2. frontend
box(ax, LX, 117, W, 11, BLUE, BLUE_EDGE)
title_text(ax, LX + 3, 125.6, "2 · FRONTEND — React 19 + Vite + Tailwind CSS", size=10.5, color="#1d4ed8")
body_text(ax, LX + 3, 122.4,
          "Drag-and-drop upload zone with preview  ·  Output-language selector: Bangla / English / Bilingual\n"
          "Single-page app, phone-browser friendly  ·  KaTeX math rendering  ·  Print / PDF export")

arrow(ax, CX, 117, CX, 113.2, "  HTTPS multipart  ·  POST /api/generate")

# ---- 3. backend
box(ax, LX, 100, W, 13, BLUE, BLUE_EDGE)
title_text(ax, LX + 3, 110.6, "3 · BACKEND — FastAPI (Python 3.13)", size=10.5, color="#1d4ed8")
body_text(ax, LX + 3, 107.4,
          "Validates MIME type + size, then orchestrates the Gemma pipeline\n"
          "Endpoints:  /api/generate   /api/explain-bangla   /api/step-logic   /api/more-quiz\n"
          "                  /api/more-flashcards   /api/health        ·        Serves the built SPA in production")

arrow(ax, CX, 100, CX, 97.2, "  image bytes + strict JSON-schema prompt (image part FIRST)")

# ---- 4. gemma core (highlight)
box(ax, LX - 2, 71.5, W + 4, 25.2, VIOLET, VIOLET_EDGE, lw=2.6, r=2)
title_text(ax, LX + 1.4, 94.8, "4 · GEMMA 4 CORE — gemma-4-26b-a4b-it  (vision, MoE ~4B active)", size=11.5, color=VIOLET_EDGE)
body_text(ax, LX + 1.4, 91.2,
          "Called via Google Gemini API  ·  swappable to gemma-4-31b-it with one env var (GEMMA_MODEL)\n\n"
          "Prompt engineering that makes it work:\n"
          "   \u2022  Image placed BEFORE text — required for Gemma 4 multimodal requests\n"
          "   \u2022  Strict JSON schema embedded in the prompt  ·  response_mime_type = application/json\n"
          "   \u2022  Honest-OCR rules: transcribe faithfully, NEVER invent; illegible parts \u2192 \"warnings\"\n"
          "   \u2022  Flowcharts/arrows reconstructed as ordered logic  ·  all math emitted as LaTeX\n"
          "   \u2022  thinking = MINIMAL, temperature = 0.2  \u2192  fast, deterministic, cheap")

arrow(ax, CX, 71.5, CX, 67.7, "  raw JSON study pack")

# ---- 5. post-processing
box(ax, LX, 54, W, 13.2, AMBER, AMBER_EDGE)
title_text(ax, LX + 3, 64.8, "5 · ROBUST POST-PROCESSING — trust nothing, validate everything", size=10.5, color="#b45309")
body_text(ax, LX + 3, 61.6,
          "Fence-tolerant JSON extraction  \u2192  invalid-escape repair (\\d, \\s in code)  \u2192  LaTeX\n"
          "backslash restore (\\frac, \\theta, \\rho eaten by JSON escapes)  \u2192  Pydantic \"StudyPack\"\n"
          "schema validation. Malformed model output is repaired or rejected — never shown broken.")

arrow(ax, CX, 54, CX, 50.2, "  validated StudyPack")

# ---- 6. study pack output (4 cards)
box(ax, LX - 2, 28.5, W + 4, 21.5, GREEN, GREEN_EDGE, lw=2.2, r=2)
title_text(ax, LX + 1.4, 48.4, "6 · INTERACTIVE STUDY PACK — the student's workspace", size=11, color="#047857")

cards = [
    ("Clean Notes", "Structured Markdown\n+ LaTeX math\nflowcharts \u2192 logic"),
    ("Code", "Extracted & cleaned\nsnippets with\nexplanations"),
    ("Flashcards", "6\u201310 flip cards\n+ \"more cards\"\non demand"),
    ("Quiz", "MCQs with instant\nscoring + harder\nquestions on demand"),
]
cw = (W + 4 - 5 * 2.2) / 4
for i, (t, d) in enumerate(cards):
    cx0 = LX - 2 + 2.2 + i * (cw + 2.2)
    box(ax, cx0, 35.2, cw, 10.4, "#ffffff", GREEN_EDGE, lw=1.3)
    ax.text(cx0 + cw / 2, 43.9, t, fontsize=9.2, fontweight="bold", color="#047857",
            ha="center", va="top", zorder=4)
    ax.text(cx0 + cw / 2, 41.6, d, fontsize=7.6, color=INK, ha="center", va="top",
            zorder=4, linespacing=1.5)

body_text(ax, LX + 1.4, 33.7,
          "Smart Tutor extras:  Easy-Bangla explainer  ·  Step-by-step logic walkthrough  ·  Related topics\n"
          "Honest-OCR warnings panel (illegible parts flagged, never silently invented)  ·  Print / PDF")

# ---- deployment strip
box(ax, LX - 2, 18.5, W + 4, 7.5, GRAY, GRAY_EDGE)
title_text(ax, LX + 1.4, 24.4, "DEPLOYMENT", size=9.5, color=MUTED)
body_text(ax, LX + 15, 24.2,
          "Single Docker image (multi-stage: Node build \u2192 Python runtime)  ·  Render free tier via render.yaml\n"
          "Health check /api/health  ·  Only secret needed: GEMINI_API_KEY",
          size=8.4)

# ---- language note strip
box(ax, LX - 2, 9.5, W + 4, 7.2, GRAY, GRAY_EDGE)
title_text(ax, LX + 1.4, 15.4, "BUILT FOR\nBANGLADESH", size=9.5, color=MUTED)
body_text(ax, LX + 15, 15.2,
          "Bilingual Bangla+English boards handled natively  ·  works from any phone browser, no app install\n"
          "One photo replaces manual note-typing  ·  output language chosen by the student",
          size=8.4)

ax.text(50, 5.5, "github.com/nomancsediu/BoardSnap", fontsize=9, color=MUTED, ha="center", va="top")

fig.savefig("/home/abdullah/kaggle/chalkos-bd/docs/architecture.png",
            bbox_inches="tight", pad_inches=0.35, facecolor=BG)
plt.close(fig)
print("architecture.png written")

# ================================================================ USER FLOW
fig, ax = plt.subplots(figsize=(14, 4.6), dpi=200)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 140)
ax.set_ylim(0, 46)
ax.axis("off")

ax.text(70, 44.5, "BoardSnap — User Flow", fontsize=16, fontweight="bold", color=INK,
        ha="center", va="top")

steps = [
    ("1 · Snap", "Photograph the messy\nBangla + English\nwhiteboard in class", GRAY, GRAY_EDGE),
    ("2 · Upload", "Drop the photo in the\nweb app, pick output\nlanguage (Bn / En / Both)", BLUE, BLUE_EDGE),
    ("3 · Gemma 4", "Vision model digitizes,\nstructures & generates\nthe full study pack", VIOLET, VIOLET_EDGE),
    ("4 · Study", "Notes · Code · Flashcards\n· Quiz — with warnings\nfor illegible parts", GREEN, GREEN_EDGE),
    ("5 · Revise", "Ask Easy Bangla / step\nlogic, add harder quiz,\nprint or save as PDF", GREEN, GREEN_EDGE),
]
sw, gap, y0, sh = 24, 4.5, 12, 22
x = 2.5
for i, (t, d, fill, edge) in enumerate(steps):
    box(ax, x, y0, sw, sh, fill, edge, lw=1.8, r=1.8)
    ax.text(x + sw / 2, y0 + sh - 3, t, fontsize=11, fontweight="bold", color=INK,
            ha="center", va="top", zorder=4)
    ax.text(x + sw / 2, y0 + sh - 8.6, d, fontsize=8.2, color=INK, ha="center", va="top",
            zorder=4, linespacing=1.6)
    if i < len(steps) - 1:
        ax.add_patch(FancyArrowPatch(
            (x + sw + 0.6, y0 + sh / 2), (x + sw + gap - 0.6, y0 + sh / 2),
            arrowstyle="-|>", mutation_scale=18, linewidth=2.4, color=MUTED, zorder=3))
    x += sw + gap

ax.text(70, 7, "~20 seconds from photo to study pack  ·  works on any phone browser  ·  no typing, no app install",
        fontsize=9.5, color=MUTED, ha="center", va="top", style="italic")

fig.savefig("/home/abdullah/kaggle/chalkos-bd/docs/user-flow.png",
            bbox_inches="tight", pad_inches=0.3, facecolor=BG)
plt.close(fig)
print("user-flow.png written")
