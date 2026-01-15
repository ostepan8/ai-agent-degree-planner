import { NextRequest } from "next/server";
import { getSchedule, getStudentContext } from "@/lib/scheduleStore";
import type { SchedulePlan, StudentContext } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
  };
  request_id?: string;
  scheduleId?: string;
}

interface ValidationIssue {
  type: "credits" | "placeholder" | "duplicate" | "empty" | "format" | "info";
  severity: "error" | "warning" | "info";
  message: string;
  details?: string;
}

interface LocalChecks {
  credits: {
    status: "ok" | "under" | "over" | "way_over";
    current: number;
    target: number;
    difference: number;
  };
  placeholders: {
    count: number;
    courses: string[];
  };
  duplicates: string[];
  emptySemesters: string[];
  invalidCodes: string[];
}

interface RequiredSearch {
  query: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

// ============================================
// UNIVERSAL CHECKS (Work for any school)
// ============================================

// Check credit requirements
function checkCredits(schedule: SchedulePlan): {
  issues: ValidationIssue[];
  status: LocalChecks["credits"];
} {
  const issues: ValidationIssue[] = [];

  let calculatedTotal = 0;
  for (const sem of schedule.semesters) {
    if (sem.type === "academic") {
      calculatedTotal += sem.totalCredits || 0;
    }
  }

  const target = schedule.totalCredits;
  const difference = calculatedTotal - target;
  let status: LocalChecks["credits"]["status"] = "ok";

  if (calculatedTotal < target) {
    status = "under";
    issues.push({
      type: "credits",
      severity: "error",
      message: `Under-credited: ${calculatedTotal}/${target} credits`,
      details: `Missing ${target - calculatedTotal} credits`,
    });
  } else if (calculatedTotal > target + 8) {
    status = "way_over";
    issues.push({
      type: "credits",
      severity: "error",
      message: `OVER-CREDITED: ${calculatedTotal}/${target} credits`,
      details: `Remove ${difference} excess credits. Do NOT add more courses.`,
    });
  } else if (calculatedTotal > target) {
    status = "over";
    issues.push({
      type: "credits",
      severity: "warning",
      message: `Slightly over: ${calculatedTotal}/${target} credits`,
      details: `${difference} credits over target`,
    });
  }

  // Check individual semester loads (universal 12-20 range)
  for (const sem of schedule.semesters) {
    if (sem.type === "academic") {
      const credits = sem.totalCredits || 0;
      if (credits < 12) {
        issues.push({
          type: "credits",
          severity: "warning",
          message: `${sem.term}: Only ${credits} credits (below 12)`,
        });
      }
      if (credits > 20) {
        issues.push({
          type: "credits",
          severity: "warning",
          message: `${sem.term}: ${credits} credits (above 20)`,
        });
      }
    }
  }

  return {
    issues,
    status: { status, current: calculatedTotal, target, difference },
  };
}

// Detect placeholder courses (universal patterns)
function detectPlaceholders(schedule: SchedulePlan): {
  issues: ValidationIssue[];
  placeholders: LocalChecks["placeholders"];
} {
  const issues: ValidationIssue[] = [];
  const placeholderCourses: string[] = [];

  // Universal patterns that indicate incomplete/placeholder courses
  const placeholderPatterns = [
    /^ELECTIVE$/i,
    /elective$/i, // "CS ELECTIVE", "Free Elective"
    /^TBD$/i,
    /^TBA$/i,
    /placeholder/i,
    /to be determined/i,
    /to be announced/i,
    /^CHOOSE\s/i,
    /^SELECT\s/i,
  ];

  for (const sem of schedule.semesters) {
    if (sem.type === "academic" && sem.courses) {
      for (const course of sem.courses) {
        const isPlaceholder =
          placeholderPatterns.some(
            (p) => p.test(course.code) || p.test(course.name)
          ) || course.code.includes("ELECTIVE");

        if (isPlaceholder) {
          placeholderCourses.push(
            `${course.code}: ${course.name} (${sem.term})`
          );
        }
      }
    }
  }

  if (placeholderCourses.length > 0) {
    issues.push({
      type: "placeholder",
      severity: "warning",
      message: `${placeholderCourses.length} placeholder course(s) need real course codes`,
      details: `Replace these with actual courses: ${placeholderCourses
        .slice(0, 3)
        .join(", ")}${placeholderCourses.length > 3 ? "..." : ""}`,
    });
  }

  return {
    issues,
    placeholders: {
      count: placeholderCourses.length,
      courses: placeholderCourses,
    },
  };
}

// Detect duplicate courses
function detectDuplicates(schedule: SchedulePlan): {
  issues: ValidationIssue[];
  duplicates: string[];
} {
  const issues: ValidationIssue[] = [];
  const courseCounts: Map<string, string[]> = new Map();

  for (const sem of schedule.semesters) {
    if (sem.type === "academic" && sem.courses) {
      for (const course of sem.courses) {
        // Skip placeholder codes
        if (course.code.includes("ELECTIVE") || course.code === "TBD") continue;

        const existing = courseCounts.get(course.code) || [];
        existing.push(sem.term);
        courseCounts.set(course.code, existing);
      }
    }
  }

  const duplicates: string[] = [];
  courseCounts.forEach((terms, code) => {
    if (terms.length > 1) {
      duplicates.push(`${code} (in ${terms.join(", ")})`);
    }
  });

  if (duplicates.length > 0) {
    issues.push({
      type: "duplicate",
      severity: "warning",
      message: `${duplicates.length} course(s) appear multiple times`,
      details: duplicates.join("; "),
    });
  }

  return { issues, duplicates };
}

// Detect empty academic semesters
function detectEmptySemesters(schedule: SchedulePlan): {
  issues: ValidationIssue[];
  emptySemesters: string[];
} {
  const issues: ValidationIssue[] = [];
  const emptySemesters: string[] = [];

  for (const sem of schedule.semesters) {
    if (sem.type === "academic") {
      const courseCount = sem.courses?.length || 0;
      if (courseCount === 0) {
        emptySemesters.push(sem.term);
      }
    }
  }

  if (emptySemesters.length > 0) {
    issues.push({
      type: "empty",
      severity: "error",
      message: `${emptySemesters.length} academic semester(s) have no courses`,
      details: emptySemesters.join(", "),
    });
  }

  return { issues, emptySemesters };
}

// Validate course code format (universal pattern: SUBJ 1234)
function validateCodeFormats(schedule: SchedulePlan): {
  issues: ValidationIssue[];
  invalidCodes: string[];
} {
  const issues: ValidationIssue[] = [];
  const invalidCodes: string[] = [];

  // Most universities use: SUBJ 1234, SUBJ1234, or SUBJ 1234A
  const validCodePattern = /^[A-Z]{2,5}\s?\d{3,4}[A-Z]?$/i;

  // Skip these patterns (they're placeholders, not invalid)
  const skipPatterns = [/ELECTIVE/i, /^TBD$/i, /^TBA$/i];

  for (const sem of schedule.semesters) {
    if (sem.type === "academic" && sem.courses) {
      for (const course of sem.courses) {
        const shouldSkip = skipPatterns.some((p) => p.test(course.code));
        if (shouldSkip) continue;

        if (!validCodePattern.test(course.code)) {
          invalidCodes.push(`${course.code} (${sem.term})`);
        }
      }
    }
  }

  if (invalidCodes.length > 0) {
    issues.push({
      type: "format",
      severity: "warning",
      message: `${invalidCodes.length} course code(s) may be invalid`,
      details: invalidCodes.join(", "),
    });
  }

  return { issues, invalidCodes };
}

// Build required searches based on student context
function buildRequiredSearches(
  schedule: SchedulePlan,
  studentContext: StudentContext | null,
  localChecks: LocalChecks
): RequiredSearch[] {
  const searches: RequiredSearch[] = [];
  const school = schedule.school;
  const major = schedule.major;
  const degree = schedule.degree;
  const catalogYear = studentContext?.catalogYear || "";

  // First, suggest checking for curriculum updates
  const currentYear = new Date().getFullYear();
  searches.push({
    query: `${school} ${major} current curriculum ${currentYear} course requirements`,
    reason:
      "Check for curriculum changes - courses may have been updated or replaced",
    priority: "high",
  });

  // Then verify major requirements
  searches.push({
    query:
      `${school} ${major} ${degree} degree requirements ${catalogYear}`.trim(),
    reason: "Verify all major requirements are scheduled",
    priority: "high",
  });

  // If concentration is set, search for concentration requirements
  if (studentContext?.concentration) {
    searches.push({
      query: `${school} ${major} ${studentContext.concentration} concentration requirements`,
      reason: `Verify ${studentContext.concentration} concentration courses are scheduled`,
      priority: "high",
    });
  }

  // If minor is set, search for minor requirements
  if (studentContext?.minor) {
    searches.push({
      query: `${school} ${studentContext.minor} minor requirements courses`,
      reason: `Verify ${studentContext.minor} minor courses are scheduled`,
      priority: "high",
    });
  }

  // If there are placeholders, suggest course searches
  if (localChecks.placeholders.count > 0) {
    searches.push({
      query: `${school} ${major} elective courses recommendations`,
      reason: `Find real courses to replace ${localChecks.placeholders.count} placeholder(s)`,
      priority: "medium",
    });
  }

  // General education / core requirements
  searches.push({
    query:
      `${school} general education core requirements ${catalogYear}`.trim(),
    reason: "Verify general education requirements are met",
    priority: "medium",
  });

  return searches;
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  console.log("\n========================================");
  console.log("=== TOOL: validate-schedule called ===");
  console.log("========================================");

  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log("Request body:", JSON.stringify(body, null, 2));

    const scheduleId = body.parameters?.scheduleId || body.scheduleId;

    if (!scheduleId) {
      return Response.json(
        { success: false, message: "scheduleId is required" },
        { status: 400 }
      );
    }

    const schedule = getSchedule(scheduleId);
    if (!schedule) {
      return Response.json(
        { success: false, message: "Schedule not found or expired" },
        { status: 404 }
      );
    }

    const studentContext = getStudentContext(scheduleId);

    // Run all local checks
    const allIssues: ValidationIssue[] = [];
    const checksPerformed: string[] = [];

    // 1. Credit check
    console.log("Checking credits...");
    checksPerformed.push("Credit requirements");
    const creditResult = checkCredits(schedule);
    allIssues.push(...creditResult.issues);

    // 2. Placeholder detection
    console.log("Detecting placeholders...");
    checksPerformed.push("Placeholder detection");
    const placeholderResult = detectPlaceholders(schedule);
    allIssues.push(...placeholderResult.issues);

    // 3. Duplicate detection
    console.log("Detecting duplicates...");
    checksPerformed.push("Duplicate detection");
    const duplicateResult = detectDuplicates(schedule);
    allIssues.push(...duplicateResult.issues);

    // 4. Empty semester detection
    console.log("Detecting empty semesters...");
    checksPerformed.push("Empty semester detection");
    const emptyResult = detectEmptySemesters(schedule);
    allIssues.push(...emptyResult.issues);

    // 5. Code format validation
    console.log("Validating course codes...");
    checksPerformed.push("Course code format");
    const formatResult = validateCodeFormats(schedule);
    allIssues.push(...formatResult.issues);

    // Build local checks summary
    const localChecks: LocalChecks = {
      credits: creditResult.status,
      placeholders: placeholderResult.placeholders,
      duplicates: duplicateResult.duplicates,
      emptySemesters: emptyResult.emptySemesters,
      invalidCodes: formatResult.invalidCodes,
    };

    // Build required searches
    const requiredSearches = buildRequiredSearches(
      schedule,
      studentContext,
      localChecks
    );

    // Build course list
    const courseList: string[] = [];
    for (const sem of schedule.semesters) {
      if (sem.type === "academic" && sem.courses) {
        for (const course of sem.courses) {
          courseList.push(
            `${course.code}: ${course.name} (${course.credits}cr) - ${sem.term}`
          );
        }
      }
    }

    // Summary
    const errorCount = allIssues.filter((i) => i.severity === "error").length;
    const warningCount = allIssues.filter(
      (i) => i.severity === "warning"
    ).length;

    const result = {
      valid: errorCount === 0,
      checksPerformed,
      localChecks,
      issues: allIssues,
      summary:
        errorCount === 0 && warningCount === 0
          ? "All local checks passed!"
          : `Found ${errorCount} error(s) and ${warningCount} warning(s)`,
      studentContext: {
        school: schedule.school,
        major: schedule.major,
        degree: schedule.degree,
        concentration: studentContext?.concentration || null,
        minor: studentContext?.minor || null,
        catalogYear: studentContext?.catalogYear || null,
      },
      courseCount: courseList.length,
      courses: courseList,
      requiredSearches,
      instructions: `
Use ParallelSearch for each item in requiredSearches to verify:
1. All major requirements are scheduled
2. Concentration requirements (if applicable)
3. Minor requirements (if applicable)
4. General education requirements
Then take action to fix any gaps found.
`.trim(),
    };

    console.log("Validation result:", JSON.stringify(result, null, 2));

    return Response.json({
      success: true,
      message: result.summary,
      data: result,
    });
  } catch (error) {
    console.error("validate-schedule error:", error);
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
