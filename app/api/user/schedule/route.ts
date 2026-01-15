import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { exists: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ exists: false });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
      },
    });

    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await supabase
      .from("user_logs")
      .select("schedule, school, major, id")
      .eq("email", normalizedEmail)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ exists: false });
    }

    if (!data) {
      return NextResponse.json({ exists: false });
    }

    if (!data.schedule) {
      return NextResponse.json({
        exists: false,
        hasAccount: true,
        school: data.school,
        major: data.major,
      });
    }

    let parsedSchedule = data.schedule;
    if (typeof data.schedule === "string") {
      try {
        parsedSchedule = JSON.parse(data.schedule);
      } catch {
        // Keep as string if parsing fails
      }
    }

    return NextResponse.json(
      {
        exists: true,
        schedule: parsedSchedule,
        school: data.school,
        major: data.major,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { exists: false, error: "Failed to check schedule" },
      { status: 500 }
    );
  }
}
