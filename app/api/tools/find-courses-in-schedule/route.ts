import { NextRequest } from 'next/server';
import { getSchedule } from '@/lib/scheduleStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
    searchTerm?: string;
  };
  request_id?: string;
  scheduleId?: string;
  searchTerm?: string;
}

interface FoundCourse {
  code: string;
  name: string;
  credits: number;
  term: string;
}

export async function POST(request: NextRequest) {
  console.log('\n========================================');
  console.log('=== TOOL: find-courses-in-schedule called ===');
  console.log('========================================');

  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log('Request body:', JSON.stringify(body, null, 2));

    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const searchTerm = body.parameters?.searchTerm || body.searchTerm;

    if (!scheduleId) {
      return Response.json(
        { success: false, message: 'scheduleId is required' },
        { status: 400 }
      );
    }

    if (!searchTerm) {
      return Response.json(
        { success: false, message: 'searchTerm is required' },
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

    // Search for courses matching the term (case-insensitive)
    const searchLower = searchTerm.toLowerCase();
    const foundCourses: FoundCourse[] = [];

    for (const semester of schedule.semesters) {
      if (semester.type === 'academic' && semester.courses) {
        for (const course of semester.courses) {
          const codeMatch = course.code.toLowerCase().includes(searchLower);
          const nameMatch = course.name.toLowerCase().includes(searchLower);
          
          if (codeMatch || nameMatch) {
            foundCourses.push({
              code: course.code,
              name: course.name,
              credits: course.credits,
              term: semester.term,
            });
          }
        }
      }
    }

    // Format results as string for AI
    const resultString = foundCourses
      .map(c => `${c.code} (${c.name}) in ${c.term}`)
      .join('; ');

    console.log(`Found ${foundCourses.length} courses matching "${searchTerm}"`);

    return Response.json({
      success: true,
      message: foundCourses.length > 0
        ? `Found ${foundCourses.length} course(s) matching "${searchTerm}": ${resultString}`
        : `No courses found matching "${searchTerm}"`,
      data: {
        searchTerm,
        matchCount: foundCourses.length,
        courses: foundCourses,
      },
    });
  } catch (error) {
    console.error('find-courses-in-schedule error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

