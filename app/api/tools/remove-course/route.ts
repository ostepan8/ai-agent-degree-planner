import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule, recalculateSemesterCredits } from '@/lib/scheduleStore';
import type { SchedulePlan } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subconscious sends: { tool_name, parameters: {...}, request_id }
interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: { scheduleId?: string; courseCode?: string };
  request_id?: string;
  // Also support direct format for testing
  scheduleId?: string;
  courseCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    
    // Extract from either Subconscious format or direct format
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const courseCode = body.parameters?.courseCode || body.courseCode;

    if (!scheduleId || !courseCode) {
      return Response.json(
        { success: false, message: 'scheduleId and courseCode are required' },
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

    // Normalize course code
    const normalizedCode = courseCode.toUpperCase().replace(/\s+/g, ' ').trim();

    // Find the course
    let foundSemesterIndex = -1;
    let courseName = '';

    for (let i = 0; i < schedule.semesters.length; i++) {
      const sem = schedule.semesters[i];
      if (sem.type === 'academic' && sem.courses) {
        const course = sem.courses.find(
          c => c.code.toUpperCase().replace(/\s+/g, ' ').trim() === normalizedCode
        );
        if (course) {
          foundSemesterIndex = i;
          courseName = course.name;
          break;
        }
      }
    }

    if (foundSemesterIndex === -1) {
      return Response.json(
        { success: false, message: `Course "${courseCode}" not found in schedule` },
        { status: 404 }
      );
    }

    // Remove the course
    const updatedSemesters = [...schedule.semesters];
    const sem = updatedSemesters[foundSemesterIndex];
    
    if (sem.type === 'academic' && sem.courses) {
      updatedSemesters[foundSemesterIndex] = {
        ...sem,
        courses: sem.courses.filter(
          c => c.code.toUpperCase().replace(/\s+/g, ' ').trim() !== normalizedCode
        ),
      };
    }

    let updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
    };

    // Recalculate credits
    updatedSchedule = recalculateSemesterCredits(updatedSchedule);

    await updateSchedule(scheduleId, updatedSchedule, 'remove_course');

    const semTerm = schedule.semesters[foundSemesterIndex].term;

    return Response.json({
      success: true,
      message: `Removed "${courseCode}: ${courseName}" from ${semTerm}`,
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('remove-course error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

