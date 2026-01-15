/**
 * Prompts for the transcript-based schedule completion pipeline.
 *
 * This module is SEPARATE from generate_prompt.js because completing a schedule
 * for a student with existing coursework is fundamentally different from
 * generating a fresh schedule.
 *
 * KEY PRINCIPLES:
 * 1. Completed courses are IMMUTABLE - never modified, validated, or questioned
 * 2. Discontinued courses are OK - universities honor courses from previous catalogs
 * 3. Current catalog is only used for FUTURE semesters
 * 4. Trust the transcript completely - if it's on the transcript, it counts
 */

/**
 * @typedef {Object} CompletedCourse
 * @property {string} code
 * @property {string} name
 * @property {number} credits
 * @property {string} [grade]
 */

/**
 * @typedef {Object} CompletedSemesterData
 * @property {string} term
 * @property {CompletedCourse[]} courses
 * @property {number} totalCredits
 */

/**
 * @typedef {Object} TranscriptData
 * @property {CompletedSemesterData[]} completedSemesters
 * @property {CompletedCourse[]} transferCredits
 * @property {number} totalCompletedCredits
 * @property {number} totalTransferCredits
 * @property {string|null} lastCompletedTerm
 * @property {string|null} nextSemester
 */

/**
 * @typedef {Object} School
 * @property {string} id
 * @property {string} name
 * @property {string} catalogUrl
 */

/**
 * @typedef {Object} CompletionContext
 * @property {School} school
 * @property {string} major
 * @property {TranscriptData} transcriptData
 * @property {Object} preferences
 * @property {string} preferences.startingSemester
 * @property {'light' | 'standard' | 'accelerated'} preferences.creditsPerSemester
 * @property {'none' | 'one' | 'two' | 'three'} preferences.coopPlan
 * @property {string} [preferences.additionalNotes]
 * @property {ExtractedRequirements} [extractedRequirements]
 */

/** Credit load configuration */
const CREDIT_LOAD_CONFIG = {
  light: { min: 12, max: 14, description: "12-14 credits" },
  standard: { min: 15, max: 17, description: "15-17 credits" },
  accelerated: { min: 17, max: 19, description: "17-19 credits" },
};

/** Co-op count mapping */
const COOP_COUNT_MAP = {
  none: 0,
  one: 1,
  two: 2,
  three: 3,
};

/**
 * Format completed semesters for the prompt (read-only display)
 * @param {TranscriptData} transcriptData
 * @returns {string}
 */
function formatCompletedSemesters(transcriptData) {
  const sections = [];

  // Summary stats
  const totalCredits =
    transcriptData.totalCompletedCredits + transcriptData.totalTransferCredits;

  sections.push(`## Completed Coursework Summary
- **Semesters Completed:** ${transcriptData.completedSemesters.length}
- **Credits from Courses:** ${transcriptData.totalCompletedCredits}
- **AP/Transfer Credits:** ${transcriptData.totalTransferCredits}
- **Total Credits Earned:** ${totalCredits}`);

  // List each completed semester
  if (transcriptData.completedSemesters.length > 0) {
    const semestersList = transcriptData.completedSemesters
      .map((sem) => {
        const courses = sem.courses
          .map((c) => `  - ${c.code}: ${c.name} (${c.credits} cr)`)
          .join("\n");
        return `### ${sem.term} — ${sem.totalCredits} credits
${courses}`;
      })
      .join("\n\n");

    sections.push(`## Completed Semesters (IMMUTABLE)
${semestersList}`);
  }

  // List transfer/AP credits
  if (transcriptData.transferCredits.length > 0) {
    const transferList = transcriptData.transferCredits
      .map((c) => `- ${c.code}: ${c.name} (${c.credits} cr)`)
      .join("\n");

    sections.push(`## AP & Transfer Credits (${transcriptData.totalTransferCredits} credits)
${transferList}`);
  }

  return sections.join("\n\n");
}

/**
 * Build a list of all completed course codes for duplicate prevention
 * @param {TranscriptData} transcriptData
 * @returns {string[]}
 */
