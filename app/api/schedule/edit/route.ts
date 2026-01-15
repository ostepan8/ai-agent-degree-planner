import { NextRequest } from "next/server";
import { getSubconsciousClient, DEFAULT_ENGINE } from "@/lib/subconscious";
import {
  storeSchedule,
  getSchedule,
  generateScheduleId,
  getScheduleVersion,
  getLastUpdate,
} from "@/lib/scheduleStore";
import type { SchedulePlan } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EditRequest {
  currentSchedule: SchedulePlan;
  editRequest: string;
  webSearchEnabled?: boolean;
}

// Build tool definitions for the Subconscious API
// NOTE: We removed the 'const' field from scheduleId parameters as it was causing
// "response schema rejected" errors with the underlying model. Instead, the scheduleId
// is included in the description and the agent prompt.
function buildToolDefinitions(baseUrl: string, scheduleId: string) {
  const scheduleIdParam = {
    type: "string",
    description: `The schedule ID. Use: "${scheduleId}"`,
  };

  return [
    {
      type: "function" as const,
      name: "get_schedule",
      description:
        "Get an overview of the current schedule including all semesters and their courses. Call this first to understand the current state.",
      url: `${baseUrl}/api/tools/get-schedule`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
        },
        required: ["scheduleId"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "get_semester",
      description:
        "Get detailed information about a specific semester including all courses.",
      url: `${baseUrl}/api/tools/get-semester`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          term: {
            type: "string",
            description: 'The semester term, e.g. "Fall 2025", "Spring 2027"',
          },
        },
        required: ["scheduleId", "term"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "move_course",
      description:
        "Move a course from its current semester to a different semester.",
      url: `${baseUrl}/api/tools/move-course`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          courseCode: {
            type: "string",
            description: 'The course code to move, e.g. "CS 3500"',
          },
          toSemester: {
            type: "string",
            description: 'The target semester, e.g. "Spring 2027"',
          },
        },
        required: ["scheduleId", "courseCode", "toSemester"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "swap_courses",
      description:
        "Swap two courses between their semesters. Both courses will exchange positions.",
      url: `${baseUrl}/api/tools/swap-courses`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          courseCode1: {
            type: "string",
            description: 'First course code, e.g. "CS 3500"',
          },
          courseCode2: {
            type: "string",
            description: 'Second course code, e.g. "CS 3700"',
          },
        },
        required: ["scheduleId", "courseCode1", "courseCode2"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "add_course",
      description: "Add a new course to a specific semester.",
      url: `${baseUrl}/api/tools/add-course`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          toSemester: {
            type: "string",
            description: 'The semester to add the course to, e.g. "Fall 2026"',
          },
          courseCode: {
            type: "string",
            description: 'The new course code, e.g. "MATH 2331"',
          },
          courseName: {
            type: "string",
            description: 'The course name, e.g. "Linear Algebra"',
          },
          credits: {
            type: "number",
            description: "Number of credits (1-6)",
          },
          options: {
            type: "string",
            description: "Optional: for electives, list example course options",
          },
        },
        required: [
          "scheduleId",
          "toSemester",
          "courseCode",
          "courseName",
          "credits",
        ],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "remove_course",
      description: "Remove a course from the schedule entirely.",
      url: `${baseUrl}/api/tools/remove-course`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          courseCode: {
            type: "string",
            description: 'The course code to remove, e.g. "PHYS 1151"',
          },
        },
        required: ["scheduleId", "courseCode"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "find_light_semesters",
      description:
        "Find academic semesters that have fewer than a specified number of credits. Useful for identifying where to add more courses to balance the schedule.",
      url: `${baseUrl}/api/tools/find-light-semesters`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          minCredits: {
            type: "number",
            description:
              "Minimum credits threshold. Semesters below this are returned. Default is 16.",
          },
        },
        required: ["scheduleId"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "bulk_add_courses",
      description:
        'WARNING: Call get_credit_summary FIRST. Do NOT call if already at credit target. Add multiple courses as JSON: [{"term":"Fall 2026","courseCode":"ECON 1115","courseName":"Macroeconomics","credits":4}]',
      url: `${baseUrl}/api/tools/bulk-add-courses`,
      method: "POST" as const,
      timeout: 10000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          coursesJson: {
            type: "string",
            description:
              'JSON array of courses. Each course: {"term":"Fall 2026","courseCode":"CS 1234","courseName":"Name","credits":4}',
          },
        },
        required: ["scheduleId", "coursesJson"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "bulk_remove_courses",
      description:
        'Remove multiple courses at once. Pass course codes as comma-separated string: "CS 1800, PHYS 1151, MATH 1341"',
      url: `${baseUrl}/api/tools/bulk-remove-courses`,
      method: "POST" as const,
      timeout: 10000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          courseCodesStr: {
            type: "string",
            description:
              'Comma-separated list of course codes to remove, e.g. "CS 1800, PHYS 1151, MATH 1341"',
          },
        },
        required: ["scheduleId", "courseCodesStr"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "swap_semesters",
      description:
        "Swap two semesters' types and content. Use this to swap a co-op semester with an academic semester - the co-op becomes academic with courses, and the academic becomes co-op.",
      url: `${baseUrl}/api/tools/swap-semesters`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          semester1: {
            type: "string",
            description: 'First semester to swap, e.g. "Spring 2027"',
          },
          semester2: {
            type: "string",
            description: 'Second semester to swap, e.g. "Summer 2027"',
          },
        },
        required: ["scheduleId", "semester1", "semester2"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "get_credit_summary",
      description:
        "CRITICAL: Call this BEFORE adding any courses. Returns current total credits, target credits, and whether you can add more. If current >= target, DO NOT add courses.",
      url: `${baseUrl}/api/tools/get-credit-summary`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
        },
        required: ["scheduleId"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "count_courses_by_type",
      description:
        "Count courses grouped by department (e.g., CS: 12, MATH: 4, ELECTIVE: 8).",
      url: `${baseUrl}/api/tools/count-courses-by-type`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
        },
        required: ["scheduleId"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "find_courses_in_schedule",
      description:
        "Search for courses in the schedule matching a search term (matches course code or name).",
      url: `${baseUrl}/api/tools/find-courses-in-schedule`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          searchTerm: {
            type: "string",
            description:
              'Search term to match against course code or name, e.g. "ELECTIVE" or "CS"',
          },
        },
        required: ["scheduleId", "searchTerm"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "fill_semester_to_credits",
      description:
        "Automatically add electives to a semester until it reaches the target credits. Uses a pool of common electives.",
      url: `${baseUrl}/api/tools/fill-semester-to-credits`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          term: {
            type: "string",
            description: 'The semester to fill, e.g. "Fall 2025"',
          },
          targetCredits: {
            type: "number",
            description: "Target credit count (default 16)",
          },
        },
        required: ["scheduleId", "term"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "add_semester",
      description:
        "Add a new semester to the schedule (academic or co-op). Supports Summer 1 and Summer 2 for schools with two summer terms.",
      url: `${baseUrl}/api/tools/add-semester`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          term: {
            type: "string",
            description:
              'The semester term, e.g. "Fall 2025", "Spring 2026", "Summer 2026", "Summer 1 2027", "Summer 2 2027"',
          },
          type: {
            type: "string",
            description: '"academic" or "coop"',
          },
          coopNumber: {
            type: "number",
            description: "Co-op number (1, 2, or 3) if type is coop",
          },
        },
        required: ["scheduleId", "term", "type"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "remove_semester",
      description:
        "Remove a semester from the schedule. Only allows removal of empty semesters unless force=true.",
      url: `${baseUrl}/api/tools/remove-semester`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          term: {
            type: "string",
            description: 'The semester to remove, e.g. "Summer 2026"',
          },
        },
        required: ["scheduleId", "term"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "set_semester_type",
      description:
        "Change a semester's type (academic to coop or vice versa). If changing to coop, courses are removed.",
      url: `${baseUrl}/api/tools/set-semester-type`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
          term: {
            type: "string",
            description: 'The semester to change, e.g. "Summer 2026"',
          },
          newType: {
            type: "string",
            description: '"academic" or "coop"',
          },
          coopNumber: {
            type: "number",
            description: "Co-op number (1, 2, or 3) if changing to coop",
          },
        },
        required: ["scheduleId", "term", "newType"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "validate_schedule",
      description:
        "School-agnostic validation. Returns localChecks (credits, placeholders, duplicates, emptySemesters) and requiredSearches array. Use ParallelSearch for each requiredSearch to verify major/concentration/minor requirements.",
      url: `${baseUrl}/api/tools/validate-schedule`,
      method: "POST" as const,
      timeout: 5000,
      parameters: {
        type: "object",
        properties: {
          scheduleId: scheduleIdParam,
        },
        required: ["scheduleId"],
        additionalProperties: false,
      },
    },
  ];
}

