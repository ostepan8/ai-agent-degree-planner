import { NextRequest, NextResponse } from 'next/server'
import { createAgentRun, parseAnswer } from '@/lib/subconscious'
import { type GenerateScheduleRequest } from '@/lib/schemas'
import { normalizeSchedule } from '@/lib/parseScheduleMarkdown'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateScheduleRequest
    const { school, major, completedCourses, preferences, isFreshman } = body
    
    if (!school || !major || !preferences) {
      return NextResponse.json(
        { error: 'School, major, and preferences are required' },
        { status: 400 }
      )
    }
    
    // Build the instruction for the AI agent
    const completedCoursesText = isFreshman
      ? 'The student is a freshman with no completed courses.'
      : `The student has completed the following courses:\n${completedCourses
          .map(c => `- ${c.code}: ${c.name} (${c.credits} credits, ${c.grade})`)
          .join('\n')}`
    
    const creditLoadMap = {
      light: '12-15 credits (lighter load)',
      standard: '16-18 credits (standard full-time)',
      accelerated: '18-20 credits (accelerated)',
    }
    
    const coopMap = {
      none: '0 co-ops (4 year plan)',
      one: '1 co-op (4 year plan)',
      two: '2 co-ops (4.5 year plan)',
      three: '3 co-ops (5 year plan)',
    }
    
    // Calculate co-op count
    const coopCount = { none: 0, one: 1, two: 2, three: 3 }[preferences.coopPlan] || 0;
    const startYear = parseInt(preferences.startingSemester.match(/\d{4}/)?.[0] || "2025");
    const gradYear = startYear + 4 + Math.floor(coopCount / 2);
    const totalExpectedSemesters = 8 + coopCount;
    
    const instructions = `You are a STRICT academic advisor for ${school.name}. Create a VERIFIED degree plan for ${major}.

## MANDATORY SEARCH REQUIREMENT
**YOU MUST SEARCH** for the degree requirements before generating ANY schedule. Do NOT rely on training data.

### MANDATORY SEARCHES (do these FIRST)
1. **SAMPLE PLAN OF STUDY (MOST IMPORTANT):** Search for "${school.name} ${major} sample plan of study" - this gives you the OFFICIAL semester-by-semester plan
2. Search: "${school.name} ${major} 4 year plan" or "degree plan"
3. Search: site:catalog.northeastern.edu ${major} plan of study (for Northeastern students)
4. Search for "${school.name} ${major} degree requirements" and "${school.name} ${major} curriculum"

**USE THE OFFICIAL SAMPLE PLAN as your template.** The university publishes exactly which courses to take each semester. Do NOT guess - follow the official plan.

5. Find the EXACT required courses with their REAL course codes (e.g., CS 1800, CS 2000, MATH 1341)
6. Use those EXACT codes in your output - do NOT paraphrase or generalize

## COURSE CODE RULES (CRITICAL)
1. **REQUIRED COURSES must have SPECIFIC codes.** Core CS courses, math, writing - these are NOT electives. Use exact codes.
2. **ELECTIVE is ONLY for true elective categories** (Science with Lab, General Education, Concentration Elective).
3. **NEVER use ELECTIVE for required core courses.** Intro programming, discrete math, algorithms have SPECIFIC codes - find them.
4. **NEVER include "(Placeholder)", "TBD", or vague names.** Every course must have its REAL catalog name.

## TASK
1. Search ${school.catalogUrl} to find the EXACT degree requirements for the ${major} program
2. **IMPORTANT**: Find the EXACT total credits required for this specific degree (do NOT assume 128 - different programs have different requirements)
3. Create a complete semester-by-semester plan using ONLY verified course codes

## STUDENT INFO
- Starting: ${preferences.startingSemester}
- Credit load: ${creditLoadMap[preferences.creditsPerSemester]}
- Co-op plan: ${coopMap[preferences.coopPlan]} (co-ops are FULL semesters with ZERO courses)
${isFreshman ? '- Status: Freshman, no completed courses' : `- Completed:\n${completedCoursesText}`}
${preferences.additionalNotes ? `- Notes: ${preferences.additionalNotes}` : ''}

## COURSE TYPES

### 1. REQUIRED COURSES - Use for ALL core requirements (MUST have specific codes)
Core courses that ALL students take. SEARCH and find their EXACT codes:
{"code": "CS 1800", "name": "Discrete Structures", "credits": 4}
{"code": "CS 2000", "name": "Introduction to Program Design and Implementation", "credits": 4}
{"code": "CS 2001", "name": "Lab for CS 2000", "credits": 1}
{"code": "MATH 1341", "name": "Calculus 1 for Science and Engineering", "credits": 4}
{"code": "ENGW 1111", "name": "First-Year Writing", "credits": 4}

### 2. ELECTIVE SLOTS - Use ONLY for true electives where students choose
Categories where students pick from approved options:
{"code": "ELECTIVE", "name": "Science with Lab", "credits": 4, "options": "PHYS 1151, CHEM 1211, BIOL 1111"}
{"code": "ELECTIVE", "name": "Concentration Elective", "credits": 4, "options": "CS 3700, CS 4100, CS 4400"}
{"code": "ELECTIVE", "name": "General Education", "credits": 4, "options": "HIST 1130, PHIL 1101"}

**CRITICAL:** Do NOT use ELECTIVE for required courses. Intro programming, discrete math, algorithms, etc. have SPECIFIC codes - SEARCH and find them.

## FULL-TIME STUDENT REQUIREMENTS (CRITICAL)
**Each semester MUST have MINIMUM 4 four-credit courses:**
- Labs (1cr) do NOT count toward this minimum - they are IN ADDITION
- Target: 16-18 credits per semester (4 main courses + labs)

### REFERENCE: Northeastern CS Fall Year 1 (from official sample plan)
This is EXACTLY what Fall Year 1 should look like for a CS freshman:
- CS 1800 + CS 1802: Discrete Structures + Seminar (4+1 = 5 cr)
- CS 2000 + CS 2001: Intro to Program Design + Lab (4+1 = 5 cr)
- MATH 1341: Calculus 1 (4 cr)
- ENGW 1111: First-Year Writing (4 cr)
= 18 credits, 4 main courses ✓

**Follow the official sample plan of study for course sequencing.**

## RULES
1. Required courses: ONLY use course codes verified from your search results
2. Elective slots: use ELECTIVE format with real example options from catalog
3. No duplicate required courses
4. Prerequisites must be respected
5. NEVER include "(Placeholder)" or invented names
6. **MINIMUM 4 four-credit courses per semester** (labs don't count)

## CO-OP RULES
- Co-op = FULL-TIME WORK for an ENTIRE semester (ZERO courses)
- Format: {"term": "...", "type": "coop", "coopNumber": N}

## OUTPUT FORMAT

Return ONLY a JSON object (no markdown):
{
  "school": "${school.name}",
  "major": "${major}",
  "degree": "BS",
  "startTerm": "${preferences.startingSemester}",
  "graduationTerm": "Spring ${gradYear}",
  "totalCredits": 128,
  "semesters": [
    {"term": "Fall ${startYear}", "type": "academic", "courses": [
      {"code": "CS 1800", "name": "Discrete Structures", "credits": 4},
      {"code": "CS 1802", "name": "Seminar for CS 1800", "credits": 1},
      {"code": "CS 2000", "name": "Introduction to Program Design and Implementation", "credits": 4},
      {"code": "CS 2001", "name": "Lab for CS 2000", "credits": 1},
      {"code": "MATH 1341", "name": "Calculus 1 for Science and Engineering", "credits": 4},
      {"code": "ENGW 1111", "name": "First-Year Writing", "credits": 4}
    ], "totalCredits": 18},
    {"term": "Summer ${startYear + 2}", "type": "coop", "coopNumber": 1}
  ],
  "warnings": ["Verify elective choices with advisor"],
  "sourceUrl": "${school.catalogUrl}"
}

## VALIDATION CHECKLIST
Before outputting, verify:
- ✅ You SEARCHED for and found REAL course codes for ALL required courses
- ✅ Core courses (intro programming, discrete math, algorithms) have SPECIFIC codes, NOT "ELECTIVE"
- ✅ ELECTIVE is only used for true elective categories (Science with Lab, General Education)
- ✅ **Each semester has MINIMUM 4 four-credit courses** (labs don't count toward this!)
- ✅ Each semester totals 16-18 credits
- ❌ No course name contains "(Placeholder)", "TBD", or vague descriptions
- ❌ No required course is marked as ELECTIVE
- ❌ Any semester has fewer than 4 four-credit courses
- ✓ All ${totalExpectedSemesters} semesters are included
- ✓ Total credits match the degree requirement from the catalog
`

    const result = await createAgentRun(
      instructions,
      { awaitCompletion: true }
    )
    
    if (!result.result?.answer) {
      return NextResponse.json(
        { error: 'Failed to generate schedule' },
        { status: 500 }
      )
    }
    
    // Parse the JSON string response (without answerFormat, answer is a string)
    let schedule
    try {
      schedule = parseAnswer<Record<string, unknown>>(result.result.answer)
      // Normalize to handle any edge cases
      schedule = normalizeSchedule(schedule)
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse schedule response' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ schedule })
  } catch (error) {
    console.error('Schedule generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate schedule' },
      { status: 500 }
    )
  }
}

