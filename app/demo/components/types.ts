import type { School, SchedulePlan, CompletedCourse, Preferences } from '@/lib/schemas'

export type Step = 'school-select' | 'major-select' | 'transcript' | 'confirm-courses' | 'preferences' | 'generating' | 'schedule'

export interface AgentLogEntry {
    time: string
    message: string
}

export interface AgentThought {
    id: number
    text: string
    isComplete: boolean
}

// Type for grouped academic years
export interface AcademicYearGroup {
    year: string
    academicYear: string
    semesters: SemesterItem[]
    totalCredits: number
    hasCoOp: boolean
}

export type SemesterItem = {
    term: string
    type: 'academic' | 'coop' | 'co-op'  // Handle both coop spellings from AI
    courses?: Array<{ code: string; name: string; credits: number; options?: string }>
    coopNumber?: number
    totalCredits?: number
    status?: 'completed' | 'planned'
}

// Helper to check if a semester is a co-op (handles both spellings)
export const isCoopSemester = (sem: SemesterItem): boolean => {
    return sem.type === 'coop' || sem.type === 'co-op'
}

// Transfer credit type
export interface TransferCredit {
    code: string
    name: string
    credits: number
    grade?: string
}

// Extended schedule type with transfer credits
export interface ExtendedSchedulePlan extends SchedulePlan {
    transferCredits?: TransferCredit[]
}

// Dragging state type
export interface DragState {
    courseCode: string
    courseName: string
    credits: number
    options?: string
    fromSemester: string
    fromIndex: number
}

// Semester dragging state type
export interface SemesterDragState {
    term: string
    type: 'academic' | 'coop'
}

// Course with delete confirmation state
export interface CourseDeleteState {
    [key: string]: boolean // key is "semesterTerm-courseCode"
}

// Chat message type
export interface ChatMessage {
    id: number
    role: 'user' | 'assistant'
    content: string
    thoughts?: string[]
    timestamp: Date
    isError?: boolean
    originalRequest?: string
}

// Study abroad state
export interface StudyAbroadState {
    planned: boolean
    term?: string
}

// Re-export types from schemas for convenience
export type { School, SchedulePlan, CompletedCourse, Preferences }