// Extract tool calls from the streaming content
function extractToolCalls(
  content: string
): Array<{ tool: string; args: Record<string, unknown> }> {
  const toolCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];

  // Look for tool call patterns in the content
  // Pattern: "tool_calls": [{"name": "...", "arguments": {...}}]
  const toolCallPattern =
    /"name"\s*:\s*"([^"]+)".*?"arguments"\s*:\s*(\{[^}]+\})/g;
  let match;

  while ((match = toolCallPattern.exec(content)) !== null) {
    try {
      const tool = match[1];
      const args = JSON.parse(match[2]);
      toolCalls.push({ tool, args });
    } catch {
      // Skip malformed tool calls
    }
  }

  return toolCalls;
}

// Extract thoughts from content
function extractThoughts(content: string): string[] {
  const thoughts: string[] = [];

  const thoughtPattern = /"thought"\s*:\s*"([^"]+(?:\\.[^"]*)*?)"/g;
  let match;

  while ((match = thoughtPattern.exec(content)) !== null) {
    const thought = match[1]
      .replace(/\\n/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
    if (thought && thought.length > 10) {
      thoughts.push(thought);
    }
  }

  return thoughts;
}

// Clean up extracted text to be readable
function cleanupText(text: string): string {
  return (
    text
      // Unescape JSON escape sequences
      .replace(/\\n/g, " ")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      // Remove markdown formatting
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .replace(/#{1,6}\s*/g, "")
      // Clean up bullet points and dashes
      .replace(/^[-•]\s*/gm, "")
      .replace(/^\d+\.\s*/gm, "")
      // Collapse multiple spaces
      .replace(/\s+/g, " ")
      // Collapse multiple newlines
      .replace(/\n{2,}/g, " ")
      .trim()
  );
}

// Extract the final answer from the AI's response
function extractAnswer(content: string): string | null {
  // Look for "answer": "..." pattern at the end of the response
  const answerPattern = /"answer"\s*:\s*"([^"]+(?:\\.[^"]*)*?)"\s*\}?\s*$/;
  const match = content.match(answerPattern);

  if (match) {
    return cleanupText(match[1]);
  }

  // Fallback: try to find any answer field
  const fallbackPattern = /"answer"\s*:\s*"([^"]+(?:\\.[^"]*)*?)"/g;
  let lastMatch = null;
  let m;
  while ((m = fallbackPattern.exec(content)) !== null) {
    lastMatch = m;
  }

  if (lastMatch) {
    return cleanupText(lastMatch[1]);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EditRequest;
    const { currentSchedule, editRequest, webSearchEnabled = false } = body;

    if (!currentSchedule || !editRequest) {
      return new Response(
        JSON.stringify({
          error: "Current schedule and edit request are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate schedule ID and store the schedule
    const scheduleId = generateScheduleId();
    await storeSchedule(scheduleId, currentSchedule);

    // Extract school context for personalized prompts
    const schoolName = currentSchedule.school || "the university";
    const major = currentSchedule.major || "the program";
    const catalogUrl = currentSchedule.sourceUrl || "";
    const degree = currentSchedule.degree || "BS";

    // Extract student context for enhanced prompts and validation
    const studentContext = currentSchedule.studentContext;
    const concentration = studentContext?.concentration || "";
    const minor = studentContext?.minor || "";
    const combinedMajor = studentContext?.combinedMajor || "";
    const catalogYear = studentContext?.catalogYear || "2024-2025";
    const isHonors = studentContext?.honors || false;
    const studyAbroad = studentContext?.studyAbroad;

    // Determine base URL for tool callbacks
    // PRIORITY: 1) TUNNEL_URL env var, 2) forwarded headers, 3) host header
    const tunnelUrl = process.env.TUNNEL_URL;
    const host = request.headers.get("host") || "localhost:3000";
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");

    let baseUrl: string;
    if (tunnelUrl) {
      // Use configured tunnel URL (ngrok, localtunnel, etc.)
      baseUrl = tunnelUrl;
    } else if (forwardedHost) {
      // Behind a proxy (e.g., ngrok, Vercel)
      baseUrl = `${forwardedProto || "https"}://${forwardedHost}`;
    } else if (host.includes("localhost") || host.includes("127.0.0.1")) {
      // Local development - Subconscious CANNOT reach this!
      baseUrl = `http://${host}`;
    } else {
      const protocol = host.includes("localhost") ? "http" : "https";
      baseUrl = `${protocol}://${host}`;
    }

    // Build tool definitions
    const tools = buildToolDefinitions(baseUrl, scheduleId);

    // Web search emphasis section when enabled
    const webSearchInstructions = webSearchEnabled
      ? `
## WEB SEARCH ENABLED

The user has enabled web search mode. You SHOULD actively use ParallelSearch to:
- Look up current course offerings and descriptions at ${schoolName}
- Find prerequisites, course availability, and scheduling information
- Research degree requirements, concentrations, and minor options
- Discover new courses that match the user's interests
- Verify course codes and credit values from official sources
- Find information about professors, course reviews, or difficulty ratings

When the user asks a question, proactively search the web to provide accurate, up-to-date information before making any schedule changes.

`
      : "";

    // Action-oriented prompt with domain knowledge
    const instructions = `You are an expert academic advisor helping a ${major} student at ${schoolName}. Your job is to EXECUTE schedule changes, not just analyze.
${webSearchInstructions}
## CRITICAL: YOU MUST TAKE ACTION

Your task is to MODIFY the schedule using tools. After understanding the request:
1. Identify what needs to change
2. ${
      webSearchEnabled
        ? "Use ParallelSearch to research and find accurate course information"
        : "Research ONLY if you need specific course info you don't have"
    }
3. EXECUTE the changes using add_course, move_course, remove_course, or swap_courses
4. You are NOT done until you have called the action tools to make changes

If multiple changes are needed, execute them one by one. Do not stop after researching.

## USER REQUEST
"${editRequest}"

## SCHEDULE CONTEXT
- School: ${schoolName}
- Major: ${major} (${degree})
- Catalog: ${catalogUrl}
- Schedule ID: ${scheduleId}
- Catalog Year: ${catalogYear}
${concentration ? `- Concentration: ${concentration}` : ""}
${minor ? `- Minor: ${minor}` : ""}
${combinedMajor ? `- Combined Major: ${combinedMajor}` : ""}
${isHonors ? "- Honors Program: Yes" : ""}
${
  studyAbroad?.planned
    ? `- Study Abroad: Planned for ${studyAbroad.term || "TBD"}`
    : ""
}

## WORKFLOW

### Step 1: Get Current State
Call get_schedule to see all semesters and courses.

### Step 2: Plan Changes
Identify exactly what modifications are needed to fulfill the request.

### Step 3: Research ${
      webSearchEnabled
        ? "(RECOMMENDED - Web Search Enabled)"
        : "(only if necessary)"
    }
Use ParallelSearch ${
      webSearchEnabled
        ? "to find accurate, up-to-date information:"
        : "ONLY when you need to find:"
    }
- Specific course codes you don't know
- Requirements for a minor or concentration
- Available elective options
${
  webSearchEnabled
    ? "- Course descriptions, prerequisites, and availability\n- Current catalog information and degree requirements\n- Any information the user specifically asks about"
    : ""
}
${
  webSearchEnabled
    ? "\nSince web search is enabled, proactively search for information to ensure accuracy."
    : "\nDo NOT search if you already have enough information to act."
}

### Step 4: EXECUTE CHANGES
Call the appropriate tools to modify the schedule:
- add_course: Add a single course to a semester
- remove_course: Remove a single course
- move_course: Move a course to a different semester
- swap_courses: Exchange two courses between semesters
- bulk_add_courses: Add multiple courses at once (use for multi-semester changes)
- bulk_remove_courses: Remove multiple courses at once

YOU MUST CALL THESE TOOLS. Analysis alone is not completion.

## COURSE KNOWLEDGE

### Adding Courses
When adding courses, use accurate information:
- Course code format: "DEPT XXXX" (e.g., "CS 3500", "MATH 2331")
- Most courses are 4 credits at ${schoolName}
- Use "ELECTIVE" as code for flexible elective slots

### Common 4-Credit Electives (use these when adding free electives)
- ECON 1115: Principles of Macroeconomics (4 credits)
- POLS 1150: U.S. Politics (4 credits)
- PHIL 1101: Introduction to Philosophy (4 credits)
- HIST 1150: Global Social Movements (4 credits)
- PSYCH 1101: Introduction to Psychology (4 credits)
- SOCL 1101: Introduction to Sociology (4 credits)

### Semester Constraints
- Academic semesters: Regular coursework (Fall, Spring, Summer)
- Co-op semesters: Full-time work, ZERO courses (type: "coop") - do not add courses
- Typical load: 4-5 courses, 16-18 credits per semester
- Final semester may have fewer credits if finishing up

## TOOLS

| Tool | Purpose | When to Use |
|------|---------|-------------|
| get_schedule | View full schedule | Always call first |
| get_semester | View one semester | When you need details on specific term |
| get_credit_summary | Get credit totals and averages | For quick credit analysis |
| count_courses_by_type | Count courses by department | To see course distribution |
| find_courses_in_schedule | Search courses by name/code | To find specific courses |
| find_light_semesters | Find semesters under X credits | When balancing credits |
| fill_semester_to_credits | Auto-add electives to reach X credits | To quickly fill a semester |
| add_course | Add one course | When adding a single course |
| remove_course | Remove one course | When removing a single course |
| move_course | Move course to different semester | When rescheduling |
| swap_courses | Exchange two courses | When swapping courses |
| swap_semesters | Swap two semesters' types/content | When swapping co-op with academic |
| add_semester | Add a new semester | To add Summer session or extra term |
| remove_semester | Remove an empty semester | To clean up schedule |
| set_semester_type | Change semester type | To convert academic to coop or vice versa |
| bulk_add_courses | Add multiple courses at once | When adding to multiple semesters |
| bulk_remove_courses | Remove multiple courses at once | When removing several courses |
| validate_schedule | Local validation (credits, placeholders, duplicates) | Returns issues + requiredSearches |
| ParallelSearch | Look up ANY school's requirements | For major, concentration, minor, gen-ed requirements |

## EXECUTION RULES

1. ALWAYS call get_schedule or get_credit_summary first to understand the current state
2. ALWAYS execute changes - do not just analyze and stop
3. Use fill_semester_to_credits to quickly bring a semester up to 16 credits
4. For bulk changes, use bulk_add_courses or bulk_remove_courses
5. Use find_light_semesters to identify semesters that need more courses
6. Co-op semesters have ZERO courses - use set_semester_type to convert if needed
7. After making changes, the tool returns the updated schedule

## SCHOOL-AGNOSTIC VALIDATION WORKFLOW

This system works for ANY university. Never assume course codes or requirements.

### CRITICAL: VERIFY CURRENT CURRICULUM
University curricula change frequently. When validating:
- Search for "${schoolName} ${major} current curriculum ${new Date().getFullYear()}"
- If a scheduled course code doesn't appear in search results, it may be OUTDATED
- Search for replacement courses if old courses are detected
- Common signs of outdated courses: "no longer offered", "replaced by", "formerly known as"

When validating:
1. Call validate_schedule → Returns localChecks + requiredSearches
2. Review localChecks:
   - placeholders: These are incomplete - need real courses
   - duplicates: Same course twice (usually wrong)
   - emptySemesters: Academic semesters with no courses
   - credits: informational only (degree requirements vary widely)
3. For each item in requiredSearches:
   - Use ParallelSearch with the provided query
   - Compare search results against scheduled courses
   - If courses don't match current catalog, search for updated versions
   - Add missing required courses (using CURRENT course codes)
4. Take action to fix all issues found

## CREDIT GUIDELINES

The schedule target is ${
      currentSchedule.totalCredits
    } credits, but degree requirements vary widely (120-140+ credits depending on program).

**Guidelines (not hard limits):**
- Target: ~${
      currentSchedule.totalCredits
    } credits (based on degree requirements)
- Typical semester: 12-18 credits
- If user wants to add courses, ADD THEM - don't refuse
- Only warn if total would exceed 150 credits (extreme case)

**When user asks to add courses:**
1. Just add the courses they request
2. Inform them of the new credit total
3. Do NOT refuse to add courses because of credit limits

**Only suggest removal if:**
- A semester would exceed 20 credits (overload)
- Total would exceed 150 credits (very unusual)

## EXAMPLES

Request: "Swap CS 1800 with MATH 1341"
→ Call get_schedule → Call swap_courses with courseCode1="CS 1800" and courseCode2="MATH 1341" → Done

Request: "Add a 4-credit elective to Fall 2025"
→ Call get_schedule → Call add_course with a known elective (e.g., ECON 1115) → Done

Request: "Make every semester have at least 16 credits"
→ Call find_light_semesters with minCredits=16 → Call bulk_add_courses with electives for all returned semesters → Done

Request: "Balance my schedule"
→ Call find_light_semesters → Add electives to light semesters using bulk_add_courses → Done

Request: "Add a math minor"
→ Call get_schedule → Search for ${schoolName} math minor requirements → Call bulk_add_courses with all minor courses → Done

Request: "Remove all my electives"
→ Call get_schedule → Identify elective courses → Call bulk_remove_courses with all elective codes → Done

Request: "Check if my schedule meets all requirements"
→ Call validate_schedule → Get localChecks and requiredSearches
→ For each requiredSearch, call ParallelSearch to look up actual requirements
→ Compare scheduled courses vs requirements found
→ Add missing courses OR replace placeholders → Done

Request: "Validate my schedule"
→ Call validate_schedule → Review localChecks:
  - If placeholders.count > 0: these need to be replaced with real courses
  - If duplicates found: remove duplicates
→ For concentration/minor, use requiredSearches with ParallelSearch
→ Take action to fix all issues → Done

Request: "Replace my elective placeholders"
→ Call validate_schedule → Get placeholders list
→ For each placeholder, search for appropriate courses at the student's school
→ Use add_course to replace each placeholder with a real course → Done

Request: "Add courses to fill my schedule"
→ Call get_credit_summary to see current vs target (${
      currentSchedule.totalCredits
    })
→ Calculate: credits_needed = ${currentSchedule.totalCredits} - current
→ If credits_needed <= 0: STOP - do not add anything
→ If credits_needed > 0: Add courses totaling EXACTLY that amount or less → Done

Request: "Move co-ops to Spring semesters"
→ Call get_schedule → For each co-op/academic pair, call swap_semesters to swap them → Done

Request: "Swap Summer 2027 co-op with Spring 2027"
→ Call swap_semesters with semester1="Spring 2027" and semester2="Summer 2027" → Done

Request: "Fill Fall 2025 to 16 credits"
→ Call fill_semester_to_credits with term="Fall 2025" and targetCredits=16 → Done

Request: "How many CS courses do I have?"
→ Call count_courses_by_type → Report the CS count → Done

Request: "Find all my electives"
→ Call find_courses_in_schedule with searchTerm="ELECTIVE" → Report results → Done

Request: "Add a Summer 2026 session"
→ Call add_semester with term="Summer 2026" and type="academic" → Done

Request: "Add Summer 2 semesters to every summer" (for schools with two summer terms like Northeastern)
→ Call get_schedule → For each Summer YYYY that exists, call add_semester with term="Summer 2 YYYY" → Done

Request: "Make Spring 2027 a co-op instead"
→ Call set_semester_type with term="Spring 2027" and newType="coop" → Done

## WHEN COMPLETE

After executing the changes, provide a SHORT, CONVERSATIONAL response in the "answer" field. This will be shown directly to the student in a chat interface.

CRITICAL RULES FOR YOUR ANSWER:
1. Write in plain, friendly English - like a helpful advisor talking to a student
2. NO markdown formatting (no **, *, #, -, bullets, or code blocks)
3. NO escape sequences or special characters
4. Keep it to 1-2 short sentences
5. Be specific about what you changed

Good examples:
- "Done! I moved CS 3500 from Fall 2026 to Spring 2027."
- "I've added the Economics minor courses to your schedule, spread across years 3 and 4."
- "All set! Swapped your Fall 2027 co-op with Spring 2027 so you can take classes in the spring."

Bad examples (DO NOT DO THESE):
- "**Schedule Updated**\\n\\nI have made the following changes:\\n- Moved CS 3500..."
- "Here is a summary of changes:\\n1. Added course..."
- Using any \\n, **, *, or other formatting

YOUR JOB IS NOT COMPLETE UNTIL YOU HAVE CALLED A TOOL TO IMPLEMENT THE USER'S REQUEST. This includes: add_course, remove_course, move_course, swap_courses, swap_semesters, bulk_add_courses, bulk_remove_courses, fill_semester_to_credits, add_semester, remove_semester, or set_semester_type.`;

    const client = getSubconsciousClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event with schedule ID
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "start",
                message: "Processing edit request...",
                scheduleId,
              })}\n\n`
            )
          );

          // Cast tools - the SDK types don't match the actual API schema for function tools with URLs
          const agentStream = client.stream({
            engine: DEFAULT_ENGINE,
            input: {
              instructions,
              tools: [
                ...tools,
                { type: "platform", id: "parallel_search", options: {} },
              ] as any,
            },
          });

          let fullContent = "";
          let lastSentThoughts: string[] = [];
          let lastSentToolCalls: string[] = [];
          let lastKnownVersion = await getScheduleVersion(scheduleId);

          // Helper to check for schedule updates and send tool_result
          const checkForScheduleUpdate = async () => {
            const updateInfo = await getLastUpdate(scheduleId);
            if (updateInfo && updateInfo.version > lastKnownVersion) {
              const latestSchedule = await getSchedule(scheduleId);
              if (latestSchedule) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool_result",
                      tool: updateInfo.tool,
                      schedule: latestSchedule,
                    })}\n\n`
                  )
                );
                lastKnownVersion = updateInfo.version;
              }
            }
          };

          for await (const event of agentStream) {
            // Check for schedule updates on every event
            await checkForScheduleUpdate();

            if (event.type === "delta") {
              fullContent += event.content;

              // Extract and send new thoughts
              const thoughts = extractThoughts(fullContent);
              const newThoughts = thoughts.filter(
                (t) => !lastSentThoughts.includes(t)
              );

              for (const thought of newThoughts) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "thought", thought })}\n\n`
                  )
                );
                lastSentThoughts.push(thought);
              }

              // Extract and send new tool calls
              const toolCalls = extractToolCalls(fullContent);
              for (const tc of toolCalls) {
                const key = `${tc.tool}:${JSON.stringify(tc.args)}`;
                if (!lastSentToolCalls.includes(key)) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_call",
                        tool: tc.tool,
                        args: tc.args,
                      })}\n\n`
                    )
                  );
                  lastSentToolCalls.push(key);
                }
              }
            } else if (event.type === "done") {
              // Final check for any pending updates
              await checkForScheduleUpdate();

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "thought",
                    thought: "Finalizing changes...",
                  })}\n\n`
                )
              );
            } else if (event.type === "error") {
              console.error("Stream error:", event.message);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "error",
                    message: event.message,
                  })}\n\n`
                )
              );
              controller.close();
              return;
            }
          }

          // Get the final schedule from the store
          const finalSchedule = await getSchedule(scheduleId);

          if (!finalSchedule) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: "Schedule expired or not found",
                })}\n\n`
              )
            );
            controller.close();
            return;
          }

          // Extract the AI's final answer/summary
          const aiAnswer = extractAnswer(fullContent);

          // Send complete event with final schedule and AI's response
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                schedule: finalSchedule,
                message: aiAnswer || "Schedule updated successfully.",
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error("Edit stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Schedule edit error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process edit request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
