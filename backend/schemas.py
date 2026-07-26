"""Pydantic schemas for the BoardSnap study pack pipeline."""

from pydantic import BaseModel, Field


class CodeSnippet(BaseModel):
    language: str = Field(description="Programming language, e.g. python, c, pseudocode")
    title: str = Field(description="Short title for the snippet")
    code: str = Field(description="The runnable / cleaned-up code")
    explanation: str = Field(default="", description="One-line explanation of what the code does")


class Flashcard(BaseModel):
    question: str
    answer: str


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=2, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str = ""


class StudyPack(BaseModel):
    title: str = Field(description="Short descriptive title of the board content")
    detected_languages: list[str] = Field(description="Human languages detected, e.g. ['Bangla', 'English']")
    subject: str = Field(default="", description="Detected subject, e.g. 'Computer Science - Control Flow'")
    notes_markdown: str = Field(description="Clean structured Markdown reconstruction of the board")
    code_snippets: list[CodeSnippet] = Field(default_factory=list)
    flashcards: list[Flashcard] = Field(default_factory=list)
    quiz: list[QuizQuestion] = Field(default_factory=list)
    related_topics: list[str] = Field(
        default_factory=list,
        description="3-5 related topics the student should study next",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Illegible or uncertain parts of the board; never silently invent content",
    )


class GenerateResponse(BaseModel):
    study_pack: StudyPack
    model: str
    output_language: str


class MoreQuizRequest(BaseModel):
    notes_markdown: str
    existing_questions: list[str] = Field(default_factory=list)
    count: int = Field(default=5, ge=1, le=8)
    difficulty: str = Field(default="mixed")  # easy | mixed | hard


class MoreQuizResponse(BaseModel):
    quiz: list[QuizQuestion]
    model: str


class ExplainRequest(BaseModel):
    notes_markdown: str
    title: str = ""


class ExplainResponse(BaseModel):
    explanation_markdown: str
    model: str


class StepLogicRequest(BaseModel):
    notes_markdown: str
    title: str = ""
    code_snippets: list[str] = Field(default_factory=list)


class StepLogicResponse(BaseModel):
    logic_markdown: str
    model: str


class MoreFlashcardsRequest(BaseModel):
    notes_markdown: str
    existing_questions: list[str] = Field(default_factory=list)
    count: int = Field(default=5, ge=1, le=8)
    difficulty: str = Field(default="hard")  # mixed | hard


class MoreFlashcardsResponse(BaseModel):
    flashcards: list[Flashcard]
    model: str
