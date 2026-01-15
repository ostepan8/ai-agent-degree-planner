/**
 * Shared prompt templates for schedule generation
 *
 * This module provides the prompt templates used by both the API route
 * and test scripts to ensure consistency across all schedule generation.
 */

/**
 * @typedef {Object} School
 * @property {string} id
 * @property {string} name
 * @property {string} [shortName]
 * @property {string} catalogUrl
 * @property {string} [location]
 */

/**
 * @typedef {Object} ExtractedRequirements
 * @property {string} school
 * @property {string} major
 * @property {string} catalogYear
 * @property {number} totalCreditsRequired
 * @property {number} estimatedSemesters
 * @property {Array<{code: string, name: string, credits: number, prerequisites: string[], typicalSemester: number}>} coreCourses
 * @property {Array<{name: string, creditsRequired: number, coursesRequired: number, approvedCourses: string[]}>} electiveCategories
 * @property {Array<{category: string, creditsRequired: number, courses: string[]}>} generalEducation
 * @property {{coopRequired?: boolean, coopCount?: number, capstoneRequired?: boolean, capstoneCredits?: number}} [specialRequirements]
 * @property {string[]} warnings
 * @property {string} sourceUrl
 */

/**
 * @typedef {Object} CompletedSemesterData
 * @property {string} term
 * @property {Array<{code: string, name: string, credits: number, grade: string}>} courses
 * @property {number} totalCredits
 */

/**
 * @typedef {Object} TranscriptData
 * @property {CompletedSemesterData[]} completedSemesters
 * @property {Array<{code: string, name: string, credits: number, grade: string}>} transferCredits
 * @property {number} totalCompletedCredits
 * @property {number} totalTransferCredits
 * @property {string|null} lastCompletedTerm
 * @property {string|null} nextSemester
 */

/**
 * @typedef {Object} SchedulePromptContext
 * @property {School} school
 * @property {string} major
 * @property {Object} preferences
 * @property {string} preferences.startingSemester
 * @property {'light' | 'standard' | 'accelerated'} preferences.creditsPerSemester
 * @property {'none' | 'one' | 'two' | 'three'} preferences.coopPlan
 * @property {string} [preferences.additionalNotes]
 * @property {Object} [studentContext]
 * @property {boolean} [studentContext.isFreshman]
 * @property {string} [studentContext.completedCoursesText]
 * @property {string} [studentContext.concentration]
 * @property {string} [studentContext.minor]
 * @property {ExtractedRequirements} [extractedRequirements]
 */

/** Credit load configuration */
const CREDIT_LOAD_CONFIG = {
  light: { min: 12, max: 14, description: "12-14 credits (lighter load)" },
  standard: {
    min: 15,
    max: 17,
    description: "15-17 credits (standard full-time)",
  },
  accelerated: { min: 17, max: 19, description: "17-19 credits (accelerated)" },
};

/** Co-op count mapping */
const COOP_COUNT_MAP = {
  none: 0,
  one: 1,
  two: 2,
  three: 3,
};

/**
 * School-specific curriculum notes
 * These are CRITICAL reminders about major curriculum changes that the AI must know about
 */
const SCHOOL_CURRICULUM_NOTES = {
  northeastern: `
# ⚠️ CRITICAL: NORTHEASTERN CS CURRICULUM CHANGED FALL 2025 ⚠️

**THE INTRO PROGRAMMING SEQUENCE WAS COMPLETELY REPLACED.** Your training data is OUTDATED.

## OLD COURSES THAT NO LONGER EXIST (DO NOT USE):
- ❌ CS 2500 (Fundies 1) - REPLACED by CS 2000
- ❌ CS 2510 (Fundies 2) - REPLACED by CS 2100
- ❌ CS 3500 (OOD) - REPLACED by CS 3100

## THE NEW INTRO PROGRAMMING SEQUENCE:
- CS 2000 + CS 2001: Introduction to Program Design and Implementation + Lab (4+1 cr)
- CS 2100 + CS 2101: Program Design and Implementation 1 + Lab (4+1 cr)
- CS 3100 + CS 3101: Program Design and Implementation 2 + Lab (4+1 cr)

## UNCHANGED CORE COURSES (still required):
- CS 1800 + CS 1802: Discrete Structures + Seminar (4+1 cr)
- CS 3000: Algorithms and Data (4 cr)
- CS 3650: Computer Systems (4 cr)
- CS 3800: Theory of Computation (4 cr)
- CS 4530: Fundamentals of Software Engineering (4 cr)

## OTHER REQUIRED COURSES:
- CS 1200: First Year Seminar (1 cr)
- CS 1210: Professional Development for Khoury Co-op (1 cr)
- MATH 1341: Calculus 1 (4 cr)
- ENGW 1111: First-Year Writing (4 cr)

**USE THESE SPECIFIC CODES - do not use CS 2500/2510/3500.**
`,
};

