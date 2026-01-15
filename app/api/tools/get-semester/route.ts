import { NextRequest } from 'next/server';
import { getSchedule } from '@/lib/scheduleStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Subconscious sends: { tool_name, parameters: {...}, request_id }
interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: { scheduleId?: string; term?: string };
  request_id?: string;
  // Also support direct format for testing
  scheduleId?: string;
  term?: string;
}

export async function POST(request: NextRequest) {
  console.log('\n=== TOOL: get-semester called ===');
  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log('Body:', JSON.stringify(body));
    
    // Extract from either Subconscious format or direct format
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const term = body.parameters?.term || body.term;

    if (!scheduleId || !term) {
      return Response.json(
        { success: false, message: 'scheduleId and term are required' },
        { status: 400 }
      );
    }

    const schedule = getSchedule(scheduleId);
    console.log('Schedule found:', !!schedule, 'ID:', scheduleId);

    if (!schedule) {
      console.log('ERROR: Schedule not found for ID:', scheduleId);
      return Response.json(
        { success: false, message: 'Schedule not found or expired' },
        { status: 404 }
      );
    }

    // Find the semester by term (case-insensitive match)
    const semester = schedule.semesters.find(
      sem => sem.term.toLowerCase() === term.toLowerCase()
    );

    if (!semester) {
      const availableTerms = schedule.semesters.map(s => s.term).join(', ');
      return Response.json(
        { 
          success: false, 
          message: `Semester "${term}" not found. Available terms: ${availableTerms}` 
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: `Retrieved details for ${term}`,
      data: semester,
    });
  } catch (error) {
    console.error('get-semester error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

