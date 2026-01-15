import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule, recalculateSemesterCredits } from '@/lib/scheduleStore';
import type { SchedulePlan, ScheduleCourse } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subconscious sends: { tool_name, parameters: {...}, request_id }
interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: { scheduleId?: string; courseCode?: string; toSemester?: string };
  request_id?: string;
  // Also support direct format for testing
  scheduleId?: string;
  courseCode?: string;
  toSemester?: string;
}

export async function POST(request: NextRequest) {
  console.log('\n=== TOOL: move-course called ===');
  
  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log('Body:', JSON.stringify(body));
    
    // Extract from either Subconscious format or direct format
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const courseCode = body.parameters?.courseCode || body.courseCode;
    const toSemester = body.parameters?.toSemester || body.toSemester;

    if (!scheduleId || !courseCode || !toSemester) {
      console.log('ERROR: Missing required fields');
      return Response.json(
        { success: false, message: 'scheduleId, courseCode, and toSemester are required' },
        { status: 400 }
      );
    }

    const schedule = await getSchedule(scheduleId);
    console.log('Schedule found:', !!schedule);

    if (!schedule) {
      return Response.json(
        { success: false, message: 'Schedule not found or expired' },
        { status: 404 }
      );
    }

    // Normalize course code for comparison (handle spaces, case)
    const normalizedCode = courseCode.toUpperCase().replace(/\s+/g, ' ').trim();

    // Find the course and its current semester
    let foundCourse: ScheduleCourse | null = null;
    let sourceSemesterIndex = -1;

    for (let i = 0; i < schedule.semesters.length; i++) {
      const sem = schedule.semesters[i];
      if (sem.type === 'academic' && sem.courses) {
        const courseIndex = sem.courses.findIndex(
          c => c.code.toUpperCase().replace(/\s+/g, ' ').trim() === normalizedCode
        );
        if (courseIndex !== -1) {
          foundCourse = { ...sem.courses[courseIndex] };
          sourceSemesterIndex = i;
          break;
        }
      }
    }

    if (!foundCourse || sourceSemesterIndex === -1) {
      return Response.json(
        { success: false, message: `Course "${courseCode}" not found in schedule` },
        { status: 404 }
      );
    }

    // Find target semester (case-insensitive)
    const targetSemesterIndex = schedule.semesters.findIndex(
      sem => sem.term.toLowerCase() === toSemester.toLowerCase()
    );

    if (targetSemesterIndex === -1) {
      const availableTerms = schedule.semesters.map(s => s.term).join(', ');
      return Response.json(
        { 
          success: false, 
          message: `Target semester "${toSemester}" not found. Available: ${availableTerms}` 
        },
        { status: 404 }
      );
    }

    const targetSemester = schedule.semesters[targetSemesterIndex];
    if (targetSemester.type === 'coop') {
      return Response.json(
        { success: false, message: `Cannot move course to co-op semester "${toSemester}"` },
        { status: 400 }
      );
    }

    // If same semester, nothing to do
    if (sourceSemesterIndex === targetSemesterIndex) {
      return Response.json({
        success: true,
        message: `Course "${courseCode}" is already in ${toSemester}`,
        schedule,
      });
    }

    // Create updated schedule
    const updatedSemesters = [...schedule.semesters];
    
    // Remove from source
    const sourceSem = updatedSemesters[sourceSemesterIndex];
    if (sourceSem.type === 'academic' && sourceSem.courses) {
      updatedSemesters[sourceSemesterIndex] = {
        ...sourceSem,
        courses: sourceSem.courses.filter(
          c => c.code.toUpperCase().replace(/\s+/g, ' ').trim() !== normalizedCode
        ),
      };
    }

    // Add to target
    const targetSem = updatedSemesters[targetSemesterIndex];
    if (targetSem.type === 'academic') {
      updatedSemesters[targetSemesterIndex] = {
        ...targetSem,
        courses: [...(targetSem.courses || []), foundCourse],
      };
    }

    let updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
    };

    // Recalculate credits
    updatedSchedule = recalculateSemesterCredits(updatedSchedule);

    // Update in store
    await updateSchedule(scheduleId, updatedSchedule, 'move_course');

    const sourceTerm = schedule.semesters[sourceSemesterIndex].term;

    return Response.json({
      success: true,
      message: `Moved "${courseCode}" from ${sourceTerm} to ${toSemester}`,
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('move-course error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

