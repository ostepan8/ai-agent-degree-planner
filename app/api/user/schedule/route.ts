import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { exists: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if Supabase credentials are configured
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.log('Supabase not configured, returning no schedule')
      return NextResponse.json({ exists: false })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Query for the user's schedule
    const { data, error } = await supabase
      .from('user_logs')
      .select('schedule, created_at, school, major')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !data) {
      return NextResponse.json({ exists: false })
    }

    // Check if user has a schedule stored
    if (!data.schedule) {
      return NextResponse.json({ 
        exists: false,
        hasAccount: true,
        school: data.school,
        major: data.major,
      })
    }

    return NextResponse.json({
      exists: true,
      schedule: data.schedule,
      created_at: data.created_at,
      school: data.school,
      major: data.major,
    })
  } catch (error) {
    console.error('Error checking user schedule:', error)
    return NextResponse.json(
      { exists: false, error: 'Failed to check schedule' },
      { status: 500 }
    )
  }
}
