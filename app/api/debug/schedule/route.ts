import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

// Debug endpoint to check what's actually in the database
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ 
      error: 'Supabase not configured',
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    })
  }

  // Create client with explicit no-cache
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options) => fetch(url, { 
        ...options, 
        cache: 'no-store',
        headers: {
          ...options?.headers,
          'Cache-Control': 'no-cache',
        }
      })
    }
  })

  const normalizedEmail = email.toLowerCase().trim()

  // Get ALL rows for this email to check for duplicates
  const { data: allRows, error: allError } = await supabase
    .from('user_logs')
    .select('id, email, schedule')
    .eq('email', normalizedEmail)
    .order('id', { ascending: false })

  if (allError) {
    return NextResponse.json({ 
      error: allError.message,
      code: allError.code,
    })
  }

  // Parse schedules and count courses
  const rowSummaries = (allRows || []).map(row => {
    let courseCount = 0
    let totalCredits = 0
    let scheduleLength = 0

    if (row.schedule) {
      scheduleLength = typeof row.schedule === 'string' ? row.schedule.length : JSON.stringify(row.schedule).length
      try {
        const parsed = typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule
        totalCredits = parsed.totalCredits || 0
        courseCount = (parsed.semesters || []).reduce((sum: number, sem: { courses?: unknown[] }) => 
          sum + (sem.courses?.length || 0), 0)
      } catch {
        // ignore parse errors
      }
    }

    return {
      id: row.id,
      scheduleLength,
      courseCount,
      totalCredits,
    }
  })

  return NextResponse.json({
    email: normalizedEmail,
    timestamp: new Date().toISOString(),
    usingServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    rowCount: allRows?.length || 0,
    rows: rowSummaries,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    }
  })
}
