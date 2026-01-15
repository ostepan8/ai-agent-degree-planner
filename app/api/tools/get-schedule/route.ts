import { NextRequest } from "next/server";
import { getSchedule } from "@/lib/scheduleStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subconscious sends: { tool_name, parameters: {...}, request_id }
interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: { scheduleId?: string };
  request_id?: string;
  // Also support direct format for testing
  scheduleId?: string;
}

export async function POST(request: NextRequest) {
  console.log("\n========================================");
  console.log("=== TOOL: get-schedule called ===");
  console.log("========================================");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Origin:", request.headers.get("origin") || "unknown");
  console.log(
    "User-Agent:",
    request.headers.get("user-agent")?.substring(0, 50) || "unknown"
  );

  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log("Request body:", JSON.stringify(body, null, 2));

    // Extract scheduleId from either Subconscious format or direct format
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;

    if (!scheduleId) {
      console.log("ERROR: scheduleId is required");
      return Response.json(
        { success: false, message: "scheduleId is required" },
        { status: 400 }
      );
    }

    const schedule = await getSchedule(scheduleId);
    console.log("Schedule found:", !!schedule);

    if (!schedule) {
      return Response.json(
        { success: false, message: "Schedule not found or expired" },
        { status: 404 }
      );
    }

    // Return a summary overview of the schedule
    const overview = {
      school: schedule.school,
      major: schedule.major,
      degree: schedule.degree,
      startTerm: schedule.startTerm,
      graduationTerm: schedule.graduationTerm,
      totalCredits: schedule.totalCredits,
      semesters: schedule.semesters.map((sem) => {
        if (sem.type === "coop") {
          return {
            term: sem.term,
            type: "coop",
            coopNumber: sem.coopNumber,
          };
        }
        return {
          term: sem.term,
          type: "academic",
          courseCount: sem.courses?.length || 0,
          totalCredits: sem.totalCredits,
          courses: sem.courses?.map(
            (c) => `${c.code}: ${c.name} (${c.credits}cr)`
          ),
        };
      }),
    };

    return Response.json({
      success: true,
      message: "Schedule retrieved successfully",
      data: overview,
    });
  } catch (error) {
    console.error("get-schedule error:", error);
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
