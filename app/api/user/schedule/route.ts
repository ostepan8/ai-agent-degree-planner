import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')

    console.log('[GET /api/user/schedule] Received request for email:', email)

    if (!email) {
      console.log('[GET /api/user/schedule] No email provided, returning error')
      return NextResponse.json(
        { exists: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if Supabase credentials are configured
    // Use service role key for server-side operations to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    const usingServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log('[GET /api/user/schedule] Using service role key:', usingServiceKey)
    console.log('[GET /api/user/schedule] Supabase URL:', supabaseUrl?.substring(0, 40))

    if (!supabaseUrl || !supabaseKey) {
      console.log('[GET /api/user/schedule] Supabase not configured, returning no schedule')
      return NextResponse.json({ 
        exists: false, 
        debug: { reason: 'supabase_not_configured' } 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      }
    })
    const normalizedEmail = email.toLowerCase().trim()
    console.log('[GET /api/user/schedule] Querying for normalized email:', normalizedEmail)

    // Query for the user's schedule - order by id desc to get most recent if duplicates exist
    const { data, error } = await supabase
      .from('user_logs')
      .select('schedule, school, major, id')
      .eq('email', normalizedEmail)
      .order('id', { ascending: false })
      .limit(1)
      .single()

    console.log('[GET /api/user/schedule] Query result - data:',
      data ? 'found' : 'null', ', id:', data?.id, ', error:', error?.message || 'none')

    if (error) {
      console.log('[GET /api/user/schedule] Query ERROR:', error.message, error.code)
      return NextResponse.json({ 
        exists: false, 
        debug: { error: error.message, code: error.code, email: normalizedEmail } 
      })
    }

    if (!data) {
      console.log('[GET /api/user/schedule] No record found for email:', normalizedEmail)
      return NextResponse.json({ 
        exists: false, 
        debug: { reason: 'no_data', email: normalizedEmail } 
      })
    }

    // Check if user has a schedule stored
    if (!data.schedule) {
      console.log('[GET /api/user/schedule] Record exists but no schedule stored for:', normalizedEmail)
      return NextResponse.json({ 
        exists: false,
        hasAccount: true,
        school: data.school,
        major: data.major,
      })
    }

    // Parse the schedule if it's a string
    let parsedSchedule = data.schedule
    const rawScheduleStr = typeof data.schedule === 'string' ? data.schedule : JSON.stringify(data.schedule)
    console.log('[GET /api/user/schedule] Raw schedule length:', rawScheduleStr.length,
      ', first 200 chars:', rawScheduleStr.substring(0, 200))
    
    if (typeof data.schedule === 'string') {
      try {
        parsedSchedule = JSON.parse(data.schedule)
      } catch (e) {
        console.error('[GET /api/user/schedule] Failed to parse schedule:', e)
      }
    }
    
    // Log detailed info about what we're returning
    const courseCount = (parsedSchedule.semesters || []).reduce(
      (sum: number, sem: { type: string; courses?: unknown[] }) => {
        if (sem.type === 'academic' && sem.courses) {
          return sum + sem.courses.length
        }
        return sum
      }, 0)
    
    // Check Spring 2026 specifically
    const spring2026 = (parsedSchedule.semesters || []).find(
      (s: { term: string }) => s.term === 'Spring 2026'
    )
    const spring2026Courses = spring2026?.courses?.length || 0
    
    console.log('[GET /api/user/schedule] Returning schedule at', new Date().toISOString())
    console.log('[GET /api/user/schedule] Total courses:', courseCount, 
      ', Spring 2026 courses:', spring2026Courses,
      ', totalCredits:', parsedSchedule.totalCredits)
    
    // Return with no-cache headers
    return NextResponse.json({
      exists: true,
      schedule: parsedSchedule,
      school: data.school,
      major: data.major,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      }
    })
  } catch (error) {
    console.error('[GET /api/user/schedule] Error:', error)
    return NextResponse.json(
      { exists: false, error: 'Failed to check schedule' },
      { status: 500 }
    )
  }
}
