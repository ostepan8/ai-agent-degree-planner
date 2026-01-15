import { NextRequest } from "next/server";
import {
  getSubconsciousClient,
  DEFAULT_ENGINE,
  parseAnswer,
} from "@/lib/subconscious";
import { type GenerateScheduleRequest, type TranscriptData, type SchedulePlan, type Semester } from "@/lib/schemas";
import { normalizeSchedule } from "@/lib/parseScheduleMarkdown";
import { validateSchedule } from "@/lib/validateSchedule";
import { buildScheduleInstructions } from "@/lib/generate_prompt.js";
import { buildRequirementsPrompt } from "@/lib/verification_prompt.js";
import {
  buildCompletionInstructions,
  buildRequirementsCheckPrompt,
} from "@/lib/completion_prompt.js";
import { groupCoursesBySemester, convertToScheduleSemesters } from "@/lib/transcript";

// Type for extracted requirements from Stage 1
interface ExtractedRequirements {
  school: string;
  major: string;
  catalogYear: string;
  totalCreditsRequired: number;
  estimatedSemesters: number;
  coreCourses: Array<{
    code: string;
    name: string;
    credits: number;
    prerequisites: string[];
    typicalSemester: number;
  }>;
  electiveCategories: Array<{
    name: string;
    creditsRequired: number;
    coursesRequired: number;
    approvedCourses: string[];
  }>;
  generalEducation: Array<{
    category: string;
    creditsRequired: number;
    courses: string[];
  }>;
  specialRequirements?: {
    coopRequired?: boolean;
    coopCount?: number;
    capstoneRequired?: boolean;
    capstoneCredits?: number;
  };
  warnings: string[];
  sourceUrl: string;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper to extract thought text from reasoning structure
function extractThoughts(content: string): string[] {
  const thoughts: string[] = [];

  // Try to find "thought": "..." patterns in the content
  const thoughtPattern = /"thought"\s*:\s*"([^"]+(?:\\.[^"]*)*?)"/g;
  let match;

  while ((match = thoughtPattern.exec(content)) !== null) {
    // Unescape the string
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
      thoughts.unshift(title); // Add titles at the beginning
    }
  }

  return thoughts;
}

// Helper to detect current phase from thoughts
function detectPhase(thoughts: string[]): string {
  const allText = thoughts.join(" ").toLowerCase();

  if (
    allText.includes("prerequisite") ||
    allText.includes("validat") ||
    allText.includes("verify")
  ) {
    return "validating";
  } else if (
    allText.includes("semester") ||
    allText.includes("schedule") ||
    allText.includes("sequence") ||
    allText.includes("plan")
  ) {
    return "building";
  } else if (
    allText.includes("requirement") ||
    allText.includes("credit") ||
    allText.includes("course") ||
    allText.includes("extract")
  ) {
    return "extracting";
  } else if (
    allText.includes("search") ||
    allText.includes("catalog") ||
    allText.includes("find")
  ) {
    return "searching";
  }
  return "searching";
}

// Helper to extract requirements JSON from content (Stage 1)
function extractRequirementsFromContent(
  content: string
): ExtractedRequirements | null {
  try {
    // Try to parse the full response
    const response = JSON.parse(content);

    if (response.answer) {
      let requirements = response.answer;
      if (typeof requirements === "string") {
        requirements = JSON.parse(requirements);
      }

      // Validate it has required fields
      if (requirements.school && requirements.coreCourses) {
        return requirements as ExtractedRequirements;
      }
    }
  } catch {
    // Full parse failed, try pattern matching
  }

  // Fallback: Try to find answer string pattern
  const answerStringMatch = content.match(
    /"answer"\s*:\s*"(\{[\s\S]*?\})"\s*\}/
  );
  if (answerStringMatch) {
    try {
      const unescaped = answerStringMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      const parsed = JSON.parse(unescaped);
      if (parsed.school && parsed.coreCourses) {
        return parsed as ExtractedRequirements;
      }
    } catch {
      // Continue
    }
  }

  // Try to find requirements-like object
  try {
    const startIdx = content.lastIndexOf('{"school"');
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
        if (parsed.coreCourses || parsed.totalCreditsRequired) {
          return parsed as ExtractedRequirements;
        }
      }
    }
  } catch {
    // Failed
  }

  return null;
}

