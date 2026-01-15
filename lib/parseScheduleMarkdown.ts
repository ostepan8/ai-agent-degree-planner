/**
 * Parser utility to convert AI markdown schedule responses to structured data
 * 
 * The AI returns schedules in this format:
 * 
 * **Year 1**
 * - Fall 2025 (16 credits):
 *   - CS 1800: Discrete Structures (4)
 *   - CS 1802: Seminar for CS 1800 (1)
 * - Spring 2026 (16 credits):
 *   - CS 2510: Fundamentals of Computer Science 2 (4)
 * 
 * - **Summer 2027: Co-op 1**
 */

export interface ParsedCourse {
  code: string
  name: string
  credits: number
  options?: string  // For elective courses, contains example course options
}

export interface ParsedSemester {
  term: string
  type: 'academic' | 'coop'
  courses?: ParsedCourse[]
  coopNumber?: number
  totalCredits?: number
}

/**
 * Parse a markdown schedule string into structured semester data
 */
export function parseScheduleMarkdown(markdown: string): ParsedSemester[] {
  const semesters: ParsedSemester[] = []
  const lines = markdown.split('\n')
  
  let currentSemester: ParsedSemester | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Skip year headers (e.g., "**Year 1**")
    if (/^\*\*Year \d+\*\*/.test(line.trim())) {
      continue
    }
    
    // Check for co-op semester (e.g., "- **Summer 2027: Co-op 1**" or "**Summer/Fall 2028: Co-op 2**")
    const coopMatch = line.match(/\*\*([A-Za-z\/]+\s+\d{4}):\s*Co-op\s*(\d+)\*\*/)
    if (coopMatch) {
      // Save previous semester if exists
      if (currentSemester) {
        semesters.push(currentSemester)
      }
      
      const coopSemester: ParsedSemester = {
        term: normalizeTermName(coopMatch[1]),
        type: 'coop',
        coopNumber: parseInt(coopMatch[2], 10)
      }
      semesters.push(coopSemester)
      currentSemester = null
      continue
    }
    
    // Check for academic semester header (e.g., "- Fall 2025 (16 credits):")
    const semesterMatch = line.match(/^-\s*([A-Za-z]+\s+\d{4})\s*\((\d+)\s*credits?\):/i)
    if (semesterMatch) {
      // Save previous semester if exists
      if (currentSemester) {
        semesters.push(currentSemester)
      }
      
      currentSemester = {
        term: normalizeTermName(semesterMatch[1]),
        type: 'academic',
        courses: [],
        totalCredits: parseInt(semesterMatch[2], 10)
      }
      continue
    }
    
    // Check for course entry (e.g., "  - CS 1800: Discrete Structures (4)")
    // Also handles variations like "  - CS 2500: Fundamentals of Computer Science 1 (4)"
    const courseMatch = line.match(/^\s+-\s*([A-Z]{2,4}\s*\d{4}[A-Z]?):\s*(.+?)\s*\((\d+)\)/)
    if (courseMatch && currentSemester && currentSemester.type === 'academic') {
      const course: ParsedCourse = {
        code: courseMatch[1].trim(),
        name: courseMatch[2].trim(),
        credits: parseInt(courseMatch[3], 10)
      }
      currentSemester.courses = currentSemester.courses || []
      currentSemester.courses.push(course)
      continue
    }
    
    // Handle courses with different formats (e.g., "ENGW 1111: First-Year Writing (4)")
    const altCourseMatch = line.match(/^\s+-\s*([A-Z]{2,5}\s*\d{3,4}[A-Z]?):\s*(.+?)\s*\((\d+)\)/)
    if (altCourseMatch && currentSemester && currentSemester.type === 'academic') {
      const course: ParsedCourse = {
        code: altCourseMatch[1].trim(),
        name: altCourseMatch[2].trim(),
        credits: parseInt(altCourseMatch[3], 10)
      }
      currentSemester.courses = currentSemester.courses || []
      currentSemester.courses.push(course)
      continue
    }
    
    // Handle generic electives/placeholders (e.g., "  - General Elective or NUpath (3)")
    const genericMatch = line.match(/^\s+-\s*([^(]+)\s*\((\d+)\)\s*$/)
    if (genericMatch && currentSemester && currentSemester.type === 'academic') {
      const name = genericMatch[1].trim()
      // Skip if it looks like a duplicate course entry we already matched
      if (!name.match(/^[A-Z]{2,5}\s*\d{3,4}/)) {
        const course: ParsedCourse = {
          code: 'ELEC',
          name: name,
          credits: parseInt(genericMatch[2], 10)
        }
        currentSemester.courses = currentSemester.courses || []
        currentSemester.courses.push(course)
      }
      continue
    }
  }
  
  // Don't forget the last semester
  if (currentSemester) {
    semesters.push(currentSemester)
  }
  
  // Recalculate totalCredits for each academic semester
  for (const sem of semesters) {
    if (sem.type === 'academic' && sem.courses && sem.courses.length > 0) {
      sem.totalCredits = sem.courses.reduce((sum, c) => sum + c.credits, 0)
    }
  }
  
  return semesters
}

