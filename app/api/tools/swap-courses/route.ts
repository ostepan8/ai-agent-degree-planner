import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule, recalculateSemesterCredits } from '@/lib/scheduleStore';
import type { SchedulePlan, ScheduleCourse } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subconscious sends: { tool_name, parameters: {...}, request_id }
interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: { scheduleId?: string; courseCode1?: string; courseCode2?: string };
  request_id?: string;
  // Also support direct format for testing
  scheduleId?: string;
  courseCode1?: string;
  courseCode2?: string;
}

export async function POST(request: NextRequest) {
  console.log('\n========================================');
  console.log('=== TOOL: swap-courses called ===');
  console.log('========================================');
  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // Extract from either Subconscious format or direct format
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const courseCode1 = body.parameters?.courseCode1 || body.courseCode1;
    const courseCode2 = body.parameters?.courseCode2 || body.courseCode2;

    console.log('Extracted params:', { scheduleId, courseCode1, courseCode2 });

    if (!scheduleId || !courseCode1 || !courseCode2) {
      console.log('ERROR: Missing required params');
      return Response.json(
        { success: false, message: 'scheduleId, courseCode1, and courseCode2 are required' },
        { status: 400 }
      );
    }

    const schedule = getSchedule(scheduleId);
    console.log('Schedule found:', !!schedule);

    if (!schedule) {
      return Response.json(
        { success: false, message: 'Schedule not found or expired' },
        { status: 404 }
      );
    }

    // Normalize course codes
    const normalizedCode1 = courseCode1.toUpperCase().replace(/\s+/g, ' ').trim();
    const normalizedCode2 = courseCode2.toUpperCase().replace(/\s+/g, ' ').trim();

    // Find both courses
    let course1: ScheduleCourse | null = null;
    let course1SemIndex = -1;
    let course1Index = -1;

    let course2: ScheduleCourse | null = null;
    let course2SemIndex = -1;
    let course2Index = -1;

    for (let i = 0; i < schedule.semesters.length; i++) {
      const sem = schedule.semesters[i];
      if (sem.type === 'academic' && sem.courses) {
        for (let j = 0; j < sem.courses.length; j++) {
          const code = sem.courses[j].code.toUpperCase().replace(/\s+/g, ' ').trim();
          if (code === normalizedCode1) {
            course1 = { ...sem.courses[j] };
            course1SemIndex = i;
            course1Index = j;
          }
          if (code === normalizedCode2) {
            course2 = { ...sem.courses[j] };
            course2SemIndex = i;
            course2Index = j;
          }
        }
      }
    }

    if (!course1) {
      return Response.json(
        { success: false, message: `Course "${courseCode1}" not found in schedule` },
        { status: 404 }
      );
    }

    if (!course2) {
      return Response.json(
        { success: false, message: `Course "${courseCode2}" not found in schedule` },
        { status: 404 }
      );
    }

    // If same semester, just swap positions
    if (course1SemIndex === course2SemIndex) {
      const sem = schedule.semesters[course1SemIndex];
      if (sem.type === 'academic' && sem.courses) {
        const newCourses = [...sem.courses];
        newCourses[course1Index] = course2;
        newCourses[course2Index] = course1;

        const updatedSemesters = [...schedule.semesters];
        updatedSemesters[course1SemIndex] = { ...sem, courses: newCourses };

        const updatedSchedule: SchedulePlan = {
          ...schedule,
          semesters: updatedSemesters,
        };

        updateSchedule(scheduleId, updatedSchedule, 'swap_courses');

        return Response.json({
          success: true,
          message: `Swapped "${courseCode1}" and "${courseCode2}" within ${sem.term}`,
          schedule: updatedSchedule,
        });
      }
    }

    // Swap between different semesters
    const updatedSemesters = [...schedule.semesters];

    // Replace course1 with course2 in semester1
    const sem1 = updatedSemesters[course1SemIndex];
    if (sem1.type === 'academic' && sem1.courses) {
      const newCourses = [...sem1.courses];
      newCourses[course1Index] = course2;
      updatedSemesters[course1SemIndex] = { ...sem1, courses: newCourses };
    }

    // Replace course2 with course1 in semester2
    const sem2 = updatedSemesters[course2SemIndex];
    if (sem2.type === 'academic' && sem2.courses) {
      const newCourses = [...sem2.courses];
      newCourses[course2Index] = course1;
      updatedSemesters[course2SemIndex] = { ...sem2, courses: newCourses };
    }

    let updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
    };

    // Recalculate credits
    updatedSchedule = recalculateSemesterCredits(updatedSchedule);

    updateSchedule(scheduleId, updatedSchedule, 'swap_courses');

    const sem1Term = schedule.semesters[course1SemIndex].term;
    const sem2Term = schedule.semesters[course2SemIndex].term;

    console.log(`✅ SUCCESS: Swapped "${courseCode1}" (${sem1Term}) with "${courseCode2}" (${sem2Term})`);

    return Response.json({
      success: true,
      message: `Swapped "${courseCode1}" (${sem1Term}) with "${courseCode2}" (${sem2Term})`,
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('❌ swap-courses error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

