import { NextRequest } from 'next/server';
import { getSchedule } from '@/lib/scheduleStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: { 
    scheduleId?: string;
    minCredits?: number;
  };
  request_id?: string;
  // Direct format for testing
  scheduleId?: string;
  minCredits?: number;
}

interface LightSemester {
  term: string;
  currentCredits: number;
  courseCount: number;
  creditsNeeded: number;
  courses: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    
    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const minCredits = body.parameters?.minCredits || body.minCredits || 16; // Default to 16 credits

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

    // Find academic semesters with less than minCredits
    const lightSemesters: LightSemester[] = [];
    
    for (const semester of schedule.semesters) {
      // Skip co-op semesters
      if (semester.type === 'coop') {
        continue;
      }
      
      const currentCredits = semester.totalCredits || 0;
      
      if (currentCredits < minCredits) {
        lightSemesters.push({
          term: semester.term,
          currentCredits,
          courseCount: semester.courses?.length || 0,
          creditsNeeded: minCredits - currentCredits,
          courses: semester.courses?.map(c => `${c.code} (${c.credits}cr)`) || [],
        });
      }
    }

    // Sort by credits needed (most needed first)
    lightSemesters.sort((a, b) => b.creditsNeeded - a.creditsNeeded);

    const summary = {
      minCreditsThreshold: minCredits,
      lightSemesterCount: lightSemesters.length,
      totalCreditsNeeded: lightSemesters.reduce((sum, s) => sum + s.creditsNeeded, 0),
      semesters: lightSemesters,
    };

    return Response.json({
      success: true,
      message: lightSemesters.length > 0 
        ? `Found ${lightSemesters.length} semester(s) with fewer than ${minCredits} credits`
        : `All academic semesters have at least ${minCredits} credits`,
      data: summary,
    });
  } catch (error) {
    console.error('find-light-semesters error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