/**
 * Get school-specific curriculum notes if available
 * @param {string} schoolId
 * @returns {string}
 */
function getSchoolNotes(schoolId) {
  return SCHOOL_CURRICULUM_NOTES[schoolId] || "";
}

/**
 * Format extracted requirements into a prompt section
 * @param {ExtractedRequirements} requirements
 * @returns {string}
 */
function formatExtractedRequirements(requirements) {
  if (!requirements) return "";

  const sections = [];

  sections.push(`# VERIFIED REQUIREMENTS (from catalog research)
**These requirements were extracted from the university catalog. Use these as your primary source.**

- **Total Credits Required:** ${
    requirements.totalCreditsRequired || "Search to verify"
  }
- **Catalog Year:** ${requirements.catalogYear || "Current"}
- **Source:** ${requirements.sourceUrl || "University catalog"}`);

  // Core courses
  if (requirements.coreCourses && requirements.coreCourses.length > 0) {
    const courseList = requirements.coreCourses
      .map(
        (c) =>
          `  - ${c.code}: ${c.name} (${c.credits} cr)${
            c.prerequisites?.length
              ? ` [prereqs: ${c.prerequisites.join(", ")}]`
              : ""
          }`
      )
      .join("\n");
    sections.push(`
## Required Core Courses (${requirements.coreCourses.length} courses)
${courseList}`);
  }

  // Elective categories
  if (
    requirements.electiveCategories &&
    requirements.electiveCategories.length > 0
  ) {
    const electiveList = requirements.electiveCategories
      .map(
        (e) => {
          // Ensure approvedCourses is an array before using array methods
          const courses = Array.isArray(e.approvedCourses) ? e.approvedCourses : [];
          return `  - ${e.name}: ${e.creditsRequired} credits (${
            e.coursesRequired
          } courses)${
            courses.length > 0
              ? ` - Options: ${courses.slice(0, 5).join(", ")}${
                  courses.length > 5 ? "..." : ""
                }`
              : ""
          }`;
        }
      )
      .join("\n");
    sections.push(`
## Elective Requirements
${electiveList}`);
  }

  // General education
  if (
    requirements.generalEducation &&
    requirements.generalEducation.length > 0
  ) {
    const genEdList = requirements.generalEducation
      .map(
        (g) => {
          // Ensure courses is an array before using array methods
          const courses = Array.isArray(g.courses) ? g.courses : [];
          return `  - ${g.category}: ${g.creditsRequired} credits${
            courses.length > 0
              ? ` (${courses.slice(0, 3).join(", ")}${
                  courses.length > 3 ? "..." : ""
                })`
              : ""
          }`;
        }
      )
      .join("\n");
    sections.push(`
## General Education / Distribution Requirements
${genEdList}`);
  }

  // Special requirements
  if (requirements.specialRequirements) {
    const special = requirements.specialRequirements;
    const items = [];
    if (special.coopRequired)
      items.push(`Co-op required: ${special.coopCount || "Yes"} co-ops`);
    if (special.capstoneRequired)
      items.push(`Capstone required: ${special.capstoneCredits || 4} credits`);
    if (items.length > 0) {
      sections.push(`
## Special Requirements
${items.map((i) => `  - ${i}`).join("\n")}`);
    }
  }

  // Warnings from requirements extraction
  if (requirements.warnings && requirements.warnings.length > 0) {
    sections.push(`
## Notes from Requirements Research
${requirements.warnings.map((w) => `  - ⚠️ ${w}`).join("\n")}`);
  }

  sections.push(`
**IMPORTANT:** Use the course codes above. Only search to verify availability, not to find new courses.
`);

  return sections.join("\n");
}

