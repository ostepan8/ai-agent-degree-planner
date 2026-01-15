import { z } from "zod";
import { CompletedCourseSchema, type CompletedCourse, type TranscriptData, type CompletedSemesterData } from "../schemas";
import { getSubconsciousClient, DEFAULT_ENGINE } from "../subconscious";

/**
 * Extract text content from a PDF buffer using pdf-parse.
 * Returns the raw text extracted from all pages.
 * 
 * Note: pdf-parse is dynamically imported to avoid a bug where it tries to 
 * load a test PDF file at module initialization time.
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid pdf-parse's buggy initialization
  const pdfParse = require("pdf-parse/lib/pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Extract JSON array from a string that might contain markdown code blocks or extra text.
 */
function extractJsonArray(text: string): string {
  // If it's already valid JSON array, return as-is
  const trimmed = text.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }

  // Try to extract from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON array in the text
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  // Return original if no extraction worked
  return trimmed;
}

/**
 * Use AI to parse transcript text into structured course data.
 * Returns an array of completed courses extracted from the text.
 */
export async function parseTranscriptText(
  text: string
): Promise<CompletedCourse[]> {
  const client = getSubconsciousClient();

  const prompt = `You are a document parser that can extract courses from academic transcripts OR degree plans.

DOCUMENT TYPES:
1. TRANSCRIPT: Contains completed courses with grades (A, B+, etc.) and semesters taken
2. DEGREE PLAN: Contains planned courses organized by semester (no grades, just course listings)

For each course found, extract:
- code: The course code (e.g., "CS 2500", "MATH 1341", "ENGW 1111", "ELECTIVE")
- name: The full course name (e.g., "Fundamentals of Computer Science 1", "Science with Lab")
- credits: Number of credits (as a number, look for "cr" or "credits")
- grade: The grade received. Use these values:
  * For transcripts: actual grade (A, B+, A-, P, S, etc.)
  * For transfer/AP credits: "T"
  * For degree plans (no grades shown): "P" (meaning Planned)
- semester: When the course was/will be taken (e.g., "Fall 2024", "Spring 2025", "Transfer")

INCLUDE:
- All courses with actual grades from transcripts
- Transfer/AP credits (grade "T", semester "Transfer")
- Planned courses from degree plans (grade "P", use the semester shown like "Fall 2025")
- Electives (use "ELECTIVE" as code if no specific code given)
- Co-op work experiences: Use code "COOP" and include the grade (S, P, IP, etc.)
  * These are typically listed as "Co-op Work Experience" or have codes like "COOP 3945"
  * Use credits: 0 for co-ops (they don't count toward academic credits)

DO NOT include:
- Withdrawn courses (W grade)
- Summary statistics, GPA info, or headers

Return ONLY a valid JSON array of objects with fields: code, name, credits, grade, semester
Do not include any markdown formatting, code blocks, or explanatory text.

DOCUMENT TEXT:
${text}`;

  const run = await client.run({
    engine: DEFAULT_ENGINE,
    input: {
      instructions: prompt,
      tools: [],
    },
    options: {
      awaitCompletion: true,
    },
  });

  // Check for successful completion
  const status = run.status as string;
  const isSuccess = status === "completed" || status === "succeeded" || status === "success";
  
  // The SDK returns result.answer for tim-large engine
  const runResult = run as Record<string, unknown>;
  const result = runResult.result as Record<string, unknown> | undefined;
  const answer = runResult.answer || result?.answer;
  
  if (!isSuccess || !answer) {
    console.error("AI run failed:", JSON.stringify(run, null, 2));
    throw new Error(`AI parsing failed: status=${run.status}`);
  }

  // Get the answer as string - it should be the JSON array directly
  let answerText: string;
  if (typeof answer === "string") {
    answerText = answer;
  } else {
    answerText = JSON.stringify(answer);
  }

  // Extract JSON array from the response (handles markdown code blocks, etc.)
  const jsonText = extractJsonArray(answerText);

  // Parse the JSON
  let parsed: unknown[];
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:");
    console.error("Raw answer:", answerText);
    console.error("Extracted JSON:", jsonText);
    throw new Error(
      `Failed to parse transcript: AI returned invalid JSON. Please try again.`
    );
  }

  // Validate each course against the schema
  const CoursesArraySchema = z.array(CompletedCourseSchema);
  const validated = CoursesArraySchema.parse(parsed);

  return validated;
}

/**
 * Parse a PDF transcript buffer into structured course data.
 * Convenience function that combines text extraction and AI parsing.
 */
export async function parseTranscript(
  buffer: Buffer
): Promise<CompletedCourse[]> {
  const text = await extractTextFromPDF(buffer);
  return parseTranscriptText(text);
}

/**
 * Parse a PDF transcript and return both the extracted text and parsed courses.
 * Useful for debugging and seeing what the AI is working with.
 */
export async function parseTranscriptWithDebug(buffer: Buffer): Promise<{
  rawText: string;
  courses: CompletedCourse[];
}> {
  const rawText = await extractTextFromPDF(buffer);
  const courses = await parseTranscriptText(rawText);
  return { rawText, courses };
}

// ============================================
// TRANSCRIPT GROUPING UTILITIES
// ============================================

/**
 * Parse a semester term string into a comparable value for sorting.
 * Format: "Season YYYY" (e.g., "Fall 2024", "Spring 2025", "Summer 2025")
 * Returns a number where higher = later in time.
 */
