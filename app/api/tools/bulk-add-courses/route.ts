import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule, recalculateSemesterCredits } from '@/lib/scheduleStore';
import type { SchedulePlan, ScheduleCourse } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CourseToAdd {
  term: string;
  courseCode: string;
  courseName: string;
  credits: number;
  options?: string;
}

// Subconscious sends: { tool_name, parameters: {...}, request_id }
interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
    courses?: CourseToAdd[];
    coursesJson?: string; // JSON string format for simpler schema
  };
  request_id?: string;
  // Also support direct format for testing
  scheduleId?: string;
  courses?: CourseToAdd[];
  coursesJson?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubconsciousToolRequest;

    // Extract from either Subconscious format or direct format
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    
    // Support both array format and JSON string format
    let courses: CourseToAdd[] | undefined = body.parameters?.courses || body.courses;
    const coursesJson = body.parameters?.coursesJson || body.coursesJson;
    
    // Parse JSON string if provided
    if (!courses && coursesJson) {
      try {
        courses = JSON.parse(coursesJson) as CourseToAdd[];
      } catch (e) {
        return Response.json(
          { success: false, message: 'Invalid JSON in coursesJson: ' + (e instanceof Error ? e.message : 'Parse error') },
          { status: 400 }
        );
      }
    }

    if (!scheduleId || !courses || !Array.isArray(courses) || courses.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'scheduleId and courses array (or coursesJson) are required',
        },
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

    // Validate all courses first
    const errors: string[] = [];
    const validCourses: CourseToAdd[] = [];

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];

      if (!course.term || !course.courseCode || !course.courseName || course.credits === undefined) {
        errors.push(`Course ${i + 1}: Missing required fields (term, courseCode, courseName, credits)`);
        continue;
      }

      if (typeof course.credits !== 'number' || course.credits < 1 || course.credits > 6) {
        errors.push(`Course ${i + 1} (${course.courseCode}): credits must be between 1 and 6`);
        continue;
      }

      // Check if semester exists
      const semesterExists = schedule.semesters.some(
        (sem) => sem.term.toLowerCase() === course.term.toLowerCase()
      );
      if (!semesterExists) {
        errors.push(`Course ${i + 1} (${course.courseCode}): Semester "${course.term}" not found`);
        continue;
      }

      // Check if target semester is a co-op
      const targetSem = schedule.semesters.find(
        (sem) => sem.term.toLowerCase() === course.term.toLowerCase()
      );
      if (targetSem?.type === 'coop') {
        errors.push(`Course ${i + 1} (${course.courseCode}): Cannot add to co-op semester "${course.term}"`);
        continue;
      }

      // Check if course already exists in schedule
      const normalizedCode = course.courseCode.toUpperCase().replace(/\s+/g, ' ').trim();
      let alreadyExists = false;
      for (const sem of schedule.semesters) {
        if (sem.type === 'academic' && sem.courses) {
          const exists = sem.courses.some(
            (c) => c.code.toUpperCase().replace(/\s+/g, ' ').trim() === normalizedCode
          );
          if (exists) {
            errors.push(`Course ${i + 1} (${course.courseCode}): Already exists in ${sem.term}`);
            alreadyExists = true;
            break;
          }
        }
      }

      if (!alreadyExists) {
        validCourses.push(course);
      }
    }

    if (validCourses.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'No valid courses to add',
          errors,
        },
        { status: 400 }
      );
    }

    // Add all valid courses
    const updatedSemesters = [...schedule.semesters];
    const addedCourses: string[] = [];

    for (const course of validCourses) {
      const semesterIndex = updatedSemesters.findIndex(
        (sem) => sem.term.toLowerCase() === course.term.toLowerCase()
      );

      if (semesterIndex === -1) continue;

      const targetSem = updatedSemesters[semesterIndex];
      if (targetSem.type !== 'academic') continue;

      const newCourse: ScheduleCourse = {
        code: course.courseCode,
        name: course.courseName,
        credits: Math.round(course.credits),
      };

      if (course.options) {
        (newCourse as ScheduleCourse & { options?: string }).options = course.options;
      }

      updatedSemesters[semesterIndex] = {
        ...targetSem,
        courses: [...(targetSem.courses || []), newCourse],
      };

      addedCourses.push(`${course.courseCode} to ${course.term}`);
    }

    let updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
    };

    // Recalculate credits
    updatedSchedule = recalculateSemesterCredits(updatedSchedule);

    await updateSchedule(scheduleId, updatedSchedule, 'bulk_add_courses');

    return Response.json({
      success: true,
      message: `Added ${addedCourses.length} course(s): ${addedCourses.join(', ')}`,
      addedCount: addedCourses.length,
      added: addedCourses,
      errors: errors.length > 0 ? errors : undefined,
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('bulk-add-courses error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

