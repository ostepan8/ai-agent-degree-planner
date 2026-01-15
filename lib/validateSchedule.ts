/**
 * Schedule validation and deduplication utilities
 * 
 * This module provides post-processing for AI-generated schedules to ensure:
 * - No duplicate courses across semesters
 * - No placeholder/generic course names
 * - Valid credit totals
 * - Quality warnings for any issues detected
 */

import type { ParsedSemester, ParsedCourse, NormalizedSchedule } from './parseScheduleMarkdown'

// Patterns that indicate a placeholder course (not a real catalog course)
const PLACEHOLDER_PATTERNS = [
  /\(placeholder\)/i,           // Matches "(Placeholder)" anywhere in name
  /placeholder/i,               // Matches "placeholder" anywhere in name
  /\(tbd\)/i,                   // Matches "(TBD)" anywhere in name
  /^general\s*elective$/i,
  /^free\s*elective$/i,
  /^elective$/i,
  /^concentration\s*(course|elective)?$/i,
  /^khoury\s*elective/i,
  /^major\s*elective/i,
  /^technical\s*elective/i,
  /^science\s*requirement/i,
  /^lab\s*science/i,
  /^nupath/i,
  /^tbd$/i,
  /^\s*$/,
]

const PLACEHOLDER_CODES = [
  'ELEC',
  'TBD',
  'XXX',
  'GENERAL',
  'SCIENCE',
]

export interface ValidationResult {
  schedule: NormalizedSchedule
  issues: ValidationIssue[]
  stats: ValidationStats
}

export interface ValidationIssue {
  type: 'duplicate' | 'placeholder' | 'credit_mismatch' | 'missing_data' | 'full_time_violation' | 'credit_overage' | 'credit_underage' | 'invalid_code' | 'discontinued_course' | 'excessive_electives'
  severity: 'error' | 'warning'
  message: string
  semester?: string
  course?: string
}

export interface ValidationOptions {
  schoolId?: string  // Used to check for school-specific discontinued courses
  trimExcessCredits?: boolean  // If true, remove excess electives to match degree requirement
  targetCredits?: number  // Override target credits (otherwise uses schedule.totalCredits)
}

export interface ValidationStats {
  totalCourses: number
  duplicatesRemoved: number
  placeholdersFound: number
  creditMismatches: number
  fullTimeViolations: number
  creditOverages: number
  creditUnderages: number
  invalidCodes: number
  discontinuedCourses: number
  totalCreditsExceeded: boolean
  mainCourseThreshold: number  // The dynamically calculated threshold
  electivesTrimmed: number  // Number of electives removed to meet credit target
  targetCredits: number  // The target credits used for validation
  actualCredits: number  // Actual credits before trimming
  electiveCount: number  // Number of ELECTIVE slots in schedule
  specificCourseCount: number  // Number of courses with specific codes
}

/**
 * Check if a course name appears to be a placeholder
 */
function isPlaceholderCourse(course: ParsedCourse): boolean {
  // Check name against patterns
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(course.name)) {
      return true
    }
  }
  
  // Check code against placeholder codes
  const codePrefix = course.code.split(/\s+/)[0]?.toUpperCase()
  if (PLACEHOLDER_CODES.includes(codePrefix)) {
    return true
  }
  
  // Check if code matches name exactly (usually indicates placeholder)
  if (course.code.toLowerCase().replace(/\s+/g, '') === 
      course.name.toLowerCase().replace(/\s+/g, '')) {
    return true
  }
  
  return false
}

// Validation thresholds
const MIN_MAIN_COURSES = 4  // Minimum 4 main courses (3-4 credits each, labs don't count)
const MIN_CREDITS = 16      // Minimum 16 credits for full-time (4 main courses)
const MIN_CREDITS_FINAL = 12  // Final semester can be lighter
const MAX_CREDITS = 21      // Maximum credits per semester (some programs need 21)
const MAX_TOTAL_CREDITS = 160  // Flexible max - some degrees require 150+ credits

// Course code validation - matches patterns like "CS 2500", "MATH 1341", "PHYS 1151"
const COURSE_CODE_REGEX = /^[A-Z]{2,5}\s*\d{3,4}[A-Z]?$/

function isValidCourseCode(code: string): boolean {
  return COURSE_CODE_REGEX.test(code)
}

/**
 * Known discontinued courses by school
 * These courses existed in previous catalogs but have been replaced starting Fall 2025
 */
