import { NextRequest } from "next/server";
import {
  getSchedule,
  updateSchedule,
  recalculateSemesterCredits,
} from "@/lib/scheduleStore";
import type { SchedulePlan } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subconscious sends: { tool_name, parameters: {...}, request_id }
interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
    courseCodes?: string[];
    courseCodesStr?: string; // Comma-separated string format for simpler schema
  };
  request_id?: string;
  // Also support direct format for testing
  scheduleId?: string;
  courseCodes?: string[];
  courseCodesStr?: string;
}

export async function POST(request: NextRequest) {
  console.log("\n========================================");
  console.log("=== TOOL: bulk-remove-courses called ===");
  console.log("========================================");
  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log("Request body:", JSON.stringify(body, null, 2));

    // Extract from either Subconscious format or direct format
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;

    // Support both array format and comma-separated string format
    let courseCodes: string[] | undefined =
      body.parameters?.courseCodes || body.courseCodes;
    const courseCodesStr =
      body.parameters?.courseCodesStr || body.courseCodesStr;

    // Parse comma-separated string if provided
    if (!courseCodes && courseCodesStr) {
      courseCodes = courseCodesStr
        .split(",")
        .map((code) => code.trim())
        .filter((code) => code.length > 0);
      console.log("Parsed courseCodesStr:", courseCodes);
    }

    if (
      !scheduleId ||
      !courseCodes ||
      !Array.isArray(courseCodes) ||
      courseCodes.length === 0
    ) {
      return Response.json(
        {
          success: false,
          message:
            "scheduleId and courseCodes array (or courseCodesStr) are required",
        },
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

    // Normalize all course codes
    const normalizedCodes = courseCodes.map((code) =>
      code.toUpperCase().replace(/\s+/g, " ").trim()
    );

    // Track which courses were found and removed
    const removedCourses: string[] = [];
    const notFound: string[] = [];

    // Remove courses from all semesters
    const updatedSemesters = schedule.semesters.map((sem) => {
      if (sem.type !== "academic" || !sem.courses) {
        return sem;
      }

      const originalLength = sem.courses.length;
      const filteredCourses = sem.courses.filter((course) => {
        const normalizedCourseCode = course.code
          .toUpperCase()
          .replace(/\s+/g, " ")
          .trim();
        const shouldRemove = normalizedCodes.includes(normalizedCourseCode);
        if (shouldRemove) {
          removedCourses.push(`${course.code} from ${sem.term}`);
        }
        return !shouldRemove;
      });

      if (filteredCourses.length !== originalLength) {
        return {
          ...sem,
          courses: filteredCourses,
        };
      }

      return sem;
    });

    // Check which courses were not found
    for (const code of courseCodes) {
      const normalizedCode = code.toUpperCase().replace(/\s+/g, " ").trim();
      const wasRemoved = removedCourses.some((removed) =>
        removed.toUpperCase().startsWith(normalizedCode)
      );
      if (!wasRemoved) {
        notFound.push(code);
      }
    }

    if (removedCourses.length === 0) {
      return Response.json(
        {
          success: false,
          message: "No courses found to remove",
          notFound,
        },
        { status: 404 }
      );
    }

    let updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
    };

    // Recalculate credits
    updatedSchedule = recalculateSemesterCredits(updatedSchedule);

    updateSchedule(scheduleId, updatedSchedule, "bulk_remove_courses");

    console.log(
      `✅ SUCCESS: Removed ${
        removedCourses.length
      } course(s): ${removedCourses.join(", ")}`
    );
    if (notFound.length > 0) {
      console.log(`⚠️ Not found: ${notFound.join(", ")}`);
    }

    return Response.json({
      success: true,
      message: `Removed ${
        removedCourses.length
      } course(s): ${removedCourses.join(", ")}`,
      removedCount: removedCourses.length,
      removed: removedCourses,
      notFound: notFound.length > 0 ? notFound : undefined,
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error("❌ bulk-remove-courses error:", error);
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
