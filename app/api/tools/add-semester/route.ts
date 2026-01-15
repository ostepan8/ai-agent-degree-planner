import { NextRequest } from "next/server";
import { getSchedule, updateSchedule } from "@/lib/scheduleStore";
import type { SchedulePlan, Semester } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
    term?: string;
    type?: "academic" | "coop";
    coopNumber?: number;
  };
  request_id?: string;
  scheduleId?: string;
  term?: string;
  type?: "academic" | "coop";
  coopNumber?: number;
}

export async function POST(request: NextRequest) {
  console.log("\n========================================");
  console.log("=== TOOL: add-semester called ===");
  console.log("========================================");

  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log("Request body:", JSON.stringify(body, null, 2));

    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const term = body.parameters?.term || body.term;
    const type = body.parameters?.type || body.type || "academic";
    const coopNumber = body.parameters?.coopNumber || body.coopNumber;

    if (!scheduleId || !term) {
      return Response.json(
        { success: false, message: "scheduleId and term are required" },
        { status: 400 }
      );
    }

    // Validate term format (Season YYYY or Summer 1/2 YYYY)
    const termPattern = /^(Fall|Spring|Summer(\s*[12])?)\s+\d{4}$/i;
    if (!termPattern.test(term)) {
      return Response.json(
        {
          success: false,
          message:
            'term must be in format "Season YYYY" (e.g., "Fall 2025", "Summer 1 2027", "Summer 2 2027")',
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

    // Check if semester already exists
    const exists = schedule.semesters.some(
      (sem) => sem.term.toLowerCase() === term.toLowerCase()
    );

    if (exists) {
      return Response.json(
        {
          success: false,
          message: `Semester "${term}" already exists in schedule`,
        },
        { status: 400 }
      );
    }

    // Create the new semester
    let newSemester: Semester;

    if (type === "coop") {
      newSemester = {
        term,
        type: "coop",
        coopNumber: coopNumber || 1,
      };
    } else {
      newSemester = {
        term,
        type: "academic",
        courses: [],
        totalCredits: 0,
      };
    }

    // Add semester and sort by term
    const updatedSemesters = [...schedule.semesters, newSemester];

    // Sort semesters chronologically (handles Summer 1/2)
    updatedSemesters.sort((a, b) => {
      const parseDate = (t: string) => {
        // Handle formats: "Fall 2025", "Spring 2026", "Summer 2027", "Summer 1 2027", "Summer 2 2027"
        const parts = t.split(" ");
        let season = parts[0];
        let year: number;
        let subOrder = 0; // For Summer 1 vs Summer 2

        if (parts.length === 3 && season.toLowerCase() === "summer") {
          // "Summer 1 2027" or "Summer 2 2027"
          subOrder = parseInt(parts[1]) || 0;
          year = parseInt(parts[2]);
        } else {
          // "Fall 2025", "Spring 2026", "Summer 2027"
          year = parseInt(parts[parts.length - 1]);
        }

        // Order: Spring (0), Summer/Summer 1 (1), Summer 2 (2), Fall (3)
        const seasonOrder: Record<string, number> = {
          spring: 0,
          summer: 1, // Plain "Summer" treated as Summer 1
          fall: 3,
        };
        const baseOrder = seasonOrder[season.toLowerCase()] ?? 1;
        const finalOrder =
          season.toLowerCase() === "summer" && subOrder === 2 ? 2 : baseOrder;

        return year * 10 + finalOrder;
      };
      return parseDate(a.term) - parseDate(b.term);
    });

    const updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
    };

    updateSchedule(scheduleId, updatedSchedule, "add_semester");

    console.log(`✅ SUCCESS: Added ${type} semester "${term}"`);

    return Response.json({
      success: true,
      message: `Added ${type} semester "${term}" to schedule`,
      data: {
        term,
        type,
        coopNumber: type === "coop" ? coopNumber || 1 : undefined,
      },
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error("add-semester error:", error);
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