function getCompletedCourseCodes(transcriptData) {
  const codes = new Set();

  for (const sem of transcriptData.completedSemesters) {
    for (const course of sem.courses) {
      codes.add(course.code);
    }
  }

  for (const course of transcriptData.transferCredits) {
    codes.add(course.code);
  }

  return Array.from(codes);
}

/**
 * Generate a list of semesters from a starting semester to graduation
 * @param {string} startingSemester - e.g., "Fall 2025"
 * @param {number} gradYear - e.g., 2027
 * @param {number} coopCount - number of co-ops to include
 * @returns {string[]} - list of semesters like ["Fall 2025", "Spring 2026", ...]
 */
function generateSemesterList(startingSemester, gradYear, coopCount) {
  const semesters = [];
  const startMatch = startingSemester.match(/(Fall|Spring)\s+(\d{4})/i);
  if (!startMatch) return ["(Unable to parse starting semester)"];
  
  let currentSeason = startMatch[1];
  let currentYear = parseInt(startMatch[2]);
  
  // Generate semesters until we reach Spring of graduation year
  while (true) {
    semesters.push(`${currentSeason} ${currentYear}`);
    
    // Stop after reaching Spring of grad year
    if (currentSeason === "Spring" && currentYear === gradYear) {
      break;
    }
    
    // Move to next semester
    if (currentSeason === "Fall") {
      currentSeason = "Spring";
      currentYear++;
    } else {
      currentSeason = "Fall";
    }
    
    // Safety limit
    if (semesters.length > 12) break;
  }
  
  return semesters;
}

/**
 * @typedef {Object} SemesterPattern
 * @property {number} avgCreditsPerSemester - Average credits in Fall/Spring semesters
 * @property {number} avgMainCoursesPerSemester - Average number of main courses (3+ credits)
 * @property {number} typicalMainCourseCredits - Most common credit value for main courses
 * @property {number} minMainCourses - Minimum main courses seen in any semester
 * @property {Array<{term: string, totalCredits: number, mainCourseCount: number}>} sampleSemesters
 */

/**
 * Analyze the student's completed semesters to extract their typical pattern.
 * This makes the prompt school-agnostic by learning from the student's actual history.
 * 
 * @param {TranscriptData} transcriptData
 * @returns {SemesterPattern|null}
 */
