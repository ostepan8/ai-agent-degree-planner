import { NextRequest } from 'next/server';
import { getSchedule, updateSchedule } from '@/lib/scheduleStore';
import type { SchedulePlan, Semester } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubconsciousToolRequest {
  tool_name?: string;
  parameters?: {
    scheduleId?: string;
    term?: string;
    newType?: 'academic' | 'coop';
    coopNumber?: number;
  };
  request_id?: string;
  scheduleId?: string;
  term?: string;
  newType?: 'academic' | 'coop';
  coopNumber?: number;
}

export async function POST(request: NextRequest) {
  console.log('\n========================================');
  console.log('=== TOOL: set-semester-type called ===');
  console.log('========================================');

  try {
    const body = (await request.json()) as SubconsciousToolRequest;
    console.log('Request body:', JSON.stringify(body, null, 2));

    const scheduleId = body.parameters?.scheduleId || body.scheduleId;
    const term = body.parameters?.term || body.term;
    const newType = body.parameters?.newType || body.newType;
    const coopNumber = body.parameters?.coopNumber || body.coopNumber;

    if (!scheduleId || !term || !newType) {
      return Response.json(
        { success: false, message: 'scheduleId, term, and newType are required' },
        { status: 400 }
      );
    }

    if (newType !== 'academic' && newType !== 'coop') {
      return Response.json(
        { success: false, message: 'newType must be "academic" or "coop"' },
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

    const oldSemester = schedule.semesters[semesterIndex];
    const oldType = oldSemester.type;

    if (oldType === newType) {
      return Response.json({
        success: true,
        message: `Semester "${term}" is already of type "${newType}"`,
        data: { term, type: newType },
      });
    }

    // Create the new semester object
    let newSemester: Semester;
    let warningMessage = '';

    if (newType === 'coop') {
      // Converting academic to coop - courses will be lost
      if (oldSemester.type === 'academic' && oldSemester.courses && oldSemester.courses.length > 0) {
        warningMessage = ` Warning: ${oldSemester.courses.length} course(s) were removed.`;
      }
      newSemester = {
        term,
        type: 'coop',
        coopNumber: coopNumber || 1,
      };
    } else {
      // Converting coop to academic - initialize empty
      newSemester = {
        term,
        type: 'academic',
        courses: [],
        totalCredits: 0,
      };
    }

    // Update the semester
    const updatedSemesters = [...schedule.semesters];
    updatedSemesters[semesterIndex] = newSemester;

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

    await updateSchedule(scheduleId, updatedSchedule, 'set_semester_type');

    console.log(`✅ SUCCESS: Changed "${term}" from ${oldType} to ${newType}`);

    return Response.json({
      success: true,
      message: `Changed "${term}" from ${oldType} to ${newType}.${warningMessage}`,
      data: {
        term,
        oldType,
        newType,
        coopNumber: newType === 'coop' ? (coopNumber || 1) : undefined,
      },
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error('set-semester-type error:', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

