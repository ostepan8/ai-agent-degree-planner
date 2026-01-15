'use client'

import React, { useState, useCallback } from 'react'
import type { School, StudyAbroadState } from './types'
import styles from '../demo.module.css'

interface MajorSelectStepProps {
    selectedSchool: School
    onBack: () => void
    onContinue: (data: MajorData) => void
}

export interface MajorData {
    major: string
    concentration: string
    minor: string
    combinedMajor: string
    isHonors: boolean
    studyAbroad: StudyAbroadState
}

export const MajorSelectStep = React.memo(function MajorSelectStep({
    selectedSchool,
    onBack,
    onContinue,
}: MajorSelectStepProps) {
    // Local state for form fields - prevents parent re-renders on each keystroke
    const [major, setMajor] = useState('')
    const [concentration, setConcentration] = useState('')
    const [minor, setMinor] = useState('')
    const [combinedMajor, setCombinedMajor] = useState('')
    const [isHonors, setIsHonors] = useState(false)
    const [studyAbroad, setStudyAbroad] = useState<StudyAbroadState>({ planned: false })

    const handleContinue = useCallback(() => {
        if (major.trim()) {
            onContinue({
                major,
                concentration,
                minor,
                combinedMajor,
                isHonors,
                studyAbroad,
            })
        }
    }, [major, concentration, minor, combinedMajor, isHonors, studyAbroad, onContinue])

    const handleMajorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setMajor(e.target.value)
    }, [])

    const handleConcentrationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setConcentration(e.target.value)
    }, [])

    const handleMinorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setMinor(e.target.value)
    }, [])

    const handleCombinedMajorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setCombinedMajor(e.target.value)
    }, [])

    const handleHonorsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setIsHonors(e.target.checked)
    }, [])

    const handleStudyAbroadToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setStudyAbroad(prev => ({ ...prev, planned: e.target.checked }))
    }, [])

    const handleStudyAbroadTermChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setStudyAbroad(prev => ({ ...prev, term: e.target.value }))
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleContinue()
        }
    }, [handleContinue])

    return (
        <div className={styles.centerSection}>
            <div className={`${styles.card} ${styles.animatedCard}`}>
                <div className={styles.stepIndicator}>
                    <span className={styles.stepComplete}>✓</span>
                    <span className={styles.stepLineComplete} />
                    <span className={styles.stepActive}>2</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>3</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>4</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>5</span>
                </div>

                <h1 className={styles.cardTitle}>What are you studying?</h1>
                <p className={styles.cardDesc}>
                    Enter your major and the agent will search official {selectedSchool?.shortName || selectedSchool?.name}
                    {' '}catalogs to find your degree requirements.
                </p>

                <div className={styles.schoolBadge}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                    </svg>
                    {selectedSchool?.name}
                    <button
                        className={styles.changeSchoolBtn}
                        onClick={onBack}
                    >
                        Change
                    </button>
                </div>

                <div className={styles.inputWrapper}>
                    <input
                        type="text"
                        value={major}
                        onChange={handleMajorChange}
                        placeholder="e.g. Computer Science BS, Data Science, Biology..."
                        className={styles.input}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                </div>

                {/* Additional Context Fields */}
                <div className={styles.contextFieldsSection}>
                    <p className={styles.contextFieldsLabel}>Additional Details (Optional)</p>

                    <div className={styles.contextFieldsGrid}>
                        <div className={styles.contextField}>
                            <label>Concentration</label>
                            <input
                                type="text"
                                value={concentration}
                                onChange={handleConcentrationChange}
                                placeholder="e.g. Artificial Intelligence, Systems..."
                                className={styles.inputSmall}
                            />
                        </div>

                        <div className={styles.contextField}>
                            <label>Minor</label>
                            <input
                                type="text"
                                value={minor}
                                onChange={handleMinorChange}
                                placeholder="e.g. Mathematics, Business..."
                                className={styles.inputSmall}
                            />
                        </div>

                        <div className={styles.contextField}>
                            <label>Combined/Dual Major</label>
                            <input
                                type="text"
                                value={combinedMajor}
                                onChange={handleCombinedMajorChange}
                                placeholder="e.g. Data Science..."
                                className={styles.inputSmall}
                            />
                        </div>
                    </div>

                    <div className={styles.contextFieldsRow}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={isHonors}
                                onChange={handleHonorsChange}
                            />
                            <span>Honors Program</span>
                        </label>

                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={studyAbroad.planned}
                                onChange={handleStudyAbroadToggle}
                            />
                            <span>Planning Study Abroad</span>
                        </label>

                        {studyAbroad.planned && (
                            <select
                                value={studyAbroad.term || ''}
                                onChange={handleStudyAbroadTermChange}
                                className={styles.selectSmall}
                            >
                                <option value="">Select term...</option>
                                <option value="Fall 2026">Fall 2026</option>
                                <option value="Spring 2027">Spring 2027</option>
                                <option value="Fall 2027">Fall 2027</option>
                                <option value="Spring 2028">Spring 2028</option>
                            </select>
                        )}
                    </div>
                </div>

                <div className={styles.transcriptFooter}>
                    <button className={styles.secondaryButton} onClick={onBack}>
                        ← Back
                    </button>
                    <button
                        onClick={handleContinue}
                        disabled={!major.trim()}
                        className={styles.primaryButton}
                    >
                        Continue
                        <span className={styles.buttonArrow}>→</span>
                    </button>
                </div>
            </div>
        </div>
    )
})

export default MajorSelectStep
