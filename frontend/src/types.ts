export interface CodeSnippet {
  language: string
  title: string
  code: string
  explanation: string
}

export interface Flashcard {
  question: string
  answer: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

export interface StudyPack {
  title: string
  detected_languages: string[]
  subject: string
  notes_markdown: string
  code_snippets: CodeSnippet[]
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
  related_topics: string[]
  warnings: string[]
}

export interface GenerateResponse {
  study_pack: StudyPack
  model: string
  output_language: string
}

export type OutputLanguage = 'bangla' | 'english' | 'bilingual'
export type QuizDifficulty = 'easy' | 'mixed' | 'hard'