function analyzeSemesterPattern(transcriptData) {
  // Filter to Fall/Spring semesters only (exclude summer which are typically lighter)
  const regularSemesters = transcriptData.completedSemesters.filter(
    (sem) => sem.term.match(/^(Fall|Spring)/i)
  );

  if (regularSemesters.length === 0) return null;

  // For each semester, count "main" courses (credits >= 3)
  const stats = regularSemesters.map((sem) => {
    const mainCourses = sem.courses.filter((c) => c.credits >= 3);
    return {
      term: sem.term,
      totalCredits: sem.totalCredits,
      mainCourseCount: mainCourses.length,
      totalCourses: sem.courses.length,
    };
  });

  // Calculate averages
  const avgCredits = Math.round(
    stats.reduce((sum, s) => sum + s.totalCredits, 0) / stats.length
  );
  const avgMainCourses = Math.round(
    stats.reduce((sum, s) => sum + s.mainCourseCount, 0) / stats.length
  );
  const minMainCourses = Math.min(...stats.map((s) => s.mainCourseCount));

  // Find the most common credit value for main courses (school-specific)
  const creditCounts = new Map();
  for (const sem of regularSemesters) {
    for (const c of sem.courses) {
      if (c.credits >= 3) {
        creditCounts.set(c.credits, (creditCounts.get(c.credits) || 0) + 1);
      }
    }
  }
  const typicalMainCourseCredits =
    [...creditCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 4;

  return {
    avgCreditsPerSemester: avgCredits,
    avgMainCoursesPerSemester: avgMainCourses,
    typicalMainCourseCredits,
    minMainCourses: Math.max(3, minMainCourses), // At least 3 for full-time
    sampleSemesters: stats.slice(-3), // Last 3 semesters as reference
  };
}

/**
 * Format the semester pattern analysis for the prompt
 * @param {SemesterPattern|null} pattern
 * @returns {string}
 */
function formatSemesterPattern(pattern) {
  if (!pattern) {
    return `
# FULL-TIME REQUIREMENTS
Each planned semester should have:
- At least 4 main courses (3+ credits each)
- 15-17 total credits
- Labs/seminars (1-2 credits) are additional
`;
  }

  const sampleList = pattern.sampleSemesters
    .map(
      (s) => `- ${s.term}: ${s.mainCourseCount} main courses, ${s.totalCredits} credits`
    )
    .join("\n");

  return `
# STUDENT'S SEMESTER PATTERN (MATCH THIS - CRITICAL)
Based on your completed Fall/Spring semesters, you typically take:
- **${pattern.avgCreditsPerSemester} credits per semester**
- **${pattern.avgMainCoursesPerSemester} main courses** (${pattern.typicalMainCourseCredits}+ credits each)
- Labs and seminars (1-2 credits) are additional

## Your Recent Semesters as Reference:
${sampleList}

**CRITICAL REQUIREMENTS FOR PLANNED SEMESTERS:**
1. Each planned semester MUST have at least ${pattern.minMainCourses} main courses (${pattern.typicalMainCourseCredits}+ credits each)
2. Each planned semester MUST have ${pattern.avgCreditsPerSemester - 2}-${pattern.avgCreditsPerSemester + 2} total credits
3. DO NOT generate light semesters with only 2-3 courses or 10-12 credits
4. MATCH the student's established pattern shown above
`;
}

/**
 * Build the completion pipeline instructions.
 *
 * This prompt is designed for students who have already completed some coursework.
 * It focuses on gap analysis and generating only the REMAINING semesters.
 *
 * @param {CompletionContext} context
 * @returns {string}
 */
export function buildCompletionInstructions(context) {
  const { school, major, transcriptData, preferences, extractedRequirements } =
    context;

  const currentYear = new Date().getFullYear();
  const totalCoopsRequested = COOP_COUNT_MAP[preferences.coopPlan] || 0;
  const completedCoops = transcriptData.completedCoops || 0;
  const remainingCoops = Math.max(0, totalCoopsRequested - completedCoops);
  const creditLoad =
    CREDIT_LOAD_CONFIG[preferences.creditsPerSemester] ||
    CREDIT_LOAD_CONFIG.standard;

  // Calculate what's been completed vs what's needed
  const completedCredits =
    transcriptData.totalCompletedCredits + transcriptData.totalTransferCredits;
  const degreeCredits = extractedRequirements?.totalCreditsRequired || 128;
  const remainingCredits = Math.max(0, degreeCredits - completedCredits);

  // Estimate remaining semesters
  const completedAcademicSemesters = transcriptData.completedSemesters.length;
  const totalAcademicSemesters = 8;
  const remainingAcademicSemesters = Math.max(
    1,
    totalAcademicSemesters - completedAcademicSemesters
  );
  // Use remaining co-ops (total requested minus already completed)
  const remainingSemestersWithCoop = remainingAcademicSemesters + remainingCoops;

  // Calculate graduation year from starting semester
  const startYear = parseInt(
    preferences.startingSemester.match(/\d{4}/)?.[0] || String(currentYear)
  );
  const gradYear =
    startYear +
    Math.ceil(remainingAcademicSemesters / 2) +
    Math.floor(remainingCoops / 2);

  // Generate explicit list of semesters to create (using remaining co-ops)
  const semesterList = generateSemesterList(
    preferences.startingSemester,
    gradYear,
    remainingCoops
  );

  // Format completed courses for display
  const completedSection = formatCompletedSemesters(transcriptData);
  const completedCodes = getCompletedCourseCodes(transcriptData);

  // Analyze the student's semester pattern to make requirements school-agnostic
  const semesterPattern = analyzeSemesterPattern(transcriptData);
  const patternSection = formatSemesterPattern(semesterPattern);

  // Build the core course list from requirements if available
  let remainingRequirementsSection = "";
  if (extractedRequirements) {
    // Filter out courses that have already been completed
    const remainingCore = (extractedRequirements.coreCourses || []).filter(
      (c) => !completedCodes.includes(c.code)
    );

    if (remainingCore.length > 0) {
      const coreList = remainingCore
        .map(
          (c) =>
            `- ${c.code}: ${c.name} (${c.credits} cr)${
              c.prerequisites?.length
                ? ` [prereqs: ${c.prerequisites.join(", ")}]`
                : ""
            }`
        )
        .join("\n");

      remainingRequirementsSection = `
## Remaining Core Courses (from catalog research)
${coreList}

## Elective Categories Still Needed
${(extractedRequirements.electiveCategories || [])
  .map((e) => `- ${e.name}: ${e.creditsRequired} credits`)
  .join("\n")}
`;
    }
  }

  // Build co-op description for the prompt
  let coopDescription = `${remainingCoops} remaining`;
  if (completedCoops > 0) {
    coopDescription += ` (${completedCoops} already completed, ${totalCoopsRequested} total)`;
  }
  if (remainingCoops > 0) {
    coopDescription += " - each occupies one full semester";
  }

  return `# ROLE
You are an academic advisor completing a degree plan for a continuing ${major} student at ${school.name}.

# ⚠️ CRITICAL: COMPLETE SCHEDULE REQUIRED ⚠️
You MUST generate a COMPLETE schedule with ALL ${semesterList.length} remaining semesters.
- First semester: ${preferences.startingSemester}
- Last semester: Spring ${gradYear} (GRADUATION)
- Total semesters to generate: ${semesterList.length}

**AN INCOMPLETE SCHEDULE IS INVALID.** If you generate fewer than ${semesterList.length} semesters, the output is WRONG.
**DO NOT STOP EARLY.** Generate every semester from ${preferences.startingSemester} through Spring ${gradYear}.

# CRITICAL: DO NOT MODIFY PAST COURSES
The completed courses listed below are FINAL and IMMUTABLE:
- These courses may use OLD course codes that NO LONGER EXIST in the current catalog
- This is NORMAL — universities honor courses taken under previous catalog years
- DO NOT try to validate, update, or question any completed course
- DO NOT try to find replacements for "discontinued" courses
- Treat ALL completed courses as fulfilled requirements, no matter what

Your ONLY job is to generate the REMAINING semesters using the CURRENT catalog.

# COMPLETED COURSEWORK (READ-ONLY — DO NOT CHANGE)
${completedSection}

**These ${completedCredits} credits are ALREADY DONE. Do not include them in your output.**
${remainingRequirementsSection}
# TASK: COMPLETE THE DEGREE

The student has ${completedCredits} credits. They need ${remainingCredits} more credits to graduate.

Generate ONLY the remaining ${remainingSemestersWithCoop} semesters:
- ${remainingAcademicSemesters} academic semesters
- ${remainingCoops} co-op semester(s)${completedCoops > 0 ? ` (${completedCoops} already completed)` : ""}
- Starting from: ${preferences.startingSemester}
- Target graduation: Spring ${gradYear}

# SEMESTERS YOU MUST GENERATE (ALL OF THESE - DO NOT SKIP ANY)
${semesterList.map((sem, i) => `${i + 1}. ${sem} (academic)`).join("\n")}

**CRITICAL: You MUST generate ALL ${semesterList.length} semesters listed above.**
**The LAST semester MUST be Spring ${gradYear}. Do NOT stop before reaching graduation.**

# STUDENT PREFERENCES
- Credit load: ${creditLoad.description}
- Co-ops: ${coopDescription}
${preferences.additionalNotes ? `- Notes: ${preferences.additionalNotes}` : ""}
${patternSection}
# MANDATORY SEARCH REQUIREMENT
**YOU MUST SEARCH** for the degree requirements before generating ANY schedule. Do NOT rely on training data.
1. Search for "${school.name} ${major} degree requirements" and "${school.name} ${major} curriculum"
2. Find the EXACT required courses with their REAL course codes (e.g., CS 3650, CS 4530, MATH 2341)
3. Use those EXACT codes in your output - do NOT paraphrase or generalize

# COURSE CODE RULES (CRITICAL)
1. **REQUIRED COURSES must have SPECIFIC codes.** Core CS courses, math courses, writing courses - these are NOT electives. Find and use their exact codes.
2. **ELECTIVE is ONLY for true elective categories** where students choose from multiple options (e.g., "Science with Lab", "General Education", "Concentration Elective").
3. **NEVER use ELECTIVE for required core courses.** If a course is required for all students, find its code.
4. **NEVER include "(Placeholder)", "TBD", or vague names.** Every course must have its REAL catalog name.
5. **NEVER invent course codes.** Every code must come from your search results.

# CONSTRAINTS
1. **No duplicates.** Never include any course from the completed list:
   ${completedCodes.slice(0, 20).join(", ")}${completedCodes.length > 20 ? "..." : ""}

2. **Prerequisites satisfied.** Completed courses count as fulfilled prerequisites.

3. **Use ${currentYear}-${currentYear + 1} catalog for NEW courses only.**
   Search to verify course codes exist BEFORE including them.

4. **FULL-TIME STATUS: MINIMUM ${semesterPattern?.minMainCourses || 4} main courses per semester.**
   - Main courses are ${semesterPattern?.typicalMainCourseCredits || 4}+ credits each
   - Labs (1-2cr) do NOT count toward this minimum
   - Target: ${semesterPattern?.avgCreditsPerSemester || 16} credits per semester (match student's pattern)

5. **Total new credits ≈ ${remainingCredits}** to complete the ${degreeCredits}-credit degree.

# SEARCH PROCESS
1. Search: "${school.name} ${major} degree requirements ${currentYear}"
2. Compare requirements against the completed courses above
3. Identify what's still needed (unfulfilled requirements)
4. Generate remaining semesters using CURRENT course codes
5. Stop when reaching ~${remainingCredits} credits

# OUTPUT FORMAT
Return ONLY valid JSON. No markdown, no explanation.

**YOU MUST INCLUDE ALL ${remainingSemestersWithCoop} SEMESTERS** - from ${preferences.startingSemester} through Spring ${gradYear}.

{
  "school": "${school.name}",
  "major": "${major}",
  "degree": "BS",
  "startTerm": "${preferences.startingSemester}",
  "graduationTerm": "Spring ${gradYear}",
  "totalCredits": ${remainingCredits},
  "catalogVerified": true,
  "semesters": [
    {
      "term": "${preferences.startingSemester}",
      "type": "academic",
      "status": "planned",
      "courses": [
        {"code": "CS 4530", "name": "Fundamentals of Software Engineering", "credits": 4},
        {"code": "CS 4410", "name": "Compilers", "credits": 4},
        {"code": "ENGW 3302", "name": "Advanced Writing", "credits": 4},
        {"code": "ELECTIVE", "name": "Concentration Elective", "credits": 4, "options": "CS 4100, CS 4400"}
      ],
      "totalCredits": 16
    },${remainingCoops > 0 ? `
    {
      "term": "Summer 2027",
      "type": "coop",
      "coopNumber": 1
    },` : ""}
    {
      "term": "Spring ${gradYear}",
      "type": "academic",
      "status": "planned",
      "courses": [
        {"code": "CS 4500", "name": "Software Development", "credits": 4},
        {"code": "ELECTIVE", "name": "CS Elective", "credits": 4, "options": "CS 4120, CS 4610"},
        {"code": "ELECTIVE", "name": "General Elective", "credits": 4},
        {"code": "ELECTIVE", "name": "General Elective", "credits": 4}
      ],
      "totalCredits": 16
    }
  ],
  "warnings": [],
  "sourceUrl": "${school.catalogUrl}"
}

${remainingCoops > 0 ? `## CO-OP SEMESTERS
You must include ${remainingCoops} co-op semester(s) in the schedule.
Co-op format: {"term": "Summer 2027", "type": "coop", "coopNumber": N}
- Co-ops are FULL-TIME WORK with ZERO courses
- Typically placed in Summer or Fall/Spring before final year
- Number them sequentially starting from ${completedCoops + 1}
` : ""}

**CRITICAL: This example shows MULTIPLE semesters. You MUST generate ALL ${remainingSemestersWithCoop} semesters, not just one!**
**The final semester MUST be Spring ${gradYear}. Do NOT stop early.**

# VALIDATION BEFORE OUTPUT
Check that:
- ✅ ALL ${semesterList.length} semesters are present (count them: ${semesterList.join(", ")})
- ✅ Final semester is Spring ${gradYear} (graduation semester)
- ✅ No empty academic semesters (each must have ${semesterPattern?.minMainCourses || 4}+ main courses)
- ✅ Total credits across all new semesters ≈ ${remainingCredits}
- ✅ Each semester has ${semesterPattern?.avgCreditsPerSemester || 16} credits (matching student's pattern)
- ❌ No course name contains "(Placeholder)", "TBD", or made-up text
- ❌ No course code was invented without search verification
- ❌ No completed course code appears in output
- ❌ Any course codes not verified from the CURRENT catalog
- ❌ Any semester has FEWER than ${semesterPattern?.minMainCourses || 4} main courses (labs don't count!)
- ❌ Any semester has < ${(semesterPattern?.avgCreditsPerSemester || 16) - 4} credits (except final semester)
- ❌ Fewer than ${semesterList.length} semesters generated (INCOMPLETE SCHEDULE)
- ❌ JSON is invalid or contains markdown fences

**COUNT YOUR SEMESTERS: You must have exactly ${semesterList.length} semesters in the output.**
**FULL-TIME STATUS: Each semester needs ${semesterPattern?.minMainCourses || 4}+ main courses of ${semesterPattern?.typicalMainCourseCredits || 4}+ credits each.**`;
}

/**
 * Build a lightweight requirements check prompt for completion mode.
 *
 * This is a simpler version that focuses on verifying what requirements
 * remain after accounting for completed courses.
 *
 * @param {CompletionContext} context
 * @returns {string}
 */
export function buildRequirementsCheckPrompt(context) {
  const { school, major, transcriptData } = context;
  const currentYear = new Date().getFullYear();

  const completedSection = formatCompletedSemesters(transcriptData);
  const completedCodes = getCompletedCourseCodes(transcriptData);
  const completedCredits =
    transcriptData.totalCompletedCredits + transcriptData.totalTransferCredits;

  return `# TASK: Analyze Remaining Degree Requirements

You are analyzing what a ${major} student at ${school.name} still needs to graduate.

# COMPLETED COURSES (${completedCredits} credits)
${completedSection}

**Course codes already taken:** ${completedCodes.join(", ")}

# INSTRUCTIONS
1. Search "${school.name} ${major} degree requirements ${currentYear}"
2. Find the total credits required for the degree
3. Compare requirements against the completed courses above
4. Identify which requirements are NOT yet satisfied

# IMPORTANT
- Some completed courses may use OLD course codes that don't exist anymore
- This is NORMAL — the student took them under a previous catalog
- Count them as fulfilled even if you can't find them in the current catalog
- Focus on what's MISSING, not validating what's done

# ANTI-HALLUCINATION RULES
1. **ONLY include courses that EXIST in the current catalog.** Do NOT invent or guess course codes.
2. **Course codes in "coursesNeeded" must be REAL** - verified from your search results.
3. **NEVER include "(Placeholder)" or made-up course names.**

# OUTPUT FORMAT
Return ONLY valid JSON:

{
  "school": "${school.name}",
  "major": "${major}",
  "catalogYear": "${currentYear}-${currentYear + 1}",
  "totalCreditsRequired": 128,
  "creditsCompleted": ${completedCredits},
  "creditsRemaining": 0,
  "remainingRequirements": [
    {
      "category": "Core Courses",
      "coursesNeeded": ["CS 3650", "CS 4530"],
      "creditsNeeded": 8
    },
    {
      "category": "Electives",
      "description": "Major electives",
      "creditsNeeded": 12
    }
  ],
  "warnings": [],
  "sourceUrl": "${school.catalogUrl}"
}`;
}

/**
 * Get the estimated number of remaining semesters
 * @param {TranscriptData} transcriptData
 * @param {string} coopPlan
 * @returns {number}
 */
export function getRemainingExpectedSemesters(transcriptData, coopPlan) {
  const coopCount = COOP_COUNT_MAP[coopPlan] || 0;
  const completedSemesters = transcriptData.completedSemesters.length;
  const totalAcademic = 8;
  const remainingAcademic = Math.max(1, totalAcademic - completedSemesters);
  return remainingAcademic + coopCount;
}
