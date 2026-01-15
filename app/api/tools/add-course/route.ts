import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule, recalculateSemesterCredits } from '@/lib/scheduleStore';
import type { SchedulePlan, ScheduleCourse } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subconscious sends: { tool_name, parameters: {...}, request_id }
interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: { 
    scheduleId?: string; 
    toSemester?: string; 
    courseCode?: string; 
    courseName?: string; 
    credits?: number;
    options?: string;
  };
  request_id?: string;
  // Also support direct format for testing
  scheduleId?: string;
  toSemester?: string;
  courseCode?: string;
  courseName?: string;
  credits?: number;
  options?: string;
}

export async function POST(request: NextRequest) {
  console.log('\n=== TOOL: add-course called ===');
  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log('Body:', JSON.stringify(body));
    
    // Extract from either Subconscious format or direct format
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const toSemester = body.parameters?.toSemester || body.toSemester;
    const courseCode = body.parameters?.courseCode || body.courseCode;
    const courseName = body.parameters?.courseName || body.courseName;
    const credits = body.parameters?.credits ?? body.credits;
    const options = body.parameters?.options || body.options;

    if (!scheduleId || !toSemester || !courseCode || !courseName || credits === undefined) {
      return Response.json(
        { 
          success: false, 
          message: 'scheduleId, toSemester, courseCode, courseName, and credits are required' 
        },
        { status: 400 }
      );
    }

    // Validate credits
    if (typeof credits !== 'number' || credits < 1 || credits > 6) {
      return Response.json(
        { success: false, message: 'credits must be a number between 1 and 6' },
        { status: 400 }
      );
    }

    const schedule = getSchedule(scheduleId);

    if (!schedule) {
      return Response.json(
        { success: false, message: 'Schedule not found or expired' },
        { status: 404 }
      );
    }

    // Find target semester
    const targetSemesterIndex = schedule.semesters.findIndex(
      sem => sem.term.toLowerCase() === toSemester.toLowerCase()
    );

    if (targetSemesterIndex === -1) {
      const availableTerms = schedule.semesters.map(s => s.term).join(', ');
      return Response.json(
        { 
          success: false, 
          message: `Semester "${toSemester}" not found. Available: ${availableTerms}` 
        },
        { status: 404 }
      );
    }

    const targetSemester = schedule.semesters[targetSemesterIndex];
    if (targetSemester.type === 'coop') {
      return Response.json(
        { success: false, message: `Cannot add course to co-op semester "${toSemester}"` },
        { status: 400 }
      );
    }

    // Check if course already exists in schedule
    const normalizedCode = courseCode.toUpperCase().replace(/\s+/g, ' ').trim();
    for (const sem of schedule.semesters) {
      if (sem.type === 'academic' && sem.courses) {
        const exists = sem.courses.some(
          c => c.code.toUpperCase().replace(/\s+/g, ' ').trim() === normalizedCode
        );
        if (exists) {
          return Response.json(
            { success: false, message: `Course "${courseCode}" already exists in ${sem.term}` },
            { status: 400 }
          );
        }
      }
    }

    // Create the new course
    const newCourse: ScheduleCourse = {
      code: courseCode,
      name: courseName,
      credits: Math.round(credits),
    };

    if (options) {
      (newCourse as ScheduleCourse & { options?: string }).options = options;
    }

    // Add to target semester
    const updatedSemesters = [...schedule.semesters];
    const targetSem = updatedSemesters[targetSemesterIndex];
    
    if (targetSem.type === 'academic') {
      updatedSemesters[targetSemesterIndex] = {
        ...targetSem,
        courses: [...(targetSem.courses || []), newCourse],
      };
    }

    let updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
    };

    // Recalculate credits
    updatedSchedule = recalculateSemesterCredits(updatedSchedule);

    updateSchedule(scheduleId, updatedSchedule, 'add_course');

    return Response.json({
      success: true,
      message: `Added "${courseCode}: ${courseName}" (${credits}cr) to ${toSemester}`,
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('add-course error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