const DISCONTINUED_COURSES: Record<string, string[]> = {
  northeastern: [
    'CS 2500',  // Fundies 1 - REPLACED by CS 2000 + CS 2001
    'CS 2510',  // Fundies 2 - REPLACED by CS 2100 + CS 2101
    'CS 2511',  // Lab for Fundies 2 - REPLACED by CS 2101
    'CS 3500',  // Object-Oriented Design - REPLACED by CS 3100 + CS 3101
    'CS 3501',  // Lab for OOD - REPLACED by CS 3101
  ],
}

/**
 * Check if a course code is known to be discontinued
 */
function isDiscontinuedCourse(code: string, schoolId?: string): boolean {
  const normalizedCode = code.toUpperCase().replace(/\s+/g, ' ').trim()
  
  // Check school-specific discontinued courses
  if (schoolId && DISCONTINUED_COURSES[schoolId]) {
    for (const discontinued of DISCONTINUED_COURSES[schoolId]) {
      if (normalizedCode === discontinued || normalizedCode.startsWith(discontinued + ' ')) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Dynamically determine the credit threshold for "main" courses based on the schedule
 * This makes validation school-agnostic (works for 3-credit and 4-credit systems)
 */
function calculateMainCourseThreshold(schedule: NormalizedSchedule): number {
  // Collect all non-elective course credits
  const allCredits: number[] = []
  for (const semester of schedule.semesters) {
    if (semester.type === 'academic' && semester.courses) {
      for (const course of semester.courses) {
        if (course.credits > 0) {
          allCredits.push(course.credits)
        }
      }
    }
  }
  
  if (allCredits.length === 0) return 3
  
  // Find the most common credit value (mode) that's > 1
  const creditCounts = new Map<number, number>()
  for (const credits of allCredits) {
    if (credits > 1) { // Exclude 1-credit labs
      creditCounts.set(credits, (creditCounts.get(credits) || 0) + 1)
    }
  }
  
  // Find the mode (most common credit value)
  let modeCredits = 3
  let maxCount = 0
  creditCounts.forEach((count, credits) => {
    if (count > maxCount) {
      maxCount = count
      modeCredits = credits
    }
  })
  
  // Main course threshold is the mode minus 1 (so 4-credit systems use 3+, 3-credit systems use 2+)
  return Math.max(2, modeCredits - 1)
}

/**
 * Priority order for elective removal (lower number = remove first)
 */
const ELECTIVE_REMOVAL_PRIORITY: Record<string, number> = {
  'free elective': 1,
  'free': 1,
  'unrestricted elective': 1,
  'general education': 2,
  'gen ed': 2,
  'nupath': 2,
  'arts': 2,
  'humanities': 2,
  'social science': 2,
  'major elective': 3,
  'concentration elective': 4,
  'technical elective': 4,
  'science with lab': 5,
  'science elective': 5,
  'writing': 6,
}

/**
 * Get the removal priority for an elective (lower = remove first)
 */
function getElectiveRemovalPriority(course: ParsedCourse): number {
  const nameLower = course.name.toLowerCase()
  
  // Check each priority pattern
  for (const [pattern, priority] of Object.entries(ELECTIVE_REMOVAL_PRIORITY)) {
    if (nameLower.includes(pattern)) {
      return priority
    }
  }
  
  // Default priority for unknown electives
  return 3
}

/**
 * Check if a course is an elective that can be removed
 */
function isRemovableElective(course: ParsedCourse): boolean {
  const code = course.code.toUpperCase().trim()
  return code === 'ELECTIVE' || code === 'ELEC'
}

interface TrimResult {
  semesters: ParsedSemester[]
  trimmedCount: number
  trimmedCredits: number
}

/**
 * Trim excess electives from a schedule to meet the target credit requirement.
 * Removes electives from later semesters first, prioritizing "Free Elective" removal.
 */
function trimExcessElectives(
  semesters: ParsedSemester[],
  currentCredits: number,
  targetCredits: number,
  mainCourseThreshold: number
): TrimResult {
  // Allow a generous buffer (15 credits) over the target - degree requirements vary widely
  const maxAllowed = targetCredits + 15
  
  if (currentCredits <= maxAllowed) {
    return { semesters, trimmedCount: 0, trimmedCredits: 0 }
  }
  
  const creditsToTrim = currentCredits - targetCredits
  let trimmedCount = 0
  let trimmedCredits = 0
  
  // Get academic semesters in reverse order (trim from later semesters first)
  const semestersCopy = semesters.map(s => ({ ...s, courses: s.courses ? [...s.courses] : undefined }))
  const academicIndices: number[] = []
  for (let i = 0; i < semestersCopy.length; i++) {
    if (semestersCopy[i].type === 'academic') {
      academicIndices.push(i)
    }
  }
  academicIndices.reverse() // Start from last semester
  
  // Build a list of removable electives with their locations and priorities
  interface ElectiveCandidate {
    semesterIdx: number
    courseIdx: number
    course: ParsedCourse
    priority: number
  }
  
  const candidates: ElectiveCandidate[] = []
  
  for (const semIdx of academicIndices) {
    const semester = semestersCopy[semIdx]
    if (!semester.courses) continue
    
    for (let courseIdx = 0; courseIdx < semester.courses.length; courseIdx++) {
      const course = semester.courses[courseIdx]
      if (isRemovableElective(course)) {
        candidates.push({
          semesterIdx: semIdx,
          courseIdx,
          course,
          priority: getElectiveRemovalPriority(course),
        })
      }
    }
  }
  
  // Sort by priority (ascending - lower priority removed first) then by semester (later first)
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return b.semesterIdx - a.semesterIdx // Later semesters first
  })
  
  // Remove electives until we're at or below target
  for (const candidate of candidates) {
    if (trimmedCredits >= creditsToTrim) break
    
    const semester = semestersCopy[candidate.semesterIdx]
    if (!semester.courses) continue
    
    // Check if removing this course would leave the semester with too few main courses
    const mainCoursesAfterRemoval = semester.courses.filter(
      (c, idx) => idx !== candidate.courseIdx && c.credits >= mainCourseThreshold
    ).length
    
    // Allow removal if semester still has 3+ main courses (relaxed for trimming)
    if (mainCoursesAfterRemoval < 3) continue
    
    // Remove the course
    semester.courses.splice(candidate.courseIdx, 1)
    trimmedCredits += candidate.course.credits
    trimmedCount++
    
    // Update semester total credits
    semester.totalCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0)
  }
  
  return { semesters: semestersCopy, trimmedCount, trimmedCredits }
}

