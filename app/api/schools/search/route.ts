import { NextRequest, NextResponse } from 'next/server'
import { searchPopularSchools, popularSchools } from '@/constants/schools'
import { createAgentRun, parseAnswer } from '@/lib/subconscious'
import { type School } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }
    
    // First, check popular schools for quick matches
    const popularMatches = searchPopularSchools(query)
    
    // If we have matches from popular schools, return them
    if (popularMatches.length > 0) {
      return NextResponse.json({ schools: popularMatches })
    }
    
    // If query is empty or very short, return all popular schools
    if (query.trim().length < 2) {
      return NextResponse.json({ schools: popularSchools })
    }
    
    // Otherwise, use the AI agent to search for the school
    const instructions = `
Search for universities matching the query: "${query}"

For each matching university, find:
1. The full official name of the university
2. The URL to their official course catalog or academic bulletin
3. The city and state/country location

Return up to 5 matching universities. Focus on accredited universities with publicly accessible course catalogs.
If you cannot find a catalog URL, do not include that school.

Return ONLY a JSON object with this structure (no markdown):
{
  "schools": [
    {"name": "University Name", "catalogUrl": "https://catalog.example.edu", "location": "City, State"}
  ]
}
`
    
    const result = await createAgentRun(
      instructions,
      { awaitCompletion: true }
    )
    
    // Parse the result (answer is a JSON string) and add IDs
    let parsedAnswer: { schools?: Array<Omit<School, 'id'>> } = { schools: [] }
    try {
      if (result.result?.answer) {
        parsedAnswer = parseAnswer<{ schools?: Array<Omit<School, 'id'>> }>(result.result.answer)
      }
    } catch {
      console.error('Failed to parse agent response')
    }
    
    const schools: School[] = (parsedAnswer.schools || []).map(
      (school: Omit<School, 'id'>, index: number) => ({
        ...school,
        id: `search-${index}-${school.name.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`,
      })
    )
    
    return NextResponse.json({ schools })
  } catch (error) {
    console.error('School search error:', error)
    return NextResponse.json(
      { error: 'Failed to search schools' },
      { status: 500 }
    )
  }
}

// GET returns popular schools
export async function GET() {
  return NextResponse.json({ schools: popularSchools })
}

