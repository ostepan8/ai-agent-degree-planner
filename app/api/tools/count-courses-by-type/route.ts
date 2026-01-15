import { NextRequest } from 'next/server';
import { getSchedule } from '@/lib/scheduleStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
  };
  request_id?: string;
  scheduleId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubconsciousToolRequest;

    const scheduleId = body.parameters?.scheduleId || body.scheduleId;

    if (!scheduleId) {
      return Response.json(
        { success: false, message: 'scheduleId is required' },
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

    // Count courses by department prefix
    const counts: Record<string, number> = {};
    let totalCourses = 0;

    for (const semester of schedule.semesters) {
      if (semester.type === 'academic' && semester.courses) {
        for (const course of semester.courses) {
          // Extract department from course code (first part before space)
          const parts = course.code.split(' ');
          const dept = parts[0].toUpperCase();
          
          counts[dept] = (counts[dept] || 0) + 1;
          totalCourses++;
        }
      }
    }

    // Sort by count descending
    const sortedDepts = Object.entries(counts)
      .sort((a, b) => b[1] - a[1]);

    // Format as string for AI-friendly output
    const countString = sortedDepts
      .map(([dept, count]) => `${dept}: ${count}`)
      .join(', ');

    return Response.json({
      success: true,
      message: `${totalCourses} courses: ${countString}`,
      data: {
        totalCourses,
        departmentCount: sortedDepts.length,
        breakdown: countString,
        counts,
      },
    });
  } catch (error) {
    console.error('count-courses-by-type error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

