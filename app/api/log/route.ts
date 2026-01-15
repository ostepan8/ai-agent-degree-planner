import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SchedulePlan } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LogRequestBody {
  email: string;
  school?: {
    id: string;
    name: string;
  };
  major?: string;
  preferences?: {
    startingSemester: string;
    creditsPerSemester: string;
    coopPlan: string;
    additionalNotes?: string;
  };
  isFreshman?: boolean;
  completedCoursesCount?: number;
  schedule?: SchedulePlan;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LogRequestBody;
    const {
      email,
      school,
      major,
      preferences,
      isFreshman,
      completedCoursesCount,
      schedule,
    } = body;

    console.log(
      "[POST /api/log] Received request - email:",
      email,
      ", hasSchedule:",
      !!schedule,
      ", school:",
      school?.name,
      ", major:",
      major
    );

    // Email is required for persistent storage
    if (!email) {
      console.log("[POST /api/log] No email provided, returning error");
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log("[POST /api/log] Normalized email:", normalizedEmail);

    // Check if Supabase credentials are configured
    // Use service role key for server-side operations to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const usingServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log("[POST /api/log] Using service role key:", usingServiceKey);

    if (!supabaseUrl || !supabaseKey) {
      // Log to console if Supabase is not configured
      console.log("\n=== USER LOG (Supabase not configured) ===");
      console.log(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            email: normalizedEmail,
            school: school?.name,
            major,
            starting_semester: preferences?.startingSemester,
            credits_per_semester: preferences?.creditsPerSemester,
            coop_plan: preferences?.coopPlan,
            is_freshman: isFreshman,
            completed_courses_count: completedCoursesCount || 0,
            notes: preferences?.additionalNotes || "",
            has_schedule: !!schedule,
          },
          null,
          2
        )
      );
      console.log("==========================================\n");

      return NextResponse.json({ success: true, logged: "console" });
    }

    // Initialize Supabase client with no-cache fetch
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
      },
    });

    // Build the upsert data - only include fields that are provided
    const upsertData: Record<string, unknown> = {
      email: normalizedEmail,
    };

    // Add optional fields if provided
    if (school?.name !== undefined) upsertData.school = school.name;
    if (major !== undefined) upsertData.major = major;
    if (preferences?.startingSemester !== undefined) {
      upsertData.starting_semester = preferences.startingSemester;
    }
    if (preferences?.creditsPerSemester !== undefined) {
      upsertData.credits_per_semester = preferences.creditsPerSemester;
    }
    if (preferences?.coopPlan !== undefined)
      upsertData.coop_plan = preferences.coopPlan;
    if (isFreshman !== undefined) upsertData.is_freshman = isFreshman;
    if (completedCoursesCount !== undefined)
      upsertData.completed_courses_count = completedCoursesCount;
    if (preferences?.additionalNotes !== undefined)
      upsertData.notes = preferences.additionalNotes;
    if (schedule !== undefined) {
      // Ensure schedule is stored as a JSON string (for TEXT column compatibility)
      const scheduleStr =
        typeof schedule === "string" ? schedule : JSON.stringify(schedule);
      upsertData.schedule = scheduleStr;

      // Log course count for debugging
      try {
        const parsed =
          typeof schedule === "string" ? JSON.parse(schedule) : schedule;
        const courseCount = (parsed.semesters || []).reduce(
          (sum: number, sem: { type: string; courses?: unknown[] }) => {
            if (sem.type === "academic" && sem.courses) {
              return sum + sem.courses.length;
            }
            return sum;
          },
          0
        );
        console.log(
          "[POST /api/log] Saving schedule with",
          parsed.semesters?.length,
          "semesters,",
          courseCount,
          "courses,",
          parsed.totalCredits,
          "credits"
        );
      } catch {
        console.log("[POST /api/log] Could not parse schedule for logging");
      }
    }

    // First, check if a row exists for this email
    // Use order by id DESC to match the GET query behavior (most recent row)
    const { data: existingRow } = await supabase
      .from("user_logs")
      .select("id")
      .eq("email", normalizedEmail)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    const hasSchedule = "schedule" in upsertData;
    const schedulePreview =
      hasSchedule && upsertData.schedule
        ? (upsertData.schedule as string).substring(0, 100) + "..."
        : "none";

    let error;
    if (existingRow) {
      // UPDATE existing row
      console.log(
        "[POST /api/log] Updating existing row ID:",
        existingRow.id,
        "for:",
        normalizedEmail
      );
      console.log("[POST /api/log] Update data keys:", Object.keys(upsertData));
      console.log(
        "[POST /api/log] Schedule being saved length:",
        typeof upsertData.schedule === "string"
          ? (upsertData.schedule as string).length
          : "not a string"
      );

      const result = await supabase
        .from("user_logs")
        .update(upsertData)
        .eq("id", existingRow.id)
        .select("id, schedule"); // Get the updated row back

      console.log(
        "[POST /api/log] Update result - status:",
        result.status,
        ", count:",
        result.count,
        ", data:",
        result.data?.length,
        "rows"
      );
      error = result.error;

      // Use the result from update.select() for verification
      if (!error && result.data && result.data.length > 0) {
        const verifyData = result.data[0];
        if (verifyData?.schedule) {
          const rawStr =
            typeof verifyData.schedule === "string"
              ? verifyData.schedule
              : JSON.stringify(verifyData.schedule);
          console.log(
            "[POST /api/log] Update returned schedule length:",
            rawStr.length,
            ", first 200 chars:",
            rawStr.substring(0, 200)
          );

          const parsed =
            typeof verifyData.schedule === "string"
              ? JSON.parse(verifyData.schedule)
              : verifyData.schedule;
          console.log(
            "[POST /api/log] Update returned - totalCredits:",
            parsed.totalCredits,
            ", semesters:",
            parsed.semesters?.length,
            ", courses:",
            parsed.semesters?.reduce(
              (sum: number, s: { courses?: unknown[] }) =>
                sum + (s.courses?.length || 0),
              0
            )
          );
        }
      } else if (!error) {
        console.log("[POST /api/log] WARNING: Update returned no data!");
      }
    } else {
      // INSERT new row
      console.log("[POST /api/log] Inserting new row for:", normalizedEmail);
      const result = await supabase
        .from("user_logs")
        .insert(upsertData)
        .select("id")
        .single();
      error = result.error;
      if (!error && result.data) {
        console.log(
          "[POST /api/log] Inserted new row with ID:",
          result.data.id
        );
      }
    }

    if (error) {
      console.error("[POST /api/log] Supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 200 }
      );
    }

    console.log(
      "[POST /api/log] SUCCESS - Saved for:",
      normalizedEmail,
      ", hasSchedule:",
      hasSchedule,
      ", preview:",
      schedulePreview.substring(0, 50)
    );

    return NextResponse.json({ success: true, logged: "supabase" });
  } catch (error) {
    console.error("Failed to log user data:", error);
    return NextResponse.json(
      { success: false, error: "Logging failed" },
      { status: 500 }
    );
  }
}
