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

    // Calculate summary
    let totalCredits = 0;
    let academicSemesters = 0;
    let coopSemesters = 0;
    let lightestSemester = { term: '', credits: Infinity };
    let heaviestSemester = { term: '', credits: 0 };

    for (const semester of schedule.semesters) {
      if (semester.type === 'coop') {
        coopSemesters++;
      } else {
        academicSemesters++;
        const credits = semester.totalCredits || 0;
        totalCredits += credits;

        if (credits < lightestSemester.credits) {
          lightestSemester = { term: semester.term, credits };
        }
        if (credits > heaviestSemester.credits) {
          heaviestSemester = { term: semester.term, credits };
        }
      }
    }

    const avgCreditsPerSemester = academicSemesters > 0 
      ? Math.round(totalCredits / academicSemesters * 10) / 10 
      : 0;

    // Calculate credit status
    const targetCredits = schedule.totalCredits || 130;
    const creditsRemaining = targetCredits - totalCredits;
    const isOverTarget = totalCredits > targetCredits;
    const isAtTarget = totalCredits >= targetCredits;
    const canAddCourses = creditsRemaining > 0;
    
    const summary = {
      currentCredits: totalCredits,
      targetCredits,
      creditsRemaining: Math.max(0, creditsRemaining),
      creditsOver: isOverTarget ? totalCredits - targetCredits : 0,
      canAddCourses,
      status: isOverTarget 
        ? `⚠️ OVER-CREDITED by ${totalCredits - targetCredits}. REMOVE courses, do NOT add more.`
        : isAtTarget 
          ? `✅ AT TARGET (${totalCredits}/${targetCredits}). Do NOT add more courses.`
          : `Need ${creditsRemaining} more credits to reach target of ${targetCredits}.`,
      academicSemesters,
      coopSemesters,
      avgCreditsPerSemester,
      lightestSemester: lightestSemester.term 
        ? `${lightestSemester.term} (${lightestSemester.credits} credits)` 
        : 'N/A',
      heaviestSemester: heaviestSemester.term 
        ? `${heaviestSemester.term} (${heaviestSemester.credits} credits)` 
        : 'N/A',
    };

    // Very explicit message for the AI
    const actionMessage = canAddCourses 
      ? `Schedule has ${totalCredits}/${targetCredits} credits. You may add up to ${creditsRemaining} more credits.`
      : `⚠️ STOP: Schedule has ${totalCredits}/${targetCredits} credits. DO NOT add any courses.${isOverTarget ? ` Remove ${totalCredits - targetCredits} credits.` : ''}`;

    return Response.json({
      success: true,
      message: actionMessage,
      data: summary,
    });
  } catch (error) {
    console.error('get-credit-summary error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

