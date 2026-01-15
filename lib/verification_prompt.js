/**
 * Verification/Requirements Extraction Prompt
 *
 * This module provides the prompt for extracting degree requirements
 * from university catalogs. Used in the initial form process to look up
 * course requirements before schedule generation.
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
 * @typedef {Object} RequirementsContext
 * @property {School} school
 * @property {string} major
 * @property {string} [concentration]
 * @property {string} [minor]
 */

/**
 * School-specific curriculum notes for verification
 */
const SCHOOL_CURRICULUM_NOTES = {
  northeastern: `
# ⚠️ CRITICAL: NORTHEASTERN CS CURRICULUM CHANGED FALL 2025 ⚠️

**OLD COURSES REPLACED (DO NOT USE):**
- ❌ CS 2500 (Fundies 1) → Now CS 2000 + CS 2001
- ❌ CS 2510 (Fundies 2) → Now CS 2100 + CS 2101
- ❌ CS 3500 (OOD) → Now CS 3100 + CS 3101

**NEW INTRO SEQUENCE:**
- CS 2000 + CS 2001: Introduction to Program Design and Implementation + Lab
- CS 2100 + CS 2101: Program Design and Implementation 1 + Lab
- CS 3100 + CS 3101: Program Design and Implementation 2 + Lab

**UNCHANGED CORE:** CS 1800, CS 3000, CS 3650, CS 3800, CS 4530

**Use these SPECIFIC codes. Do NOT use CS 2500/2510/3500.**
`,
};

function getSchoolNotes(schoolId) {
  return SCHOOL_CURRICULUM_NOTES[schoolId] || "";
}

/**
 * Build the requirements extraction prompt
 * @param {RequirementsContext} context
 * @returns {string}
 */
export function buildRequirementsPrompt(context) {
  const { school, major, concentration, minor } = context;
  const currentYear = new Date().getFullYear();
  const schoolNotes = getSchoolNotes(school.id);

  let additionalRequirements = "";
  if (concentration) {
    additionalRequirements += `\n- Concentration: ${concentration}`;
  }
  if (minor) {
    additionalRequirements += `\n- Minor: ${minor}`;
  }

  return `# ROLE
You are an academic requirements researcher extracting official degree requirements from university catalogs.
${schoolNotes}

# TASK
Search ${
    school.catalogUrl
  } to find the complete, current degree requirements for:
- School: ${school.name}
- Major: ${major}${additionalRequirements}
- Catalog Year: ${currentYear}-${currentYear + 1}

# REQUIRED SEARCHES
1. "${school.name} ${major} degree requirements ${currentYear}"
2. "${school.name} ${major} curriculum"
3. Search the catalog directly: ${school.catalogUrl}

# EXTRACT THE FOLLOWING

## 1. Program Overview
- Total credits required for the degree
- Typical time to completion
- Any special requirements (co-op, capstone, thesis)

## 2. Required Core Courses
For each course extract (ONLY courses you find in search results):
- Course code (e.g., "CS 1800") - MUST exist in current catalog
- Course name (EXACT text from catalog, no paraphrasing, no "(Placeholder)")
- Credits
- Prerequisites (if any)
- Typical semester taken

**IMPORTANT:** Only include courses you verified through search. Do NOT invent courses.

## 3. Elective Requirements
- Number of electives needed in each category
- Approved course lists or criteria
- Credit requirements per category

## 4. General Education / Distribution Requirements
- Core curriculum requirements (e.g., NUpath at Northeastern)
- Writing requirements
- Math/Science requirements
- Humanities/Social Science requirements

## 5. Concentration/Minor Requirements (if applicable)
- Additional required courses
- Additional electives
- Total additional credits
${
  concentration
    ? `\n- Specific requirements for ${concentration} concentration`
    : ""
}
${minor ? `\n- Specific requirements for ${minor} minor` : ""}

# OUTPUT FORMAT
Return ONLY a JSON object (no markdown fences, no explanation):

{
  "school": "${school.name}",
  "major": "${major}",
  "catalogYear": "${currentYear}-${currentYear + 1}",
  "totalCreditsRequired": 128,
  "estimatedSemesters": 8,
  "coreCourses": [
    {
      "code": "CS 1800",
      "name": "Discrete Structures",
      "credits": 4,
      "prerequisites": [],
      "typicalSemester": 1
    }
  ],
  "electiveCategories": [
    {
      "name": "Concentration Elective",
      "creditsRequired": 16,
      "coursesRequired": 4,
      "approvedCourses": ["CS 4100", "CS 4400", "CS 4500"]
    }
  ],
  "generalEducation": [
    {
      "category": "Writing",
      "creditsRequired": 8,
      "courses": ["ENGW 1111", "ENGW 3302"]
    }
  ],
  "specialRequirements": {
    "coopRequired": true,
    "coopCount": 3,
    "capstoneRequired": true,
    "capstoneCredits": 4
  },
  "warnings": ["Verify current availability with advisor"],
  "sourceUrl": "${school.catalogUrl}/path/to/requirements"
}

# ANTI-HALLUCINATION RULES (CRITICAL)
1. **ONLY include courses that EXIST in the current catalog.** Do NOT invent or guess course codes.
2. **Course names must be EXACT** as they appear in the catalog. Do NOT paraphrase or add "(Placeholder)".
3. **If you cannot find a course**, do NOT include it. Only report courses you verified through search.
4. **NEVER include "(Placeholder)", "TBD", or made-up text** in any course name.
5. **Every course code in coreCourses must come from your search results.**

# VALIDATION
Your response is INVALID if:
- [ ] Any course code was invented without search verification
- [ ] Any course name contains "(Placeholder)" or similar made-up text
- [ ] Any course code cannot be found in the current catalog
- [ ] Total credits don't match catalog requirements
- [ ] Missing required sections (coreCourses, electiveCategories, generalEducation)
- [ ] Output is not valid JSON
- [ ] Output includes markdown fences or explanation text`;
}

/**
 * Build a simpler course verification prompt
 * @param {Object} context
 * @param {School} context.school
 * @param {string[]} context.courseCodes - List of course codes to verify
 * @returns {string}
 */
export function buildCourseVerificationPrompt(context) {
  const { school, courseCodes } = context;
  const currentYear = new Date().getFullYear();

  return `# TASK
Verify that the following courses exist in the current ${
    school.name
  } catalog (${currentYear}-${currentYear + 1}).

# COURSES TO VERIFY
${courseCodes.map((code) => `- ${code}`).join("\n")}

# FOR EACH COURSE
Search ${school.catalogUrl} and verify:
1. The course code exists
2. The course is currently offered (not discontinued)
3. The course is available to undergraduates
4. The correct credit value

# OUTPUT FORMAT
Return ONLY a JSON object:

{
  "verified": [
    {"code": "CS 1800", "name": "Discrete Structures", "credits": 4, "status": "active"}
  ],
  "notFound": [
    {"code": "CS 9999", "reason": "Course code does not exist in catalog"}
  ],
  "discontinued": [
    {"code": "CS 2500", "replacement": "CS 2000", "reason": "Curriculum restructured in 2024"}
  ]
}`;
}
