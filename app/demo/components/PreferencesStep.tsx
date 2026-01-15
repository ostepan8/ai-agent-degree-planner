'use client'

import React, { useState, useCallback, useMemo } from 'react'
import type { CompletedCourse, Preferences } from './types'
import { generateSemesterOptions } from '@/lib/utils/semester'
import styles from '../demo.module.css'

interface PreferencesStepProps {
    isFreshman: boolean
    extractedCourses: CompletedCourse[]
    initialPreferences: Preferences
    onBack: () => void
    onGenerate: (preferences: Preferences) => void
}

export const PreferencesStep = React.memo(function PreferencesStep({
    isFreshman,
    extractedCourses,
    initialPreferences,
    onBack,
    onGenerate,
}: PreferencesStepProps) {
    // Local state for form - prevents parent re-renders on each change
    const [preferences, setPreferences] = useState<Preferences>(initialPreferences)

    // Memoized total credits calculation
    const totalCreditsCompleted = useMemo(() => {
        return extractedCourses.reduce((sum, c) => sum + c.credits, 0)
    }, [extractedCourses])

    const handleStartingSemesterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setPreferences(p => ({ ...p, startingSemester: e.target.value }))
    }, [])

    const handleCreditsPerSemesterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setPreferences(p => ({ ...p, creditsPerSemester: e.target.value as Preferences['creditsPerSemester'] }))
    }, [])

    const handleCoopPlanChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setPreferences(p => ({ ...p, coopPlan: e.target.value as Preferences['coopPlan'] }))
    }, [])

    const handleAdditionalNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPreferences(p => ({ ...p, additionalNotes: e.target.value }))
    }, [])

    const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setPreferences(p => ({ ...p, email: e.target.value }))
    }, [])

    // Email validation
    const isEmailValid = useMemo(() => {
        const email = preferences.email?.trim() || ''
        // Basic email validation
        return email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }, [preferences.email])

    const handleGenerate = useCallback(() => {
        if (!isEmailValid) return
        onGenerate(preferences)
    }, [preferences, onGenerate, isEmailValid])

    return (
        <div className={styles.centerSection}>
            <div className={`${styles.card} ${styles.animatedCard}`} style={{ maxWidth: '640px' }}>
                <div className={styles.stepIndicator}>
                    <span className={styles.stepComplete}>✓</span>
                    <span className={styles.stepLineComplete} />
                    <span className={styles.stepComplete}>✓</span>
                    <span className={styles.stepLineComplete} />
                    <span className={styles.stepComplete}>✓</span>
                    <span className={styles.stepLineComplete} />
                    <span className={styles.stepActive}>4</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>5</span>
                </div>

                <h1 className={styles.cardTitle}>Schedule Preferences</h1>
                <p className={styles.cardDesc}>
                    {isFreshman
                        ? 'Configure your preferences and we\'ll generate your complete 4-year plan.'
                        : `We found ${extractedCourses.length} completed courses (${totalCreditsCompleted} credits). Now set your preferences.`
                    }
                </p>

                {!isFreshman && extractedCourses.length > 0 && (
                    <div className={styles.completedSummary}>
                        <div className={styles.completedHeader}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>Courses Already Completed</span>
                        </div>
                        <div className={styles.completedGrid}>
                            {extractedCourses.map((course) => (
                                <div key={course.code} className={styles.completedCourse}>
                                    <span className={styles.completedCode}>{course.code}</span>
                                    <span className={styles.completedGrade}>{course.grade}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.preferencesForm}>
                    <div className={styles.prefGroup}>
                        <label className={styles.prefLabel}>
                            Email Address <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="email"
                            className={styles.prefSelect}
                            placeholder="your.email@example.com (required)"
                            value={preferences.email || ''}
                            onChange={handleEmailChange}
                            style={{
                                borderColor: preferences.email && !isEmailValid ? '#ef4444' : undefined,
                            }}
                            required
                        />
                        {preferences.email && !isEmailValid && (
                            <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                                Please enter a valid email address
                            </div>
                        )}
                        <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                            Your schedule will be saved to this email so you can return and edit it later.
                        </div>
                    </div>

                    <div className={styles.prefGroup}>
                        <label className={styles.prefLabel}>
                            {isFreshman ? 'Starting Semester' : 'Next Semester'}
                        </label>
                        {!isFreshman && extractedCourses.length > 0 && (
                            <div className={styles.autoDetectedNote}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4M12 8h.01" />
                                </svg>
                                Auto-detected from your transcript
                            </div>
                        )}
                        <select
                            className={styles.prefSelect}
                            value={preferences.startingSemester}
                            onChange={handleStartingSemesterChange}
                        >
                            {generateSemesterOptions(8).map((semester) => (
                                <option key={semester} value={semester}>
                                    {semester}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.prefGroup}>
                        <label className={styles.prefLabel}>Credits per Semester</label>
                        <select
                            className={styles.prefSelect}
                            value={preferences.creditsPerSemester}
                            onChange={handleCreditsPerSemesterChange}
                        >
                            <option value="standard">16-18 credits (Standard full-time)</option>
                            <option value="accelerated">18-20 credits (Accelerated)</option>
                            <option value="light">12-15 credits (Lighter load)</option>
                        </select>
                    </div>

                    <div className={styles.prefGroup}>
                        <label className={styles.prefLabel}>Co-op Plan</label>
                        <select
                            className={styles.prefSelect}
                            value={preferences.coopPlan}
                            onChange={handleCoopPlanChange}
                        >
                            <option value="three">3 Co-ops (5 year plan)</option>
                            <option value="two">2 Co-ops (4.5 year plan)</option>
                            <option value="one">1 Co-op (4 year plan)</option>
                            <option value="none">No Co-ops (4 year plan)</option>
                        </select>
                    </div>

                    <div className={styles.prefGroup}>
                        <label className={styles.prefLabel}>Additional Preferences</label>
                        <textarea
                            className={styles.prefTextarea}
                            placeholder="e.g. I want to take CS 3500 before my first co-op, prefer morning classes, want to study abroad junior year, avoid Friday classes..."
                            rows={3}
                            value={preferences.additionalNotes}
                            onChange={handleAdditionalNotesChange}
                        />
                    </div>
                </div>

                <div className={styles.transcriptFooter}>
                    <button className={styles.secondaryButton} onClick={onBack}>
                        ← Back
                    </button>
                    <button 
                        className={styles.primaryButton} 
                        onClick={handleGenerate}
                        disabled={!isEmailValid}
                        style={{
                            opacity: isEmailValid ? 1 : 0.5,
                            cursor: isEmailValid ? 'pointer' : 'not-allowed',
                        }}
                        title={!isEmailValid ? 'Please enter a valid email address' : undefined}
                    >
                        Generate My Plan
                        <span className={styles.buttonArrow}>→</span>
                    </button>
                </div>
            </div>
        </div>
    )
})

export default PreferencesStep
