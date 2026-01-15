'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import styles from './demo.module.css'
import Navbar from '../components/Navbar'
import { getNextAvailableSemester } from '@/lib/utils/semester'
import {
    SchoolSelectStep,
    MajorSelectStep,
    TranscriptStep,
    ConfirmCoursesStep,
    PreferencesStep,
    GeneratingStep,
    ScheduleStep,
    ExistingScheduleModal,
    type MajorData,
    type TranscriptData,
    type School,
    type CompletedCourse,
    type Preferences,
    type ExtendedSchedulePlan,
    type AgentThought,
    type StudyAbroadState,
} from './components'

type Step = 'school-select' | 'major-select' | 'transcript' | 'confirm-courses' |
    'preferences' | 'generating' | 'schedule'
type GenerationPhase = 'requirements' | 'searching' | 'extracting' | 'building' | 'validating' | 'complete'

export default function DemoPage() {
    // Core navigation state
    const [currentStep, setCurrentStep] = useState<Step>('school-select')
    
    // Form data state (persists across steps)
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
    const [majorData, setMajorData] = useState<MajorData | null>(null)
    const [isFreshman, setIsFreshman] = useState(false)
    const [extractedCourses, setExtractedCourses] = useState<CompletedCourse[]>([])
    const [preferences, setPreferences] = useState<Preferences>(() => ({
        email: '',
        startingSemester: getNextAvailableSemester(),
        creditsPerSemester: 'standard',
        coopPlan: 'three',
        additionalNotes: '',
    }))
    
    // Generation state
    const [generatedSchedule, setGeneratedSchedule] = useState<ExtendedSchedulePlan | null>(null)
    const [thoughts, setThoughts] = useState<AgentThought[]>([])
    const [generationError, setGenerationError] = useState<string | null>(null)
    const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('requirements')
    
    // Existing schedule modal state
    const [showExistingModal, setShowExistingModal] = useState(false)
    const [existingScheduleData, setExistingScheduleData] = useState<{
        schedule: ExtendedSchedulePlan
        school?: string
        major?: string
        createdAt?: string
    } | null>(null)
    const [pendingPreferences, setPendingPreferences] = useState<Preferences | null>(null)
    
    // Two-stage progress tracking
    const [currentStage, setCurrentStage] = useState<1 | 2>(1)
    const [stageStartTime, setStageStartTime] = useState<number | null>(null)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [stage1CompletedTime, setStage1CompletedTime] = useState<number | null>(null)
    const [estimatedMinutes, setEstimatedMinutes] = useState<number>(1.5)
    
    // Refs
    const thoughtIdRef = useRef<number>(0)

    // Timer for elapsed time during generation
    useEffect(() => {
        if (currentStep !== 'generating' || !stageStartTime) {
            return
        }

        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - stageStartTime) / 1000))
        }, 1000)

        return () => clearInterval(interval)
    }, [currentStep, stageStartTime])

    // Memoized default preferences
    const defaultPreferences = useMemo((): Preferences => ({
        email: '',
        startingSemester: getNextAvailableSemester(),
        creditsPerSemester: 'standard',
        coopPlan: 'three',
        additionalNotes: '',
    }), [])

    // Helper to calculate the next semester based on transcript courses
    const calculateNextSemester = useCallback((courses: CompletedCourse[]): string | null => {
        const semesterCourses = courses.filter(c => {
            const sem = c.semester.toLowerCase()
            return !sem.includes('transfer') && !sem.includes('ap')
        })
        
        if (semesterCourses.length === 0) return null
        
        const parseSemester = (term: string): number => {
            const yearMatch = term.match(/(\d{4})/)
            const year = yearMatch ? parseInt(yearMatch[1]) : 0
            const termLower = term.toLowerCase()
            let seasonOrder = 0
            if (termLower.includes('spring')) seasonOrder = 1
            else if (termLower.includes('summer')) seasonOrder = 2
            else if (termLower.includes('fall')) seasonOrder = 3
            return year * 10 + seasonOrder
        }
        
        const semesterSet = new Set(semesterCourses.map(c => c.semester))
        const semesters = Array.from(semesterSet)
        semesters.sort((a, b) => parseSemester(b) - parseSemester(a))
        
        const lastSemester = semesters[0]
        if (!lastSemester) return null
        
        const yearMatch = lastSemester.match(/(\d{4})/)
        const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
        const termLower = lastSemester.toLowerCase()
        
        if (termLower.includes('fall')) {
            return `Spring ${year + 1}`
        } else if (termLower.includes('spring')) {
            return `Fall ${year}`
        } else if (termLower.includes('summer')) {
            return `Fall ${year}`
        }
        
        return `Fall ${year}`
    }, [])

    // Reset handler
    const handleReset = useCallback(() => {
        setCurrentStep('school-select')
        setSelectedSchool(null)
        setMajorData(null)
        setIsFreshman(false)
        setExtractedCourses([])
        setPreferences(defaultPreferences)
        setGeneratedSchedule(null)
        setThoughts([])
        setGenerationError(null)
        setGenerationPhase('requirements')
        thoughtIdRef.current = 0
    }, [defaultPreferences])

    // Step handlers with useCallback
    const handleSelectSchool = useCallback((school: School) => {
        setSelectedSchool(school)
        setCurrentStep('major-select')
    }, [])

    const handleMajorContinue = useCallback((data: MajorData) => {
        setMajorData(data)
        setCurrentStep('transcript')
    }, [])

    const handleMajorBack = useCallback(() => {
        setCurrentStep('school-select')
    }, [])

    const handleTranscriptContinue = useCallback((data: TranscriptData) => {
        setIsFreshman(data.isFreshman)
        setExtractedCourses(data.extractedCourses)
        
        if (data.isFreshman || data.extractedCourses.length === 0) {
            // Skip confirm step for freshmen or if no courses found
            setCurrentStep('preferences')
        } else {
            setCurrentStep('confirm-courses')
        }
    }, [])

    const handleTranscriptBack = useCallback(() => {
        setCurrentStep('major-select')
    }, [])

    const handleConfirmCoursesConfirm = useCallback((courses: CompletedCourse[]) => {
        setExtractedCourses(courses)
        
        // Auto-calculate next semester from transcript
        if (courses.length > 0) {
            const nextSem = calculateNextSemester(courses)
            if (nextSem) {
                setPreferences(prev => ({ ...prev, startingSemester: nextSem }))
            }
        }
        
        setCurrentStep('preferences')
    }, [calculateNextSemester])

    const handleConfirmCoursesBack = useCallback(() => {
        setCurrentStep('transcript')
    }, [])

    const handlePreferencesBack = useCallback(() => {
        setCurrentStep('transcript')
    }, [])

    // Thought helpers
    const addThought = useCallback((text: string, isComplete: boolean = false) => {
        const id = thoughtIdRef.current++
        setThoughts(prev => [...prev, { id, text, isComplete }])
    }, [])

    const completeCurrentThought = useCallback(() => {
        setThoughts(prev => {
            if (prev.length === 0) return prev
            const updated = [...prev]
            updated[updated.length - 1] = { ...updated[updated.length - 1], isComplete: true }
            return updated
        })
    }, [])

    // Proceed with actual schedule generation
    const proceedWithGeneration = useCallback(async (prefs: Preferences) => {
        if (!selectedSchool || !majorData) return

        setCurrentStep('generating')
        setThoughts([])
        setGenerationError(null)
        setGenerationPhase('requirements')
        thoughtIdRef.current = 0

        // Reset stage tracking
        setCurrentStage(1)
        setStageStartTime(Date.now())
        setElapsedTime(0)
        setStage1CompletedTime(null)
        setEstimatedMinutes(1.5)

        try {
            const response = await fetch('/api/schedule/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    school: selectedSchool,
                    major: majorData.major,
                    completedCourses: extractedCourses,
                    preferences: prefs,
                    isFreshman,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to start schedule generation')
            }

            const reader = response.body?.getReader()
            if (!reader) {
                throw new Error('No response stream available')
            }

            const decoder = new TextDecoder()
            let buffer = ''
            let receivedComplete = false

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6)
                            const data = JSON.parse(jsonStr)

                            switch (data.type) {
                                case 'stage':
                                    if (data.stage === 1) {
                                        setCurrentStage(1)
                                        setStageStartTime(Date.now())
                                        setElapsedTime(0)
                                        setEstimatedMinutes(data.estimatedMinutes || 1.5)
                                        setGenerationPhase('requirements')
                                    } else if (data.stage === 2) {
                                        setStage1CompletedTime(elapsedTime)
                                        setCurrentStage(2)
                                        setStageStartTime(Date.now())
                                        setElapsedTime(0)
                                        setEstimatedMinutes(data.estimatedMinutes || 2.5)
                                        setGenerationPhase('building')
                                    }
                                    break

                                case 'thought':
                                    if (data.thought) {
                                        completeCurrentThought()
                                        addThought(data.thought, true)
                                    }
                                    if (data.phase) {
                                        setGenerationPhase(data.phase)
                                    }
                                    break

                                case 'phase':
                                    if (data.phase) {
                                        setGenerationPhase(data.phase)
                                    }
                                    break

                                case 'complete':
                                    receivedComplete = true
                                    completeCurrentThought()
                                    setGenerationPhase('complete')

                                    if (data.schedule) {
                                        setGeneratedSchedule(data.schedule)
                                        setCurrentStep('schedule')
                                        
                                        // Save schedule to database
                                        console.log('proceedWithGeneration: Saving new schedule to database')
                                        fetch('/api/log', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                email: prefs.email,
                                                school: selectedSchool,
                                                major: majorData?.major,
                                                preferences: prefs,
                                                isFreshman,
                                                completedCoursesCount: extractedCourses.length,
                                                schedule: data.schedule,
                                            }),
                                        }).then(async (res) => {
                                            const result = await res.json()
                                            if (result.success) {
                                                console.log('proceedWithGeneration: Schedule saved successfully')
                                            } else {
                                                console.error('proceedWithGeneration: Save failed:', result.error)
                                            }
                                        }).catch((err) => {
                                            console.error('proceedWithGeneration: Network error saving schedule:', err)
                                        })
                                    } else {
                                        throw new Error('No schedule data received')
                                    }
                                    break

                                case 'error':
                                    throw new Error(data.message)
                            }
                        } catch (parseError) {
                            if (parseError instanceof SyntaxError) {
                                console.warn('Failed to parse SSE data:', line)
                            } else {
                                throw parseError
                            }
                        }
                    }
                }
            }

            if (!receivedComplete) {
                console.warn('Stream ended without complete event')
            }
        } catch (error) {
            console.error('Generation error:', error)
            setGenerationError(error instanceof Error ? error.message : 'Failed to generate schedule')
        }
    }, [selectedSchool, majorData, extractedCourses, isFreshman, elapsedTime, addThought, completeCurrentThought])

    // Generate schedule handler - checks for existing schedule first
    const handleGenerateSchedule = useCallback(async (prefs: Preferences) => {
        if (!selectedSchool || !majorData) return

        console.log('handleGenerateSchedule: Starting with email:', prefs.email)
        console.log('handleGenerateSchedule: Full preferences:', prefs)

        setPreferences(prefs)
        setPendingPreferences(prefs)

        // Check if user has an existing schedule
        try {
            const emailToCheck = prefs.email || ''
            console.log('handleGenerateSchedule: Checking for existing schedule with email:', emailToCheck)
            
            // Add cache-busting timestamp to prevent stale data
            const response = await fetch(
                `/api/user/schedule?email=${encodeURIComponent(emailToCheck)}&_t=${Date.now()}`,
                { cache: 'no-store' }
            )
            const data = await response.json()

            console.log('handleGenerateSchedule: API response:', data)
            console.log('handleGenerateSchedule: data.exists =', data.exists, 
                ', data.schedule =', !!data.schedule, ', debug =', data.debug)

            if (data.exists && data.schedule) {
                // User has an existing schedule - show modal
                console.log('handleGenerateSchedule: Found existing schedule, showing modal')
                setExistingScheduleData({
                    schedule: data.schedule,
                    school: data.school,
                    major: data.major,
                    createdAt: data.created_at,
                })
                setShowExistingModal(true)
                return
            } else {
                console.log('handleGenerateSchedule: No existing schedule found, proceeding with generation')
            }
        } catch (error) {
            console.error('handleGenerateSchedule: Error checking for existing schedule:', error)
            // Continue with generation if check fails
        }

        // No existing schedule - proceed with generation
        console.log('handleGenerateSchedule: Calling proceedWithGeneration')
        await proceedWithGeneration(prefs)
    }, [selectedSchool, majorData, proceedWithGeneration])

    // Modal handlers
    const handleLoadExisting = useCallback(() => {
        if (existingScheduleData?.schedule && pendingPreferences) {
            console.log('handleLoadExisting: Loading schedule for email:', pendingPreferences.email)
            setPreferences(pendingPreferences)  // Save the email first!
            
            // Parse schedule if it's a string (from database)
            let scheduleToLoad = existingScheduleData.schedule
            if (typeof scheduleToLoad === 'string') {
                console.log('handleLoadExisting: Parsing schedule from JSON string')
                try {
                    scheduleToLoad = JSON.parse(scheduleToLoad)
                } catch (e) {
                    console.error('handleLoadExisting: Failed to parse schedule:', e)
                }
            }
            console.log('handleLoadExisting: Schedule loaded with', 
                scheduleToLoad.semesters?.length, 'semesters')
            
            setGeneratedSchedule(scheduleToLoad)
            setCurrentStep('schedule')
        }
        setShowExistingModal(false)
        setExistingScheduleData(null)
        setPendingPreferences(null)
    }, [existingScheduleData, pendingPreferences])

    const handleCreateNew = useCallback(async () => {
        setShowExistingModal(false)
        setExistingScheduleData(null)
        if (pendingPreferences) {
            await proceedWithGeneration(pendingPreferences)
        }
        setPendingPreferences(null)
    }, [pendingPreferences, proceedWithGeneration])

    const handleCancelModal = useCallback(() => {
        setShowExistingModal(false)
        setExistingScheduleData(null)
        setPendingPreferences(null)
    }, [])

    // Retry generation handler
    const handleRetryGeneration = useCallback(() => {
        proceedWithGeneration(preferences)
    }, [proceedWithGeneration, preferences])

    // Schedule change handler
    const handleScheduleChange = useCallback((schedule: ExtendedSchedulePlan) => {
        setGeneratedSchedule(schedule)
    }, [])


    return (
        <div className={styles.container}>
            <Navbar />

            {/* Secondary toolbar */}
            <div className={styles.toolbar}>
                <button onClick={handleReset} className={styles.startOverBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                    Start Over
                </button>
            </div>

            {/* Main Content */}
            <main className={styles.main}>
                {currentStep === 'school-select' && (
                    <SchoolSelectStep
                        onSelectSchool={handleSelectSchool}
                    />
                )}

                {currentStep === 'major-select' && selectedSchool && (
                    <MajorSelectStep
                        selectedSchool={selectedSchool}
                        onBack={handleMajorBack}
                        onContinue={handleMajorContinue}
                    />
                )}

                {currentStep === 'transcript' && (
                    <TranscriptStep
                        onBack={handleTranscriptBack}
                        onContinue={handleTranscriptContinue}
                    />
                )}

                {currentStep === 'confirm-courses' && (
                    <ConfirmCoursesStep
                        initialCourses={extractedCourses}
                        onBack={handleConfirmCoursesBack}
                        onConfirm={handleConfirmCoursesConfirm}
                    />
                )}

                {currentStep === 'preferences' && (
                    <PreferencesStep
                        isFreshman={isFreshman}
                        extractedCourses={extractedCourses}
                        initialPreferences={preferences}
                        onBack={handlePreferencesBack}
                        onGenerate={handleGenerateSchedule}
                    />
                )}

                {currentStep === 'generating' && selectedSchool && (
                    <GeneratingStep
                        schoolName={selectedSchool.name}
                        generationError={generationError}
                        generationPhase={generationPhase}
                        currentStage={currentStage}
                        elapsedTime={elapsedTime}
                        estimatedMinutes={estimatedMinutes}
                        stage1CompletedTime={stage1CompletedTime}
                        thoughts={thoughts}
                        onRetry={handleRetryGeneration}
                    />
                )}

                {currentStep === 'schedule' && generatedSchedule && selectedSchool && majorData && (
                    <ScheduleStep
                        schedule={generatedSchedule}
                        selectedSchool={selectedSchool}
                        major={majorData.major}
                        onScheduleChange={handleScheduleChange}
                        onRegenerate={handleRetryGeneration}
                        userEmail={preferences.email}
                    />
                )}
            </main>

            {/* Existing Schedule Modal */}
            {showExistingModal && existingScheduleData && pendingPreferences && (
                <ExistingScheduleModal
                    email={pendingPreferences.email || ''}
                    schedule={existingScheduleData.schedule}
                    school={existingScheduleData.school}
                    major={existingScheduleData.major}
                    createdAt={existingScheduleData.createdAt}
                    onLoadExisting={handleLoadExisting}
                    onCreateNew={handleCreateNew}
                    onCancel={handleCancelModal}
                />
            )}
        </div>
    )
}