function parseSemesterForSort(term: string): number {
  const yearMatch = term.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;
  
  // Season ordering within a year: Spring (1) < Summer (2) < Fall (3)
  const termLower = term.toLowerCase();
  let seasonOrder = 0;
  if (termLower.includes("spring")) seasonOrder = 1;
  else if (termLower.includes("summer")) seasonOrder = 2;
  else if (termLower.includes("fall")) seasonOrder = 3;
  
  // Return year * 10 + season for proper ordering
  return year * 10 + seasonOrder;
}

/**
 * Determine the next semester after a given term.
 * E.g., "Fall 2024" -> "Spring 2025", "Spring 2025" -> "Summer 2025" or "Fall 2025"
 */
export function getNextSemester(term: string, includesSummer: boolean = false): string {
  const yearMatch = term.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  const termLower = term.toLowerCase();
  
  if (termLower.includes("fall")) {
    return `Spring ${year + 1}`;
  } else if (termLower.includes("spring")) {
    return includesSummer ? `Summer ${year}` : `Fall ${year}`;
  } else if (termLower.includes("summer")) {
    return `Fall ${year}`;
  }
  
  // Default to next fall
  return `Fall ${year}`;
}

/**
 * Check if a semester term represents transfer/AP credits (not a real semester).
 */
function isTransferSemester(semester: string): boolean {
  const lower = semester.toLowerCase();
  return (
    lower === "transfer" ||
    lower.includes("transfer") ||
    lower.includes("ap ") ||
    lower.includes("advanced placement") ||
    lower === "ap"
  );
}

/**
 * Check if a course is a co-op work experience
 */
function isCoopCourse(course: CompletedCourse): boolean {
  const code = course.code.toUpperCase();
  const name = course.name.toLowerCase();
  return (
    code.startsWith("COOP") ||
    code === "COOP" ||
    name.includes("co-op work experience")
  );
}

/**
 * Check if a co-op is completed (has a passing grade)
 * Note: "P" in transcript parsing context means "Planned" (from degree plan), not Pass
 */
function isCompletedCoop(course: CompletedCourse): boolean {
  if (!isCoopCourse(course)) return false;
  const grade = (course.grade || "").toUpperCase();
  // Completed co-ops have S (Satisfactory), letter grades, or CR (Credit)
  // Exclude: P (Planned - not yet completed), W (Withdrawn), IP (In Progress),
  // F (Failed), empty grade, T (Transfer - rare for co-ops)
  const completedGrades = ["S", "A", "A-", "A+", "B", "B-", "B+", "C", "C-", "C+", "D", "D-", "D+", "CR"];
  return completedGrades.includes(grade);
}

/**
 * Group completed courses by semester and separate transfer credits.
 * Returns structured data with completed semesters sorted chronologically,
 * transfer credits separated, and calculated totals.
 */
export function groupCoursesBySemester(courses: CompletedCourse[]): TranscriptData {
  // Separate transfer credits, co-ops, and regular semester courses
  const transferCredits: CompletedCourse[] = [];
  const semesterCourses: CompletedCourse[] = [];
  const coopCourses: CompletedCourse[] = [];
  
  for (const course of courses) {
    if (isCoopCourse(course)) {
      coopCourses.push(course);
    } else if (isTransferSemester(course.semester)) {
      transferCredits.push(course);
    } else {
      semesterCourses.push(course);
    }
  }
  
  // Count completed co-ops
  const completedCoops = coopCourses.filter(isCompletedCoop).length;
  
  // Group courses by semester term
  const semesterMap = new Map<string, CompletedCourse[]>();
  for (const course of semesterCourses) {
    const existing = semesterMap.get(course.semester) || [];
    existing.push(course);
    semesterMap.set(course.semester, existing);
  }
  
  // Convert to array and sort by semester chronologically
  const completedSemesters: CompletedSemesterData[] = Array.from(semesterMap.entries())
    .map(([term, courses]) => ({
      term,
      courses,
      totalCredits: courses.reduce((sum, c) => sum + c.credits, 0),
    }))
    .sort((a, b) => parseSemesterForSort(a.term) - parseSemesterForSort(b.term));
  
  // Calculate totals
  const totalCompletedCredits = completedSemesters.reduce(
    (sum, sem) => sum + sem.totalCredits,
    0
  );
  const totalTransferCredits = transferCredits.reduce(
    (sum, c) => sum + c.credits,
    0
  );
  
  // Determine the last completed semester and next semester
  const lastCompletedTerm = completedSemesters.length > 0
    ? completedSemesters[completedSemesters.length - 1].term
    : null;
  
  const nextSemester = lastCompletedTerm
    ? getNextSemester(lastCompletedTerm)
    : null;
  
  return {
    completedSemesters,
    transferCredits,
    totalCompletedCredits,
    totalTransferCredits,
    lastCompletedTerm,
    nextSemester,
    completedCoops,
  };
}

/**
 * Convert completed semesters from transcript into the format used in SchedulePlan.
 * Marks all semesters as "completed" status.
 */
export function convertToScheduleSemesters(transcriptData: TranscriptData): Array<{
  term: string;
  type: "academic";
  courses: Array<{ code: string; name: string; credits: number }>;
  totalCredits: number;
  status: "completed";
}> {
  return transcriptData.completedSemesters.map((sem) => ({
    term: sem.term,
    type: "academic" as const,
    courses: sem.courses.map((c) => ({
      code: c.code,
      name: c.name,
      credits: c.credits,
    })),
    totalCredits: sem.totalCredits,
    status: "completed" as const,
  }));
}

