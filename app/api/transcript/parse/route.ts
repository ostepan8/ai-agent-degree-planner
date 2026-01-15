import { NextRequest, NextResponse } from "next/server";
import { parseTranscriptWithDebug } from "@/lib/transcript";

export async function POST(request: NextRequest) {
  try {
    // Get the form data with the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the transcript
    const { rawText, courses } = await parseTranscriptWithDebug(buffer);

    // Calculate summary stats
    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);

    return NextResponse.json({
      success: true,
      courses,
      summary: {
        courseCount: courses.length,
        totalCredits,
        textLength: rawText.length,
      },
    });
  } catch (error) {
    console.error("Transcript parsing error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { error: `Failed to parse transcript: ${message}` },
      { status: 500 }
    );
  }
}