/**
 * Normalize term names to consistent format
 */
function normalizeTermName(term: string): string {
  // Handle combined terms like "Summer/Fall 2028"
  if (term.includes('/')) {
    // Take the first season
    const parts = term.split('/')
    const season = parts[0].trim()
    const yearMatch = term.match(/\d{4}/)
    const year = yearMatch ? yearMatch[0] : ''
    return `${capitalize(season)} ${year}`
  }
  
  const parts = term.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${capitalize(parts[0])} ${parts[1]}`
  }
  return term.trim()
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Normalize warnings to always be an array
 */
export function normalizeWarnings(warnings: string | string[] | undefined): string[] {
  if (!warnings) return []
  if (Array.isArray(warnings)) return warnings
  
  // Check if it's a stringified JSON array
  const trimmed = warnings.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Fall through to string parsing
    }
  }
  
  // If it's a string, try to split it into multiple warnings
  // Common patterns: newlines, numbered lists, bullet points
  const parts = warnings
    .split(/\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
    .filter(s => s.length > 0)
  
  return parts.length > 0 ? parts : [warnings]
}

/**
 * Normalized schedule structure
 */
export interface NormalizedSchedule {
  school: string
  major: string
  degree: string
  startTerm: string
  graduationTerm: string
  totalCredits: number
  semesters: ParsedSemester[]
  warnings: string[]
  sourceUrl: string
}

/**
 * Deduplicate courses across all semesters
 * Keeps first occurrence, removes later duplicates
 * Returns the deduplicated semesters and count of removed duplicates
 */
function deduplicateCourses(semesters: ParsedSemester[]): { 
  semesters: ParsedSemester[]
  duplicatesRemoved: number 
} {
  const seenCodes = new Set<string>()
  let duplicatesRemoved = 0
  
  const dedupedSemesters = semesters.map(semester => {
    if (semester.type !== 'academic' || !semester.courses) {
      return semester
    }
    
    const uniqueCourses: ParsedCourse[] = []
    
    for (const course of semester.courses) {
      // Normalize the code for comparison
      const normalizedCode = course.code.toUpperCase().replace(/\s+/g, ' ').trim()
      
      // IMPORTANT: Don't deduplicate ELECTIVE courses - they represent different elective slots
      // Each ELECTIVE has a unique name (e.g., "Science with Lab", "NUpath Creative Expression")
      // We should only dedupe actual course codes
      if (normalizedCode === 'ELECTIVE' || normalizedCode === 'ELEC') {
        uniqueCourses.push(course)
        continue
      }
      
      if (seenCodes.has(normalizedCode)) {
        duplicatesRemoved++
        console.log(`[Normalize] Removed duplicate: ${course.code} in ${semester.term}`)
        continue
      }
      
      seenCodes.add(normalizedCode)
      uniqueCourses.push(course)
    }
    
    // Recalculate credits after deduplication
    const totalCredits = uniqueCourses.reduce((sum, c) => sum + c.credits, 0)
    
    return {
      ...semester,
      courses: uniqueCourses,
      totalCredits,
    }
  })
  
  return { semesters: dedupedSemesters, duplicatesRemoved }
}

/**
 * Normalize an AI schedule response to a consistent structure
 * Handles:
 * - Stringified JSON arrays in semesters/warnings
 * - Markdown-formatted semesters
 * - Duplicate courses (removes them)
 * - Empty/missing totalCredits
 */
export function normalizeSchedule(schedule: Record<string, unknown>): NormalizedSchedule {
  const normalized: Record<string, unknown> = { ...schedule }
  
  // Handle stringified JSON semesters
  if (typeof normalized.semesters === 'string') {
    const trimmed = (normalized.semesters as string).trim()
    
    if (trimmed.startsWith('[')) {
      try {
        // Remove trailing comma if present (AI sometimes adds it)
        const cleaned = trimmed.replace(/,\s*$/, '')
        normalized.semesters = JSON.parse(cleaned)
      } catch {
        // Fall back to markdown parser
        normalized.semesters = parseScheduleMarkdown(trimmed)
      }
    } else {
      // It's markdown
      normalized.semesters = parseScheduleMarkdown(trimmed)
    }
  }
  
  // Normalize semester types and deduplicate courses
  if (Array.isArray(normalized.semesters)) {
    // First, normalize the type field (handle 'co-op' -> 'coop' and other variations)
    const normalizedSemesters = (normalized.semesters as ParsedSemester[]).map(sem => {
      const semType = String(sem.type || '').toLowerCase().replace(/-/g, '')
      const hasCourses = sem.courses && sem.courses.length > 0
      const hasCoopNumber = typeof sem.coopNumber === 'number'
      
      // If marked as coop but has courses, it's actually academic (AI mislabeled it)
      if (semType === 'coop') {
        if (hasCourses) {
          console.log(`[Normalize] Semester "${sem.term}" marked as co-op but has courses, correcting to academic`)
          return { ...sem, type: 'academic' as const }
        }
        return { ...sem, type: 'coop' as const }
      } else if (semType === 'academic') {
        return { ...sem, type: 'academic' as const }
      } else {
        // Unknown type - check if it has courses (academic) or coopNumber (coop)
        if (hasCourses) {
          console.log(`[Normalize] Unknown semester type "${sem.type}" with courses, treating as academic`)
          return { ...sem, type: 'academic' as const }
        } else if (hasCoopNumber) {
          console.log(`[Normalize] Unknown semester type "${sem.type}" with coopNumber, treating as coop`)
          return { ...sem, type: 'coop' as const }
        }
        // Default to academic
        console.log(`[Normalize] Unknown semester type "${sem.type}", defaulting to academic`)
        return { ...sem, type: 'academic' as const }
      }
    })
    
    const { semesters: dedupedSemesters, duplicatesRemoved } = 
      deduplicateCourses(normalizedSemesters)
    normalized.semesters = dedupedSemesters
    
    if (duplicatesRemoved > 0) {
      console.log(`[Normalize] Total duplicates removed: ${duplicatesRemoved}`)
    }
  }
  
  // Handle stringified JSON warnings
  if (typeof normalized.warnings === 'string') {
    normalized.warnings = normalizeWarnings(normalized.warnings as string)
  } else if (!normalized.warnings) {
    normalized.warnings = []
  }
  
  // Handle empty/string totalCredits
  if (!normalized.totalCredits || normalized.totalCredits === '') {
    if (Array.isArray(normalized.semesters)) {
      normalized.totalCredits = (normalized.semesters as ParsedSemester[])
        .filter(s => s.type === 'academic')
        .reduce((sum, s) => sum + (s.totalCredits || 0), 0)
    } else {
      normalized.totalCredits = 128
    }
  } else if (typeof normalized.totalCredits === 'string') {
    normalized.totalCredits = parseInt(normalized.totalCredits, 10) || 128
  }
  
  // Ensure degree exists
  if (!normalized.degree) {
    normalized.degree = 'BS'
  }
  
  return normalized as unknown as NormalizedSchedule
}