/**
 * Build the full schedule generation instructions for FRESHMAN students.
 * 
 * NOTE: For students with transcript data (continuing students), use the 
 * completion pipeline in lib/completion_prompt.js instead.
 * 
 * @param {SchedulePromptContext} context
 * @returns {string}
 */
export function buildScheduleInstructions(context) {
  const { school, major, preferences, studentContext, extractedRequirements } =
    context;

  const coopCount = COOP_COUNT_MAP[preferences.coopPlan] || 0;
  const creditLoad =
    CREDIT_LOAD_CONFIG[preferences.creditsPerSemester] ||
    CREDIT_LOAD_CONFIG.standard;
  
  // This is the full generation pipeline - for freshmen starting from scratch
  const totalAcademicSemesters = 8;
  const totalSemesters = totalAcademicSemesters + coopCount;

  const startYear = parseInt(
    preferences.startingSemester.match(/\d{4}/)?.[0] || "2025"
  );
  const gradYear = startYear + 4 + Math.floor(coopCount / 2);
  const currentYear = new Date().getFullYear();
  
  // Calculate target credits
  const degreeCredits = extractedRequirements?.totalCreditsRequired || 128;

  // Build student info
  const studentInfo = [
    `Starting Semester: ${preferences.startingSemester}`,
    `Credit load: ${creditLoad.description}`,
    `Co-ops: ${coopCount}${
      coopCount > 0
        ? " (each occupies one full semester with zero courses)"
        : ""
    }`,
  ];

  // Student status
  if (studentContext?.isFreshman !== false) {
    studentInfo.push("Status: Freshman, no completed courses");
  } else if (studentContext?.completedCoursesText) {
    studentInfo.push(`Completed: ${studentContext.completedCoursesText}`);
  }
  if (studentContext?.concentration) {
    studentInfo.push(`Concentration: ${studentContext.concentration}`);
  }
  if (studentContext?.minor) {
    studentInfo.push(`Minor: ${studentContext.minor}`);
  }
  if (preferences.additionalNotes) {
    studentInfo.push(`Notes: ${preferences.additionalNotes}`);
  }

  const schoolNotes = getSchoolNotes(school.id);
  const requirementsSection = formatExtractedRequirements(extractedRequirements);

  // Build task section
  let taskSection;
  if (extractedRequirements) {
    taskSection = `# TASK
Use the verified requirements below to build a complete ${totalSemesters}-semester JSON schedule (${totalAcademicSemesters} academic + ${coopCount} co-op). The requirements have already been researched from ${school.catalogUrl}.`;
  } else {
    taskSection = `# TASK
Search ${school.catalogUrl} for ${major} degree requirements. Output a complete ${totalSemesters}-semester JSON schedule (${totalAcademicSemesters} academic + ${coopCount} co-op).`;
  }

  // Example output for full generation - uses placeholder format to show structure
  // The actual output must use REAL course codes from search results
  const exampleOutput = `{
  "school": "${school.name}",
  "major": "${major}",
  "degree": "BS",
  "startTerm": "${preferences.startingSemester}",
  "graduationTerm": "Spring ${gradYear}",
  "totalCredits": ${degreeCredits},
  "catalogVerified": true,
  "semesters": [
    {
      "term": "Fall ${startYear}",
      "type": "academic",
      "status": "planned",
      "courses": [
        {"code": "CS 1800", "name": "Discrete Structures", "credits": 4},
        {"code": "CS 1802", "name": "Seminar for CS 1800", "credits": 1},
        {"code": "CS 2000", "name": "Introduction to Program Design and Implementation", "credits": 4},
        {"code": "CS 2001", "name": "Lab for CS 2000", "credits": 1},
        {"code": "MATH 1341", "name": "Calculus 1 for Science and Engineering", "credits": 4},
        {"code": "ENGW 1111", "name": "First-Year Writing", "credits": 4}
      ],
      "totalCredits": 18
    },
    {
      "term": "Summer ${startYear + 2}",
      "type": "coop",
      "coopNumber": 1
    }
  ],
  "warnings": [],
  "sourceUrl": "${school.catalogUrl}"
}

**CRITICAL: Notice how this Fall Year 1 example has 4 MAIN COURSES (CS 1800, CS 2000, MATH 1341, ENGW 1111) plus 2 LABS:**
- CS 1800 + CS 1802: Discrete Structures + Seminar (4+1 = 5 credits)
- CS 2000 + CS 2001: Intro to Program Design + Lab (4+1 = 5 credits)
- MATH 1341: Calculus 1 (4 credits)
- ENGW 1111: First-Year Writing (4 credits)
= 18 credits total, 4 main courses ✓

**NEVER mark required courses as ELECTIVE - they have specific codes, find them.**`;

  return `# ROLE
You are an academic advisor for ${
    school.name
  } creating a verified degree plan for ${major}. You have web search access.
${schoolNotes}
${requirementsSection}
${taskSection}

# STUDENT INFO
${studentInfo.map((s) => `- ${s}`).join("\n")}

# MANDATORY SEARCH REQUIREMENT
**YOU MUST SEARCH** for the degree requirements before generating ANY schedule. Do NOT rely on training data.
1. Search for "${school.name} ${major} degree requirements" and "${school.name} ${major} curriculum"
2. Find the EXACT required courses with their REAL course codes (e.g., CS 1800, CS 2000, MATH 1341)
3. Use those EXACT codes in your output - do NOT paraphrase or generalize

# COURSE CODE RULES (CRITICAL)
1. **REQUIRED COURSES must have SPECIFIC codes.** Core CS courses, math courses, writing courses - these are NOT electives. You MUST find and use their exact codes (e.g., "CS 1800", "CS 2000", "ENGW 1111").
2. **ELECTIVE is ONLY for true elective categories** where students choose from multiple options (e.g., "Science with Lab", "General Education", "Concentration Elective").
3. **NEVER use ELECTIVE for required core courses.** If a course is required for all students, find its code.
4. **NEVER include "(Placeholder)", "TBD", or vague names.** Every course must have its REAL catalog name.
5. **NEVER invent course codes.** Every code must come from your search results.

# FULL-TIME STUDENT REQUIREMENTS (CRITICAL)
**This schedule is for a FULL-TIME student. Each semester MUST have:**
- **MINIMUM 4 four-credit courses** (16 credits from main courses alone)
- Labs/seminars (1-credit) are IN ADDITION to the 4 main courses, not replacements
- Target: 16-18 credits per semester (4 main courses + labs if needed)

## REFERENCE: Northeastern CS Fall Year 1 (from official sample plan)
This is EXACTLY what Fall Year 1 should look like for a CS freshman:
- CS 1800 + CS 1802: Discrete Structures + Seminar (4+1 = 5 cr)
- CS 2000 + CS 2001: Intro to Program Design + Lab (4+1 = 5 cr)
- MATH 1341: Calculus 1 (4 cr)
- ENGW 1111: First-Year Writing (4 cr)
= 18 credits, 4 main courses ✓

**Follow the official sample plan of study for course sequencing.**

Example of an INVALID semester:
- CS 1800 (4cr) + MATH 1341 (4cr) + ENGW 1111 (4cr) + CS 1802 (1cr) = only 3 main courses ✗

# CONSTRAINTS
1. **No duplicate courses.** Each course code appears exactly once.
2. **Prerequisites satisfied.** Courses scheduled only after their prerequisites.
3. **Use current ${currentYear}-${
    currentYear + 1
  } catalog.** Search to verify every course code. Do not trust training data.
4. **Every academic semester: MINIMUM 4 four-credit courses.** Labs (1cr) do NOT count. You need 4 courses worth 3-4 credits EACH.
5. **Credits per semester: 16-18 typical.** Final semester may be 12-15 to hit exact degree total.
6. **Total credits = degree requirement.** Search for exact requirement (typically 120-134). Do not assume.

${
  extractedRequirements
    ? `# SCHEDULE BUILDING PROCESS
1. Use the verified core courses from the requirements section above
2. Place courses respecting prerequisites and typical semester ordering
3. Add required electives from each category
4. Fill in general education requirements
5. Track running credit total, stop when reaching ${extractedRequirements.totalCreditsRequired || 128} credits

**Only search to verify** course availability in the current term, not to find new courses.`
    : `# SEARCH PROCESS

## MANDATORY SEARCHES (do these FIRST before generating anything)
1. **SAMPLE PLAN OF STUDY (MOST IMPORTANT):** Search for "${school.name} ${major} sample plan of study" - this gives you the OFFICIAL semester-by-semester plan
2. Search: "${school.name} ${major} 4 year plan" or "degree plan"
3. Search: site:catalog.northeastern.edu ${major} plan of study (for Northeastern students)
4. Search: "${school.name} ${major} degree requirements ${currentYear}"

**USE THE OFFICIAL SAMPLE PLAN as your template.** The university publishes exactly which courses to take each semester. Do NOT guess - follow the official plan.

## After finding the sample plan:
1. Extract: total credits required, all required courses with prerequisites
2. Build schedule semester-by-semester FOLLOWING the sample plan ordering
3. Track running credit total, stop when reaching degree requirement

**If search fails:** Include warning in output, use best available knowledge, set "catalogVerified": false.`
}

# COURSE FORMAT

## REQUIRED COURSES (use for ALL core/required courses)
These are courses that ALL students in this major MUST take. Use EXACT codes from your search:
{"code": "CS 1800", "name": "Discrete Structures", "credits": 4}
{"code": "CS 2000", "name": "Introduction to Program Design and Implementation", "credits": 4}
{"code": "CS 2001", "name": "Lab for CS 2000", "credits": 1}
{"code": "MATH 1341", "name": "Calculus 1 for Science and Engineering", "credits": 4}
{"code": "ENGW 1111", "name": "First-Year Writing", "credits": 4}

## ELECTIVE SLOTS (use ONLY for true electives where students choose)
These are categories where students pick from a list of approved courses:
{"code": "ELECTIVE", "name": "Science with Lab", "credits": 4, "options": "PHYS 1151, CHEM 1211, BIOL 1111"}
{"code": "ELECTIVE", "name": "Concentration Elective", "credits": 4, "options": "CS 3700, CS 4100, CS 4400"}
{"code": "ELECTIVE", "name": "General Education", "credits": 4, "options": "HIST 1130, PHIL 1101, SOCL 1101"}

**CRITICAL:** Do NOT use ELECTIVE for required courses like intro programming, discrete math, algorithms, etc. Those have SPECIFIC codes - SEARCH and find them.

# OUTPUT FORMAT
Return ONLY valid JSON. No markdown fences, no preamble, no explanation.

${exampleOutput}

# VALIDATION CHECKLIST
Before outputting, verify:
- ✅ You searched for and found the REAL course codes for ALL required courses
- ✅ Core courses (intro programming, discrete math, algorithms, etc.) have SPECIFIC codes, NOT "ELECTIVE"
- ✅ ELECTIVE is only used for true elective categories (Science with Lab, General Education, etc.)
- ❌ Any course name contains "(Placeholder)", "TBD", or vague descriptions
- ❌ Any required course is marked as ELECTIVE instead of having its real code
- ❌ Sum of totalCredits ≠ degree requirement from catalog
- ❌ Any academic semester has FEWER than 4 four-credit courses (labs don't count!)
- ❌ Any academic semester has < 16 credits (except final semester)
- ❌ Course scheduled before its prerequisite
- ❌ Duplicate course code
- ❌ Fewer than ${totalSemesters} semesters

**COUNT YOUR MAIN COURSES: Each semester needs 4 courses worth 3-4 credits each. 1-credit labs are extra.**`;
}

/**
 * Get the total expected semesters for a given co-op plan
 * @param {string} coopPlan
 * @returns {number}
 */
export function getTotalExpectedSemesters(coopPlan) {
  const coopCount = COOP_COUNT_MAP[coopPlan] || 0;
  return 8 + coopCount;
}

/**
 * Get the graduation year based on start year and co-op plan
 * @param {number} startYear
 * @param {string} coopPlan
 * @returns {number}
 */
export function getGraduationYear(startYear, coopPlan) {
  const coopCount = COOP_COUNT_MAP[coopPlan] || 0;
  return startYear + 4 + Math.floor(coopCount / 2);
}

/**
 * Get credit load configuration
 * @param {string} loadType
 * @returns {{min: number, max: number, description: string}}
 */
export function getCreditLoadConfig(loadType) {
  return CREDIT_LOAD_CONFIG[loadType] || CREDIT_LOAD_CONFIG.standard;
}
