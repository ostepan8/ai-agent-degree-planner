import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface LogRequestBody {
  email?: string
  school: {
    id: string
    name: string
  }
  major: string
  preferences: {
    startingSemester: string
    creditsPerSemester: string
    coopPlan: string
    additionalNotes?: string
  }
  isFreshman: boolean
  completedCoursesCount?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LogRequestBody
    const { email, school, major, preferences, isFreshman, completedCoursesCount } = body

    // Check if Supabase credentials are configured
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      // Log to console if Supabase is not configured
      console.log('\n=== USER LOG (Supabase not configured) ===')
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        email: email || 'not provided',
        school: school?.name,
        major,
        starting_semester: preferences?.startingSemester,
        credits_per_semester: preferences?.creditsPerSemester,
        coop_plan: preferences?.coopPlan,
        is_freshman: isFreshman,
        completed_courses_count: completedCoursesCount || 0,
        notes: preferences?.additionalNotes || '',
      }, null, 2))
      console.log('==========================================\n')
      
      return NextResponse.json({ success: true, logged: 'console' })
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Insert the row
    const { error } = await supabase.from('user_logs').insert({
      email: email || null,
      school: school?.name || null,
      major: major || null,
      starting_semester: preferences?.startingSemester || null,
      credits_per_semester: preferences?.creditsPerSemester || null,
      coop_plan: preferences?.coopPlan || null,
      is_freshman: isFreshman,
      completed_courses_count: completedCoursesCount || 0,
      notes: preferences?.additionalNotes || null,
    })

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 200 })
    }

    console.log(`Logged user to Supabase: ${email || 'anonymous'} - ${school?.name} - ${major}`)

    return NextResponse.json({ success: true, logged: 'supabase' })
  } catch (error) {
    // Log error but don't fail the request (fire-and-forget)
    console.error('Failed to log user data:', error)
    return NextResponse.json({ success: false, error: 'Logging failed' }, { status: 200 })
  }
}
