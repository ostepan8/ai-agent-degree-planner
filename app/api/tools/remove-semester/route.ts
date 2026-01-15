import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule } from '@/lib/scheduleStore';
import type { SchedulePlan } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
    term?: string;
    force?: boolean;
  };
  request_id?: string;
  scheduleId?: string;
  term?: string;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  console.log('\n========================================');
  console.log('=== TOOL: remove-semester called ===');
  console.log('========================================');

  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log('Request body:', JSON.stringify(body, null, 2));

    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const term = body.parameters?.term || body.term;
    const force = body.parameters?.force || body.force || false;

    if (!scheduleId || !term) {
      return Response.json(
        { success: false, message: 'scheduleId and term are required' },
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

    // Find the semester
    const semesterIndex = schedule.semesters.findIndex(
      (sem) => sem.term.toLowerCase() === term.toLowerCase()
    );

    if (semesterIndex === -1) {
      return Response.json(
        { success: false, message: `Semester "${term}" not found` },
        { status: 404 }
      );
    }

    const semester = schedule.semesters[semesterIndex];

    // Check if semester has courses (only for academic semesters)
    if (semester.type === 'academic' && semester.courses && semester.courses.length > 0) {
      if (!force) {
        return Response.json(
          { 
            success: false, 
            message: `Cannot remove "${term}" - it has ${semester.courses.length} course(s). Remove courses first or use force=true.`,
            data: { courseCount: semester.courses.length }
          },
          { status: 400 }
        );
      }
    }

    // Remove the semester
    const updatedSemesters = schedule.semesters.filter(
      (_, index) => index !== semesterIndex
    );

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

    updateSchedule(scheduleId, updatedSchedule, 'remove_semester');

    console.log(`✅ SUCCESS: Removed semester "${term}"`);

    return Response.json({
      success: true,
      message: `Removed semester "${term}" from schedule`,
      data: {
        removedTerm: term,
        removedType: semester.type,
        remainingSemesters: updatedSemesters.length,
      },
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('remove-semester error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