/**
 * Validate and clean up a schedule
 * - Removes duplicate courses (keeps first occurrence)
 * - Flags placeholder courses
 * - Validates credit totals
 * - Checks full-time status (4+ main courses per semester)
 * - Checks credit bounds (12-20 per semester)
 * - Validates course code formats
 * - Adds warnings for any issues found
 */
export function validateSchedule(schedule: NormalizedSchedule, options: ValidationOptions = {}): ValidationResult {
  const issues: ValidationIssue[] = []
  const seenCourses = new Set<string>()
  let duplicatesRemoved = 0
  let placeholdersFound = 0
  let creditMismatches = 0
  let fullTimeViolations = 0
  let creditOverages = 0
  let creditUnderages = 0
  let invalidCodes = 0
  let discontinuedCourses = 0
  let totalCourses = 0
  let totalCreditsExceeded = false
  let electivesTrimmed = 0
  let electiveCount = 0
  let specificCourseCount = 0
  
  const { schoolId, trimExcessCredits = true } = options
  
  // Calculate dynamic threshold for main courses (school-agnostic)
  const mainCourseThreshold = calculateMainCourseThreshold(schedule)
  
  // Calculate actual credits before any modifications
  const actualCreditsBeforeTrim = schedule.semesters
    .filter(s => s.type === 'academic')
    .reduce((sum, s) => sum + (s.courses?.reduce((csum, c) => csum + c.credits, 0) || 0), 0)
  
  // Determine target credits: use override, or schedule's stated requirement, or default
  const targetCredits = options.targetCredits || 
    (typeof schedule.totalCredits === 'number' && schedule.totalCredits > 0 && schedule.totalCredits < 200 
      ? schedule.totalCredits 
      : 128) // Default to 128 if no valid target
  
  // Trim excess electives if enabled and significantly over (15+ credits)
  let workingSemesters = schedule.semesters
  if (trimExcessCredits && actualCreditsBeforeTrim > targetCredits + 15) {
    const trimResult = trimExcessElectives(
      schedule.semesters,
      actualCreditsBeforeTrim,
      targetCredits,
      mainCourseThreshold
    )
    workingSemesters = trimResult.semesters
    electivesTrimmed = trimResult.trimmedCount
    
    if (electivesTrimmed > 0) {
      issues.push({
        type: 'credit_overage',
        severity: 'warning',
        message: `Trimmed ${electivesTrimmed} elective(s) to reduce credits from ${actualCreditsBeforeTrim} toward target of ${targetCredits}.`,
      })
    }
  }
  
  // Find the last academic semester for flexibility
  const academicSemesters = workingSemesters.filter(s => s.type === 'academic')
  const lastAcademicTerm = academicSemesters[academicSemesters.length - 1]?.term
  
  // Process each semester
  const validatedSemesters: ParsedSemester[] = workingSemesters.map(semester => {
    if (semester.type !== 'academic' || !semester.courses) {
      return semester
    }
    
    const validatedCourses: ParsedCourse[] = []
    let mainCourseCount = 0
    
    for (const course of semester.courses) {
      totalCourses++
      const normalizedCode = course.code.toUpperCase().replace(/\s+/g, ' ').trim()
      
      // IMPORTANT: Don't deduplicate ELECTIVE courses - they represent different elective slots
      // Each ELECTIVE has a unique name (e.g., "Science with Lab", "General Education")
      const isElectiveSlot = normalizedCode === 'ELECTIVE' || normalizedCode === 'ELEC'
      
      // Count electives vs specific courses
      if (isElectiveSlot) {
        electiveCount++
      } else {
        specificCourseCount++
      }
      
      // Check for invalid course code format (only for non-electives)
      if (!isElectiveSlot && !isValidCourseCode(course.code)) {
        invalidCodes++
        issues.push({
          type: 'invalid_code',
          severity: 'warning',
          message: `Potentially invalid course code format: ${course.code} - "${course.name}"`,
          semester: semester.term,
          course: course.code,
        })
      }
      
      // Check for discontinued courses (school-specific)
      if (!isElectiveSlot && isDiscontinuedCourse(course.code, schoolId)) {
        discontinuedCourses++
        issues.push({
          type: 'discontinued_course',
          severity: 'error',
          message: `DISCONTINUED COURSE: ${course.code} - "${course.name}" is no longer offered. This course was removed from the curriculum.`,
          semester: semester.term,
          course: course.code,
        })
      }
      
      // Count main courses using dynamic threshold (school-agnostic)
      if (course.credits >= mainCourseThreshold) {
        mainCourseCount++
      }
      
      // Check for duplicates (but not elective slots)
      if (!isElectiveSlot && seenCourses.has(normalizedCode)) {
        duplicatesRemoved++
        issues.push({
          type: 'duplicate',
          severity: 'warning',
          message: `Removed duplicate course: ${course.code} (${course.name})`,
          semester: semester.term,
          course: course.code,
        })
        continue // Skip this duplicate
      }
      
      // Check for placeholders (but don't flag ELECTIVE with options as they're intentional)
      const courseAny = course as { options?: string }
      const hasOptions = !!courseAny.options
      if (!hasOptions && isPlaceholderCourse(course)) {
        placeholdersFound++
        issues.push({
          type: 'placeholder',
          severity: 'warning',
          message: `Placeholder course detected: ${course.code} - "${course.name}". Consider selecting a specific course.`,
          semester: semester.term,
          course: course.code,
        })
        // Still include it, but flag it
      }
      
      // Only track non-elective courses for deduplication
      if (!isElectiveSlot) {
        seenCourses.add(normalizedCode)
      }
      validatedCourses.push(course)
    }
    
    // Recalculate total credits
    const calculatedCredits = validatedCourses.reduce((sum, c) => sum + c.credits, 0)
    
    // Check for full-time status (4+ main courses, except last semester for flexibility)
    const isLastSemester = semester.term === lastAcademicTerm
    if (!isLastSemester && mainCourseCount < MIN_MAIN_COURSES) {
      fullTimeViolations++
      issues.push({
        type: 'full_time_violation',
        severity: 'warning',
        message: `${semester.term} has only ${mainCourseCount} main courses (expected ${MIN_MAIN_COURSES}+)`,
        semester: semester.term,
      })
    }
    
    // Check for credit overage
    if (calculatedCredits > MAX_CREDITS) {
      creditOverages++
      issues.push({
        type: 'credit_overage',
        severity: 'warning',
        message: `${semester.term} exceeds maximum ${MAX_CREDITS} credits (actual ${calculatedCredits})`,
        semester: semester.term,
      })
    }
    
    // Check for credit underage - final semester has lower threshold
    const minCreditsForSemester = isLastSemester ? MIN_CREDITS_FINAL : MIN_CREDITS
    if (calculatedCredits < minCreditsForSemester) {
      creditUnderages++
      issues.push({
        type: 'credit_underage',
        severity: 'warning',
        message: `${semester.term} is below minimum ${minCreditsForSemester} credits for full-time status (actual ${calculatedCredits})`,
        semester: semester.term,
      })
    }
    
    if (semester.totalCredits && semester.totalCredits !== calculatedCredits) {
      creditMismatches++
      issues.push({
        type: 'credit_mismatch',
        severity: 'warning',
        message: `Credit mismatch in ${semester.term}: declared ${semester.totalCredits}, actual ${calculatedCredits}`,
        semester: semester.term,
      })
    }
    
    return {
      ...semester,
      courses: validatedCourses,
      totalCredits: calculatedCredits,
    }
  })
  
  // Add validation warnings to schedule warnings
  const additionalWarnings: string[] = []
  
  if (duplicatesRemoved > 0) {
    additionalWarnings.push(`${duplicatesRemoved} duplicate course(s) were removed from your schedule.`)
  }
  
  if (placeholdersFound > 0) {
    additionalWarnings.push(`${placeholdersFound} placeholder course(s) detected. Work with your advisor to select specific courses.`)
  }
  
  if (fullTimeViolations > 0) {
    additionalWarnings.push(`${fullTimeViolations} semester(s) have fewer than ${MIN_MAIN_COURSES} main courses. Consider adding courses to maintain full-time status.`)
  }
  
  if (creditOverages > 0) {
    additionalWarnings.push(`${creditOverages} semester(s) exceed ${MAX_CREDITS} credits. Consider spreading courses across semesters.`)
  }
  
  if (creditUnderages > 0) {
    additionalWarnings.push(`${creditUnderages} semester(s) are below ${MIN_CREDITS} credits for full-time status.`)
  }
  
  if (discontinuedCourses > 0) {
    additionalWarnings.push(`⚠️ ${discontinuedCourses} course(s) are DISCONTINUED and no longer offered. Please find current replacements.`)
  }
  
  if (electivesTrimmed > 0) {
    additionalWarnings.push(`📉 ${electivesTrimmed} elective(s) were removed to match the degree requirement of ${targetCredits} credits.`)
  }
  
  // Check for excessive electives (more than 50% of courses are ELECTIVE)
  const electiveRatio = totalCourses > 0 ? electiveCount / totalCourses : 0
  if (electiveRatio > 0.5 && electiveCount > 10) {
    issues.push({
      type: 'excessive_electives',
      severity: 'warning',
      message: `Schedule has ${electiveCount} ELECTIVE slots out of ${totalCourses} courses (${Math.round(electiveRatio * 100)}%). Many required courses may be missing specific codes.`,
    })
    additionalWarnings.push(`⚠️ ${electiveCount} courses are marked as ELECTIVE. Required courses should have specific codes.`)
  }
  
  // Recalculate total credits
  const totalCredits = validatedSemesters
    .filter(s => s.type === 'academic')
    .reduce((sum, s) => sum + (s.totalCredits || 0), 0)
  
  // Check if total credits exceed very high maximum (160+)
  if (totalCredits > MAX_TOTAL_CREDITS) {
    totalCreditsExceeded = true
    issues.push({
      type: 'credit_overage',
      severity: 'warning',
      message: `Total credits (${totalCredits}) is unusually high. Verify this matches your degree requirements.`,
    })
  }
  
  const validatedSchedule: NormalizedSchedule = {
    ...schedule,
    semesters: validatedSemesters,
    totalCredits,
    warnings: [...schedule.warnings, ...additionalWarnings],
  }
  
  return {
    schedule: validatedSchedule,
    issues,
    stats: {
      totalCourses,
      duplicatesRemoved,
      placeholdersFound,
      creditMismatches,
      fullTimeViolations,
      creditOverages,
      creditUnderages,
      invalidCodes,
      discontinuedCourses,
      totalCreditsExceeded,
      mainCourseThreshold,
      electivesTrimmed,
      targetCredits,
      actualCredits: actualCreditsBeforeTrim,
      electiveCount,
      specificCourseCount,
    },
  }
}

/**
 * Quick check if a schedule has quality issues
 */
export function hasQualityIssues(schedule: NormalizedSchedule): boolean {
  const result = validateSchedule(schedule)
  return result.stats.duplicatesRemoved > 0 || result.stats.placeholdersFound > 2
}