// Helper to extract schedule JSON from content
// Without answerFormat, TIM-large returns: {"reasoning": [...], "answer": "{...json string...}"}
// The answer is a JSON STRING that needs to be parsed
function extractScheduleFromContent(content: string): object | null {
  try {
    // Try to parse the full response
    const response = JSON.parse(content);

    if (response.answer) {
      // If answer is a string, parse it
      let schedule = response.answer;
      if (typeof schedule === "string") {
        schedule = JSON.parse(schedule);
      }

      // Validate it has required fields
      if (schedule.school && schedule.semesters) {
        return schedule;
      }
    }
  } catch {
    // Full parse failed, try pattern matching
  }

  // Fallback: Try to find an answer string pattern and parse it
  // Pattern: "answer": "{...escaped json...}"
  const answerStringMatch = content.match(
    /"answer"\s*:\s*"(\{[\s\S]*?\})"\s*\}/
  );
  if (answerStringMatch) {
    try {
      // Unescape the JSON string
      const unescaped = answerStringMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      const parsed = JSON.parse(unescaped);
      if (parsed.school && parsed.semesters) {
        return parsed;
      }
    } catch {
      // Continue to other methods
    }
  }

  // Fallback: Try to find answer as object (old format with answerFormat)
  const answerObjMatch = content.match(/"answer"\s*:\s*(\{[\s\S]*?\})\s*[,}]/);
  if (answerObjMatch) {
    try {
      const parsed = JSON.parse(answerObjMatch[1]);
      if (parsed.school && parsed.major) {
        return parsed;
      }
    } catch {
      // Continue
    }
  }

  // Final fallback: Find any schedule-like object
  try {
    const startIdx = content.lastIndexOf('{"school"');
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
          return parsed;
        }
      }
    }
  } catch {
    // All methods failed
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateScheduleRequest;
    const { school, major, completedCourses, preferences, isFreshman } = body;

    if (!school || !major || !preferences) {
      return new Response(
        JSON.stringify({
          error: "School, major, and preferences are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Group completed courses by semester and separate transfer credits
    let transcriptData: TranscriptData | null = null;
    if (!isFreshman && completedCourses && completedCourses.length > 0) {
      transcriptData = groupCoursesBySemester(completedCourses);
    }

    // Build completed courses text for non-freshmen (legacy format for backward compatibility)
    const completedCoursesText = isFreshman
      ? undefined
      : `The student has completed the following courses:\n${completedCourses
          .map(
            (c) => `- ${c.code}: ${c.name} (${c.credits} credits, ${c.grade})`
          )
          .join("\n")}`;

    const client = getSubconsciousClient();

    // Create a streaming response using Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "start",
                message: "Starting two-stage schedule generation...",
              })}\n\n`
            )
          );

          // ==================== STAGE 1: REQUIREMENTS EXTRACTION ====================
          // Determine if we're in completion mode early for Stage 1
          const hasTranscriptDataForStage1 = transcriptData && transcriptData.completedSemesters.length > 0;
          
          // Send explicit stage event for stage 1
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "stage",
                stage: 1,
                name: hasTranscriptDataForStage1 ? "Analyzing Remaining Requirements" : "Researching Requirements",
                estimatedMinutes: hasTranscriptDataForStage1 ? 1 : 1.5,
              })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "thought",
                thought: hasTranscriptDataForStage1
                  ? "Analyzing what requirements you still need to complete..."
                  : "Searching university catalog for degree requirements...",
                phase: "requirements",
              })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "phase",
                phase: "requirements",
              })}\n\n`
            )
          );

          // Build requirements prompt - use completion-focused prompt if transcript exists
          let requirementsPrompt: string;
          
          if (hasTranscriptDataForStage1 && transcriptData) {
            // Use lighter requirements check that focuses on what's remaining
            requirementsPrompt = buildRequirementsCheckPrompt({
              school,
              major,
              transcriptData,
              preferences: {
                startingSemester: preferences.startingSemester,
                creditsPerSemester: preferences.creditsPerSemester,
                coopPlan: preferences.coopPlan,
                additionalNotes: preferences.additionalNotes,
              },
            });
          } else {
            // Use full requirements extraction for freshmen
            requirementsPrompt = buildRequirementsPrompt({
              school,
              major,
              concentration: undefined,
              minor: undefined,
            });
          }

          let extractedRequirements: ExtractedRequirements | null = null;
          let stage1Content = "";
          let stage1Thoughts: string[] = [];

          try {
            const requirementsStream = client.stream({
              engine: DEFAULT_ENGINE,
              input: {
                instructions: requirementsPrompt,
                tools: [
                  { type: "platform", id: "parallel_search", options: {} },
                ],
              },
            });

            let stage1RunId: string | undefined;

            for await (const event of requirementsStream) {
              if (event.type === "delta") {
                stage1Content += event.content;

                // Extract and send thoughts
                const thoughts = extractThoughts(stage1Content);
                const newThoughts = thoughts.filter(
                  (t) => !stage1Thoughts.includes(t)
                );

                for (const thought of newThoughts) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "thought",
                        thought,
                        phase: "requirements",
                      })}\n\n`
                    )
                  );
                  stage1Thoughts.push(thought);
                }
              } else if (event.type === "done") {
                stage1RunId = event.runId;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "thought",
                      thought:
                        "Requirements research complete. Processing results...",
                      phase: "requirements",
                    })}\n\n`
                  )
                );
              } else if (event.type === "error") {
                // Don't fail completely - continue without requirements
                break;
              }
            }

            // Try to get requirements from API
            if (stage1RunId) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              try {
                const finalRun = await client.get(stage1RunId);
                if (finalRun.result?.answer) {
                  let answer: unknown = finalRun.result.answer;
                  if (typeof answer === "string") {
                    answer = JSON.parse(answer);
                  }
                  const answerObj = answer as Record<string, unknown>;
                  if (answerObj.coreCourses || answerObj.totalCreditsRequired) {
                    extractedRequirements =
                      answerObj as unknown as ExtractedRequirements;
                  }
                }
              } catch {
                // Failed to get requirements from API
              }
            }

            // Fallback: extract from content
            if (!extractedRequirements) {
              extractedRequirements =
                extractRequirementsFromContent(stage1Content);
            }
          } catch {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "thought",
                  thought:
                    "Could not extract requirements. Proceeding with direct generation...",
                  phase: "searching",
                })}\n\n`
              )
            );
          }

          if (extractedRequirements) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "thought",
                  thought: `Found ${
                    extractedRequirements.coreCourses?.length || 0
                  } required courses, ${
                    extractedRequirements.totalCreditsRequired || 128
                  } total credits needed.`,
                  phase: "requirements",
                })}\n\n`
              )
            );
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "thought",
                  thought: "Proceeding with catalog search for requirements...",
                  phase: "requirements",
                })}\n\n`
              )
            );
          }

          // ==================== STAGE 2: SCHEDULE GENERATION ====================
          // Determine if we're in completion mode (has transcript data)
          const isCompletionMode = transcriptData && transcriptData.completedSemesters.length > 0;
          
          // Send explicit stage event for stage 2
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "stage",
                stage: 2,
                name: isCompletionMode ? "Completing Your Schedule" : "Building Your Schedule",
                estimatedMinutes: isCompletionMode ? 2 : 2.5,
              })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "thought",
                thought: isCompletionMode
                  ? "Analyzing remaining requirements and building completion plan..."
                  : "Analyzing course prerequisites and building semester plan...",
                phase: "building",
              })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "phase",
                phase: "building",
              })}\n\n`
            )
          );

          // Build schedule instructions - use completion pipeline if transcript data exists
          let instructions: string;
          
          if (isCompletionMode && transcriptData) {
            // COMPLETION PIPELINE: Student has completed courses
            // Use dedicated completion prompt that treats past courses as immutable
            instructions = buildCompletionInstructions({
              school,
              major,
              transcriptData,
              preferences: {
                startingSemester: preferences.startingSemester,
                creditsPerSemester: preferences.creditsPerSemester,
                coopPlan: preferences.coopPlan,
                additionalNotes: preferences.additionalNotes,
              },
              extractedRequirements: extractedRequirements || undefined,
            });
          } else {
            // FULL GENERATION PIPELINE: Freshman or no transcript
            instructions = buildScheduleInstructions({
              school,
              major,
              preferences: {
                startingSemester: preferences.startingSemester,
                creditsPerSemester: preferences.creditsPerSemester,
                coopPlan: preferences.coopPlan,
                additionalNotes: preferences.additionalNotes,
              },
              studentContext: {
                isFreshman,
                completedCoursesText,
              },
              extractedRequirements: extractedRequirements || undefined,
            });
          }

          const agentStream = client.stream({
            engine: DEFAULT_ENGINE,
            input: {
              instructions,
              tools: [{ type: "platform", id: "parallel_search", options: {} }],
            },
          });

          let fullContent = "";
          let lastRunId: string | undefined;
          let lastSentThoughts: string[] = [];
          let streamCompleted = false;

          for await (const event of agentStream) {
            if (event.type === "delta") {
              fullContent += event.content;

              // Extract thoughts from accumulated content
              const thoughts = extractThoughts(fullContent);
              const phase = detectPhase(thoughts);

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
                        phase,
                      })}\n\n`
                    )
                  );
                  lastSentThoughts.push(thought);
                }
              }

              // Send phase updates
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "phase", phase })}\n\n`
                )
              );
            } else if (event.type === "done") {
              lastRunId = event.runId;
              streamCompleted = true;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "thought",
                    thought: "Finalizing your personalized schedule...",
                    phase: "validating",
                  })}\n\n`
                )
              );
            } else if (event.type === "error") {
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

          // Stream has ended, now get the final result
          // Send update that we're now in post-processing phase
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "thought",
                thought:
                  "AI generation complete. Retrieving and processing results...",
                phase: "validating",
              })}\n\n`
            )
          );

          let schedule = null;

          // Method 1: Try to get result from the API (with retry)
          if (lastRunId) {
            // Wait a moment for the run to finalize
            await new Promise((resolve) => setTimeout(resolve, 1000));

            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const finalRun = await client.get(lastRunId);

                if (finalRun.result?.answer) {
                  try {
                    // The answer might be a JSON string
                    if (typeof finalRun.result.answer === "string") {
                      schedule = JSON.parse(finalRun.result.answer);
                    } else {
                      schedule = finalRun.result.answer;
                    }
                    break; // Success, exit retry loop
                  } catch {
                    // If it's not valid JSON, maybe it's already an object
                    if (typeof finalRun.result.answer === "object") {
                      schedule = finalRun.result.answer;
                      break;
                    }
                  }
                }

                // If run not succeeded, wait and retry
                if (finalRun.status !== "succeeded") {
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                } else {
                  break; // Run succeeded, no point retrying
                }
              } catch {
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          }

          // Method 2: Try to extract from streamed content
          if (!schedule) {
            schedule = extractScheduleFromContent(fullContent);
          }

          // Method 3: Create a minimal schedule structure from available info
          if (!schedule) {
            schedule = {
              school: school.name,
              major: major,
              startTerm: preferences.startingSemester,
              graduationTerm: "TBD",
              totalCredits: 128,
              semesters: [],
              warnings: [
                "Schedule generation encountered an issue. Please verify requirements with your academic advisor.",
              ],
              sourceUrl: school.catalogUrl,
            };
          }

          // Check if semesters is a placeholder string (AI failed to complete)
          if (
            typeof schedule.semesters === "string" &&
            (schedule.semesters.includes("TBD") ||
              schedule.semesters.includes("to be filled") ||
              schedule.semesters.includes("To be filled") ||
              !schedule.semesters.trim().startsWith("["))
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message:
                    "The AI did not complete the schedule. Please try again.",
                })}\n\n`
              )
            );
            controller.close();
            return;
          }

          // NORMALIZE: Handle all edge cases (stringified JSON, markdown, missing fields)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "thought",
                thought: "Normalizing schedule structure...",
                phase: "validating",
              })}\n\n`
            )
          );

          const normalizedSchedule = normalizeSchedule(schedule);

          // Check if we got a valid schedule with actual semesters
          // In completion mode (transcriptData exists), we need to calculate remaining credits
          // to determine if new semesters are expected
          const hasTranscriptData = transcriptData && transcriptData.completedSemesters.length > 0;
          
          // Calculate remaining credits to determine minimum expected semesters
          let remainingCredits = 128; // Default assumption
          let completedCredits = 0;
          
          if (hasTranscriptData && transcriptData) {
            completedCredits = transcriptData.totalCompletedCredits + transcriptData.totalTransferCredits;
            const degreeCredits = extractedRequirements?.totalCreditsRequired || 128;
            remainingCredits = Math.max(0, degreeCredits - completedCredits);
          }
          
          // Calculate minimum expected semesters based on remaining credits
          // Each semester is typically 15-18 credits, so use 16 as threshold
          // If remaining > 16, expect at least 1 semester; if > 32, expect at least 2, etc.
          const expectedRemainingSemesters = hasTranscriptData 
            ? Math.ceil(remainingCredits / 16)
            : 4;
          
          if (
            !normalizedSchedule.semesters ||
            normalizedSchedule.semesters.length === 0
          ) {
            if (!hasTranscriptData) {
              // No transcript data and no generated semesters - this is a real failure
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "error",
                    message:
                      "Failed to generate a complete schedule. Please try again.",
                  })}\n\n`
                )
              );
              controller.close();
              return;
            } else if (remainingCredits > 16) {
              // Student has significant credits remaining but no semesters generated - this is an error
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "error",
                    message:
                      "Failed to generate remaining semesters. Please try again.",
                  })}\n\n`
                )
              );
              controller.close();
              return;
            } else {
              // Student is near graduation (<=16 credits remaining), allow empty with warning
              normalizedSchedule.semesters = [];
              if (!normalizedSchedule.warnings) {
                normalizedSchedule.warnings = [];
              }
              normalizedSchedule.warnings.push(
                `You have ${remainingCredits} credits remaining. Please verify final requirements with your advisor.`
              );
            }
          }

          // Check if we have at least some academic semesters with courses
          // In completion mode, minimum is based on remaining credits; otherwise require 4+
          const academicSemesters = normalizedSchedule.semesters.filter(
            (s) => s.type === "academic" && s.courses && s.courses.length > 0
          );
          
          // For completion mode: require at least 1 semester if remaining credits > 16
          // For freshman mode: require at least 4 semesters
          const minSemesters = hasTranscriptData 
            ? (remainingCredits > 16 ? 1 : 0)
            : 4;
          
          if (academicSemesters.length < minSemesters) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: hasTranscriptData 
                    ? "Failed to generate remaining semesters. Please try again."
                    : "The schedule is incomplete. Please try again.",
                })}\n\n`
              )
            );
            controller.close();
            return;
          } else if (
            academicSemesters.length < expectedRemainingSemesters &&
            hasTranscriptData
          ) {
            // Add warning if fewer semesters than expected based on remaining credits
            if (!normalizedSchedule.warnings) {
              normalizedSchedule.warnings = [];
            }
            normalizedSchedule.warnings.push(
              `Generated ${academicSemesters.length} semesters for ` +
              `${remainingCredits} remaining credits. Verify with your advisor.`
            );
          } else if (academicSemesters.length < 4 && !hasTranscriptData) {
            // Add warning if fewer than expected but still acceptable for freshman
            if (!normalizedSchedule.warnings) {
              normalizedSchedule.warnings = [];
            }
            normalizedSchedule.warnings.push(
              `Schedule has only ${academicSemesters.length} academic semesters. Verify with your advisor.`
            );
          }

          // VALIDATE: Remove duplicates, flag placeholders, fix credit totals, trim excess electives
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "thought",
                thought:
                  "Validating schedule: checking for duplicates, verifying credits, ensuring prerequisites...",
                phase: "validating",
              })}\n\n`
            )
          );

          const validationResult = validateSchedule(normalizedSchedule, {
            schoolId: school.id,
            trimExcessCredits: true,
          });

          const finalSchedule = validationResult.schedule;

          // ==================== MERGE COMPLETED SEMESTERS ====================
          // If we have transcript data, merge completed semesters and transfer credits
          // Extended schedule type to include transfer credits
          type ExtendedSchedule = typeof finalSchedule & {
            transferCredits?: Array<{
              code: string;
              name: string;
              credits: number;
              grade?: string;
            }>;
          };
          
          let mergedSchedule: ExtendedSchedule = finalSchedule;
          
          if (transcriptData && transcriptData.completedSemesters.length > 0) {
            // Convert completed semesters to schedule format
            const completedSemesters = convertToScheduleSemesters(transcriptData);
            
            // Mark AI-generated semesters as "planned"
            const plannedSemesters = finalSchedule.semesters.map((sem) => ({
              ...sem,
              status: "planned" as const,
            }));
            
            // Combine: completed first, then planned
            const allSemesters = [
              ...completedSemesters,
              ...plannedSemesters,
            ] as Semester[];
            
            // Calculate total credits including completed
            const totalCompletedCredits = transcriptData.totalCompletedCredits + transcriptData.totalTransferCredits;
            const totalCredits = totalCompletedCredits + finalSchedule.totalCredits;
            
            // Build merged schedule with transfer credits
            mergedSchedule = {
              ...finalSchedule,
              semesters: allSemesters,
              totalCredits,
              transferCredits: transcriptData.transferCredits.map((c) => ({
                code: c.code,
                name: c.name,
                credits: c.credits,
                grade: c.grade,
              })),
            };
          }

          // Send validation complete update
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "thought",
                thought:
                  "Validation complete! Your personalized degree plan is ready.",
                phase: "complete",
              })}\n\n`
            )
          );

          // Send the complete event with merged schedule
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                schedule: mergedSchedule,
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
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
    console.error("Schedule stream error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to start schedule generation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
