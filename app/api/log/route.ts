import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { SchedulePlan } from '@/lib/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface LogRequestBody {
  email: string
  school?: {
    id: string
    name: string
  }
  major?: string
  preferences?: {
    startingSemester: string
    creditsPerSemester: string
    coopPlan: string
    additionalNotes?: string
  }
  isFreshman?: boolean
  completedCoursesCount?: number
  schedule?: SchedulePlan
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LogRequestBody
    const { email, school, major, preferences, isFreshman, completedCoursesCount, schedule } = body

    // Email is required for persistent storage
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if Supabase credentials are configured
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      // Log to console if Supabase is not configured
      console.log('\n=== USER LOG (Supabase not configured) ===')
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        email: normalizedEmail,
        school: school?.name,
        major,
        starting_semester: preferences?.startingSemester,
        credits_per_semester: preferences?.creditsPerSemester,
        coop_plan: preferences?.coopPlan,
        is_freshman: isFreshman,
        completed_courses_count: completedCoursesCount || 0,
        notes: preferences?.additionalNotes || '',
        has_schedule: !!schedule,
      }, null, 2))
      console.log('==========================================\n')
      
      return NextResponse.json({ success: true, logged: 'console' })
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Build the upsert data - only include fields that are provided
    const upsertData: Record<string, unknown> = {
      email: normalizedEmail,
    }

    // Add optional fields if provided
    if (school?.name !== undefined) upsertData.school = school.name
    if (major !== undefined) upsertData.major = major
    if (preferences?.startingSemester !== undefined) upsertData.starting_semester = preferences.startingSemester
    if (preferences?.creditsPerSemester !== undefined) upsertData.credits_per_semester = preferences.creditsPerSemester
    if (preferences?.coopPlan !== undefined) upsertData.coop_plan = preferences.coopPlan
    if (isFreshman !== undefined) upsertData.is_freshman = isFreshman
    if (completedCoursesCount !== undefined) upsertData.completed_courses_count = completedCoursesCount
    if (preferences?.additionalNotes !== undefined) upsertData.notes = preferences.additionalNotes
    if (schedule !== undefined) upsertData.schedule = schedule

    // Upsert the row - insert if new email, update if exists
    const { error } = await supabase
      .from('user_logs')
      .upsert(upsertData, { 
        onConflict: 'email',
        ignoreDuplicates: false 
      })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 200 })
    }

    const action = schedule ? 'Saved schedule for' : 'Logged'
    console.log(`${action} user to Supabase: ${normalizedEmail} - ${school?.name || 'N/A'} - ${major || 'N/A'}`)

    return NextResponse.json({ success: true, logged: 'supabase' })
  } catch (error) {
    console.error('Failed to log user data:', error)
    return NextResponse.json({ success: false, error: 'Logging failed' }, { status: 500 })
  }
}
