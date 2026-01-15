import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule, recalculateSemesterCredits } from '@/lib/scheduleStore';
import type { SchedulePlan, ScheduleCourse } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pool of electives to choose from when filling semesters
const ELECTIVE_POOL: ScheduleCourse[] = [
  { code: 'ECON 1115', name: 'Principles of Macroeconomics', credits: 4 },
  { code: 'PHIL 1101', name: 'Introduction to Philosophy', credits: 4 },
  { code: 'PSYCH 1101', name: 'Introduction to Psychology', credits: 4 },
  { code: 'SOCL 1101', name: 'Introduction to Sociology', credits: 4 },
  { code: 'POLS 1150', name: 'U.S. Politics', credits: 4 },
  { code: 'HIST 1150', name: 'Global Social Movements', credits: 4 },
  { code: 'COMM 1112', name: 'Public Speaking', credits: 4 },
  { code: 'MUSC 1201', name: 'Music Theory', credits: 4 },
  { code: 'ANTH 1101', name: 'Introduction to Anthropology', credits: 4 },
  { code: 'ENVR 1101', name: 'Environmental Science', credits: 4 },
];

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
    term?: string;
    targetCredits?: number;
  };
  request_id?: string;
  scheduleId?: string;
  term?: string;
  targetCredits?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubconsciousToolRequest;

    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const term = body.parameters?.term || body.term;
    const targetCredits = body.parameters?.targetCredits || body.targetCredits || 16;

    if (!scheduleId || !term) {
      return Response.json(
        { success: false, message: 'scheduleId and term are required' },
        { status: 400 }
      );
    }

    const schedule = await getSchedule(scheduleId);

    if (!schedule) {
      return Response.json(
        { success: false, message: 'Schedule not found or expired' },
        { status: 404 }
      );
    }

    // Find the semester
    const semesterIndex = schedule.semesters.findIndex(
      (sem) => sem.term.toLowerCase() === term.toLowerCase()
    );

    if (semesterIndex === -1) {
      return Response.json(
        { success: false, message: `Semester "${term}" not found` },
        { status: 404 }
      );
    }

    const semester = schedule.semesters[semesterIndex];

    if (semester.type === 'coop') {
      return Response.json(
        { success: false, message: `Cannot add courses to co-op semester "${term}"` },
        { status: 400 }
      );
    }

    const currentCredits = semester.totalCredits || 0;

    if (currentCredits >= targetCredits) {
      return Response.json({
        success: true,
        message: `${term} already has ${currentCredits} credits (target: ${targetCredits})`,
        data: { currentCredits, targetCredits, added: [] },
      });
    }

    // Get all course codes already in the schedule (to avoid duplicates)
    const existingCodes = new Set<string>();
    for (const sem of schedule.semesters) {
      if (sem.type === 'academic' && sem.courses) {
        for (const course of sem.courses) {
          existingCodes.add(course.code.toUpperCase());
        }
      }
    }

    // Add electives until we reach target
    const addedCourses: ScheduleCourse[] = [];
    let newCredits = currentCredits;

    for (const elective of ELECTIVE_POOL) {
      if (newCredits >= targetCredits) break;
      
      if (!existingCodes.has(elective.code.toUpperCase())) {
        addedCourses.push(elective);
        existingCodes.add(elective.code.toUpperCase());
        newCredits += elective.credits;
      }
    }

    if (addedCourses.length === 0) {
      return Response.json({
        success: false,
        message: 'No available electives to add (all already in schedule)',
      });
    }

    // Update the semester
    const updatedSemesters = [...schedule.semesters];
    updatedSemesters[semesterIndex] = {
      ...semester,
      courses: [...(semester.courses || []), ...addedCourses],
    };

    let updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
    };

    updatedSchedule = recalculateSemesterCredits(updatedSchedule);
    await updateSchedule(scheduleId, updatedSchedule, 'fill_semester_to_credits');

    const addedStr = addedCourses.map(c => `${c.code} (${c.credits}cr)`).join(', ');

    return Response.json({
      success: true,
      message: `Added ${addedCourses.length} elective(s) to ${term}: ${addedStr}. Now at ${newCredits} credits.`,
      data: {
        previousCredits: currentCredits,
        newCredits,
        targetCredits,
        added: addedCourses.map(c => c.code),
      },
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('fill-semester-to-credits error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

