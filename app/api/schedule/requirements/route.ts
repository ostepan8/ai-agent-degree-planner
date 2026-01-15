import { NextRequest, NextResponse } from 'next/server'
import { createAgentRun, parseAnswer } from '@/lib/subconscious'
import { type School } from '@/lib/schemas'
import { buildRequirementsPrompt } from '@/lib/verification_prompt.js'

export async function POST(request: NextRequest) {
  try {
    const { school, major, concentration, minor } = await request.json() as { 
      school: School; 
      major: string;
      concentration?: string;
      minor?: string;
    }
    
    if (!school || !major) {
      return NextResponse.json(
        { error: 'School and major are required' },
        { status: 400 }
      )
    }
    
    const instructions = buildRequirementsPrompt({ school, major, concentration, minor })

    const result = await createAgentRun(
      instructions,
      { awaitCompletion: true }
    )
    
    if (!result.result?.answer) {
      return NextResponse.json(
        { error: 'Failed to extract requirements' },
        { status: 500 }
      )
    }
    
    // Parse the JSON string response (without answerFormat, answer is a string)
    let requirements
    try {
      requirements = parseAnswer(result.result.answer)
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse requirements response' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ requirements })
  } catch (error) {
    console.error('Requirements extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract degree requirements' },
      { status: 500 }
    )
  }
}

