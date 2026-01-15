import { NextRequest } from "next/server";
import { getSubconsciousClient, DEFAULT_ENGINE } from "@/lib/subconscious";
import type { SchedulePlan } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchRequest {
  currentSchedule: SchedulePlan;
  editRequest: string;
}

// Helper to extract thought text from reasoning structure (same as stream route)
function extractThoughts(content: string): string[] {
  const thoughts: string[] = [];

  // Try to find "thought": "..." patterns in the content
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

  // Also try to find "title": "..." patterns for context
  const titlePattern = /"title"\s*:\s*"([^"]+)"/g;
  while ((match = titlePattern.exec(content)) !== null) {
    const title = match[1].trim();
    if (title && title.length > 5 && !thoughts.includes(title)) {
      thoughts.unshift(title);
    }
  }

  return thoughts;
}

// Helper to extract schedule JSON from content
function extractScheduleFromContent(content: string): SchedulePlan | null {
  // Method 1: Try to parse as full response with answer field
  try {
    const response = JSON.parse(content);
    if (response.answer) {
      let schedule = response.answer;
      if (typeof schedule === "string") {
        schedule = JSON.parse(schedule);
      }
      if (schedule.school && schedule.semesters) {
        return schedule as SchedulePlan;
      }
    }
  } catch {
    // Continue to other methods
  }

  // Method 2: Find answer string pattern
  const answerStringMatch = content.match(
    /"answer"\s*:\s*"(\{[\s\S]*?\})"\s*[,}]/
  );
  if (answerStringMatch) {
    try {
      const unescaped = answerStringMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      const parsed = JSON.parse(unescaped);
      if (parsed.school && parsed.semesters) {
        return parsed as SchedulePlan;
      }
    } catch {
      // Continue
    }
  }

  // Method 3: Find schedule object directly
  try {
    const startPatterns = ['{"school"', '{ "school"'];
    for (const pattern of startPatterns) {
      const startIdx = content.indexOf(pattern);
      if (startIdx !== -1) {
        let depth = 0;
        let endIdx = startIdx;
        for (let i = startIdx; i < content.length; i++) {
          if (content[i] === "{") depth++;
          else if (content[i] === "}") {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
        if (endIdx > startIdx) {
          const parsed = JSON.parse(content.substring(startIdx, endIdx));
          if (parsed.school && parsed.semesters) {
            return parsed as SchedulePlan;
          }
        }
      }
    }
  } catch {
    // Extraction failed
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PatchRequest;
    const { currentSchedule, editRequest } = body;

    if (!currentSchedule || !editRequest) {
      return new Response(
        JSON.stringify({
          error: "Current schedule and edit request are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const instructions = `You are a schedule editing assistant. Make MINIMAL, TARGETED changes to this schedule based on the user's request.

## CURRENT SCHEDULE
${JSON.stringify(currentSchedule, null, 2)}

## USER REQUEST
"${editRequest}"

## RULES
- Make ONLY the changes requested
- Preserve everything else exactly
- Keep semester totalCredits accurate
- Add a note to warnings describing what was changed

## OUTPUT
Return the complete updated schedule as JSON with the same structure:
{
  "school": "...",
  "major": "...",
  "degree": "...",
  "startTerm": "...",
  "graduationTerm": "...",
  "totalCredits": number,
  "semesters": [...],
  "warnings": [...],
  "sourceUrl": "..."
}`;

    const client = getSubconsciousClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "start",
                message: "Processing edit request...",
              })}\n\n`
            )
          );

          const agentStream = client.stream({
            engine: DEFAULT_ENGINE,
            input: {
              instructions,
              tools: [], // No search needed for patching
            },
          });

          let fullContent = "";
          let lastRunId: string | undefined;
          let lastSentThoughts: string[] = [];
          let streamCompleted = false;

          for await (const event of agentStream) {
            if (event.type === "delta") {
              fullContent += event.content;

              // Extract thoughts from accumulated content (same pattern as stream route)
              const thoughts = extractThoughts(fullContent);

              // Find new thoughts that haven't been sent yet
              const newThoughts = thoughts.filter(
                (t) => !lastSentThoughts.includes(t)
              );

              if (newThoughts.length > 0) {
                for (const thought of newThoughts) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "thought",
                        thought,
                      })}\n\n`
                    )
                  );
                  lastSentThoughts.push(thought);
                }
              }
            } else if (event.type === "done") {
              lastRunId = event.runId;
              streamCompleted = true;
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

          // Get the final result
          let patchedSchedule: SchedulePlan | null = null;

          if (lastRunId) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const finalRun = await client.get(lastRunId);

                if (finalRun.result?.answer) {
                  const answer =
                    typeof finalRun.result.answer === "string"
                      ? JSON.parse(finalRun.result.answer)
                      : finalRun.result.answer;

                  if (answer.school && answer.semesters) {
                    patchedSchedule = answer as SchedulePlan;
                    break;
                  }
                }

                if (finalRun.status !== "succeeded") {
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                } else {
                  break;
                }
              } catch {
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          }

          // Fallback: extract from content
          if (!patchedSchedule) {
            patchedSchedule = extractScheduleFromContent(fullContent);
          }

          // Final fallback: return original with warning
          if (!patchedSchedule) {
            patchedSchedule = {
              ...currentSchedule,
              warnings: [
                ...(currentSchedule.warnings || []),
                "Edit could not be processed. Please try rephrasing.",
              ],
            };
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                schedule: patchedSchedule,
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error("Patch error:", error);
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
    console.error("Schedule patch error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process edit request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
