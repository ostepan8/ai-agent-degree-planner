import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SchedulePlan } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

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

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: true, logged: "console" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
      },
    });

    const upsertData: Record<string, unknown> = {
      email: normalizedEmail,
    };

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
      const scheduleStr =
        typeof schedule === "string" ? schedule : JSON.stringify(schedule);
      upsertData.schedule = scheduleStr;
    }

    const { data: existingRow } = await supabase
      .from("user_logs")
      .select("id")
      .eq("email", normalizedEmail)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    let error;
    if (existingRow) {
      const result = await supabase
        .from("user_logs")
        .update(upsertData)
        .eq("id", existingRow.id)
        .select("id");
      error = result.error;
    } else {
      const result = await supabase
        .from("user_logs")
        .insert(upsertData)
        .select("id")
        .single();
      error = result.error;
    }

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, logged: "supabase" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Logging failed" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  }
}
