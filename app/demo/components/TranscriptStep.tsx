'use client'

import React, { useState, useCallback, useRef } from 'react'
import type { CompletedCourse } from './types'
import styles from '../demo.module.css'

interface TranscriptStepProps {
    onBack: () => void
    onContinue: (data: TranscriptData) => void
}

export interface TranscriptData {
    isFreshman: boolean
    extractedCourses: CompletedCourse[]
}

export const TranscriptStep = React.memo(function TranscriptStep({
    onBack,
    onContinue,
}: TranscriptStepProps) {
    // Local state - prevents parent re-renders
    const [transcriptFile, setTranscriptFile] = useState<File | null>(null)
    const [isFreshman, setIsFreshman] = useState(false)
    const [isParsingTranscript, setIsParsingTranscript] = useState(false)
    const [transcriptError, setTranscriptError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && file.type === 'application/pdf') {
            setTranscriptFile(file)
            setIsFreshman(false)
            setTranscriptError(null)
        }
    }, [])

    const handleFreshmanSelect = useCallback(() => {
        setIsFreshman(prev => !prev)
        if (!isFreshman) {
            setTranscriptFile(null)
            setTranscriptError(null)
        }
    }, [isFreshman])

    const handleProcessTranscript = useCallback(async () => {
        // If freshman, skip transcript parsing and go straight to continue
        if (isFreshman) {
            onContinue({
                isFreshman: true,
                extractedCourses: [],
            })
            return
        }

        // If we have a transcript file, parse it
        if (transcriptFile) {
            setIsParsingTranscript(true)
            setTranscriptError(null)

            try {
                const formData = new FormData()
                formData.append('file', transcriptFile)

                const response = await fetch('/api/transcript/parse', {
                    method: 'POST',
                    body: formData,
                })

                // Check content type before parsing
                const contentType = response.headers.get('content-type')
                if (!contentType?.includes('application/json')) {
                    const text = await response.text()
                    console.error('Non-JSON response:', text.substring(0, 500))
                    throw new Error('Server returned an unexpected response. Please try again.')
                }

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to parse transcript')
                }

                onContinue({
                    isFreshman: false,
                    extractedCourses: data.courses,
                })
            } catch (error) {
                console.error('Transcript parsing error:', error)
                setTranscriptError(
                    error instanceof Error ? error.message : 'Failed to parse transcript'
                )
            } finally {
                setIsParsingTranscript(false)
            }
        } else {
            // No file and not freshman - shouldn't happen due to disabled button
            onContinue({
                isFreshman: false,
                extractedCourses: [],
            })
        }
    }, [isFreshman, transcriptFile, onContinue])

    const handleUploadAreaClick = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    return (
        <div className={styles.centerSection}>
            <div className={`${styles.card} ${styles.animatedCard}`} style={{ maxWidth: '560px' }}>
                <div className={styles.stepIndicator}>
                    <span className={styles.stepComplete}>✓</span>
                    <span className={styles.stepLineComplete} />
                    <span className={styles.stepComplete}>✓</span>
                    <span className={styles.stepLineComplete} />
                    <span className={styles.stepActive}>3</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>4</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>5</span>
                </div>

                <h1 className={styles.cardTitle}>Your Completed Courses</h1>
                <p className={styles.cardDesc}>
                    Upload your unofficial transcript so we can see what classes you&apos;ve
                    already taken. Or select &quot;I&apos;m a Freshman&quot; if you haven&apos;t started yet.
                </p>

                <div
                    className={`${styles.uploadArea} ${transcriptFile ? styles.uploadAreaActive : ''}`}
                    onClick={handleUploadAreaClick}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className={styles.fileInput}
                    />
                    {transcriptFile ? (
                        <>
                            <div className={styles.uploadIconSuccess}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                            </div>
                            <p className={styles.uploadFileName}>{transcriptFile.name}</p>
                            <p className={styles.uploadHint}>Click to change file</p>
                        </>
                    ) : (
                        <>
                            <div className={styles.uploadIcon}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <p className={styles.uploadText}>Drop your transcript PDF here</p>
                            <p className={styles.uploadHint}>or click to browse</p>
                        </>
                    )}
                </div>

                <div className={styles.orDivider}>
                    <span>or</span>
                </div>

                <button
                    className={`${styles.freshmanButton} ${isFreshman ? styles.freshmanButtonActive : ''}`}
                    onClick={handleFreshmanSelect}
                >
                    <span className={styles.freshmanCheck}>
                        {isFreshman ? '✓' : ''}
                    </span>
                    <div className={styles.freshmanText}>
                        <strong>I&apos;m a Freshman</strong>
                        <span>I haven&apos;t taken any college courses yet</span>
                    </div>
                </button>

                {transcriptError && (
                    <div className={styles.errorMessage}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {transcriptError}
                    </div>
                )}

                <div className={styles.transcriptFooter}>
                    <button className={styles.secondaryButton} onClick={onBack}>
                        ← Back
                    </button>
                    <button
                        className={styles.primaryButton}
                        disabled={(!transcriptFile && !isFreshman) || isParsingTranscript}
                        onClick={handleProcessTranscript}
                    >
                        {isParsingTranscript ? (
                            <>
                                <span className={styles.loadingSpinner} />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                {transcriptFile ? 'Analyze Transcript' : 'Continue'}
                                <span className={styles.buttonArrow}>→</span>
                            </>
                        )}
                    </button>
                </div>

                <p className={styles.privacyNote}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Your transcript is processed locally and never stored on our servers.
                </p>
            </div>
        </div>
    )
})

export default TranscriptStep
