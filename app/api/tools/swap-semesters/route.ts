import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule } from '@/lib/scheduleStore';
import type { SchedulePlan, Semester } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
    semester1?: string;
    semester2?: string;
  };
  request_id?: string;
  // Direct format for testing
  scheduleId?: string;
  semester1?: string;
  semester2?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubconsciousToolRequest;

    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const semester1 = body.parameters?.semester1 || body.semester1;
    const semester2 = body.parameters?.semester2 || body.semester2;

    if (!scheduleId || !semester1 || !semester2) {
      return Response.json(
        { success: false, message: 'scheduleId, semester1, and semester2 are required' },
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

    // Find both semesters
    const sem1Index = schedule.semesters.findIndex(
      (sem) => sem.term.toLowerCase() === semester1.toLowerCase()
    );
    const sem2Index = schedule.semesters.findIndex(
      (sem) => sem.term.toLowerCase() === semester2.toLowerCase()
    );

    if (sem1Index === -1) {
      return Response.json(
        { success: false, message: `Semester "${semester1}" not found` },
        { status: 404 }
      );
    }

    if (sem2Index === -1) {
      return Response.json(
        { success: false, message: `Semester "${semester2}" not found` },
        { status: 404 }
      );
    }

    const sem1 = schedule.semesters[sem1Index];
    const sem2 = schedule.semesters[sem2Index];

    // Create swapped semesters - swap types and content but keep the term names
    const newSem1: Semester = sem1.type === 'coop' && sem2.type === 'academic'
      ? {
          term: sem1.term,
          type: 'academic',
          courses: sem2.courses || [],
          totalCredits: sem2.totalCredits || 0,
        }
      : sem1.type === 'academic' && sem2.type === 'coop'
      ? {
          term: sem1.term,
          type: 'coop',
          coopNumber: sem2.coopNumber,
        }
      : sem1.type === 'academic' && sem2.type === 'academic'
      ? {
          term: sem1.term,
          type: 'academic',
          courses: sem2.courses || [],
          totalCredits: sem2.totalCredits || 0,
        }
      : {
          term: sem1.term,
          type: 'coop',
          coopNumber: sem2.type === 'coop' ? sem2.coopNumber : 1,
        };

    const newSem2: Semester = sem2.type === 'coop' && sem1.type === 'academic'
      ? {
          term: sem2.term,
          type: 'academic',
          courses: sem1.courses || [],
          totalCredits: sem1.totalCredits || 0,
        }
      : sem2.type === 'academic' && sem1.type === 'coop'
      ? {
          term: sem2.term,
          type: 'coop',
          coopNumber: sem1.type === 'coop' ? sem1.coopNumber : 1,
        }
      : sem2.type === 'academic' && sem1.type === 'academic'
      ? {
          term: sem2.term,
          type: 'academic',
          courses: sem1.courses || [],
          totalCredits: sem1.totalCredits || 0,
        }
      : {
          term: sem2.term,
          type: 'coop',
          coopNumber: sem1.type === 'coop' ? sem1.coopNumber : 1,
        };

    // Update the schedule
    const updatedSemesters = [...schedule.semesters];
    updatedSemesters[sem1Index] = newSem1;
    updatedSemesters[sem2Index] = newSem2;

    // Recalculate total credits
    const totalCredits = updatedSemesters.reduce((sum, sem) => {
      if (sem.type === 'academic' && sem.totalCredits) {
        return sum + sem.totalCredits;
      }
      return sum;
    }, 0);

    const updatedSchedule: SchedulePlan = {
      ...schedule,
      semesters: updatedSemesters,
      totalCredits,
    };

    await updateSchedule(scheduleId, updatedSchedule, 'swap_semesters');

    const sem1Description = newSem1.type === 'coop' 
      ? `Co-op ${newSem1.coopNumber || ''}` 
      : `Academic (${newSem1.totalCredits} credits, ${newSem1.courses?.length || 0} courses)`;
    const sem2Description = newSem2.type === 'coop'
      ? `Co-op ${newSem2.coopNumber || ''}`
      : `Academic (${newSem2.totalCredits} credits, ${newSem2.courses?.length || 0} courses)`;

    return Response.json({
      success: true,
      message: `Swapped ${semester1} (now ${newSem1.type}) with ${semester2} (now ${newSem2.type})`,
      details: {
        [semester1]: sem1Description,
        [semester2]: sem2Description,
      },
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('swap-semesters error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

