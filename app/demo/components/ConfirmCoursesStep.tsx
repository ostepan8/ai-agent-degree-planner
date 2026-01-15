'use client'

import React, { useState, useCallback, useMemo } from 'react'
import type { CompletedCourse } from './types'
import styles from '../demo.module.css'

interface ConfirmCoursesStepProps {
    initialCourses: CompletedCourse[]
    onBack: () => void
    onConfirm: (courses: CompletedCourse[]) => void
}

export const ConfirmCoursesStep = React.memo(function ConfirmCoursesStep({
    initialCourses,
    onBack,
    onConfirm,
}: ConfirmCoursesStepProps) {
    // Local state for editing - prevents parent re-renders
    const [courses, setCourses] = useState<CompletedCourse[]>(initialCourses)
    const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null)

    // Memoized total credits calculation
    const totalCredits = useMemo(() => {
        return courses.reduce((sum, c) => sum + c.credits, 0)
    }, [courses])

    const handleRemoveCourse = useCallback((index: number) => {
        setCourses(prev => prev.filter((_, i) => i !== index))
    }, [])

    const handleUpdateCourse = useCallback((index: number, field: keyof CompletedCourse, value: string | number) => {
        setCourses(prev => prev.map((course, i) =>
            i === index ? { ...course, [field]: value } : course
        ))
    }, [])

    const handleConfirm = useCallback(() => {
        setEditingCourseIndex(null)
        onConfirm(courses)
    }, [courses, onConfirm])

    const handleStartEditing = useCallback((index: number) => {
        setEditingCourseIndex(index)
    }, [])

    const handleStopEditing = useCallback(() => {
        setEditingCourseIndex(null)
    }, [])

    return (
        <div className={styles.centerSection}>
            <div className={`${styles.card} ${styles.animatedCard}`} style={{ maxWidth: '720px' }}>
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

                <h1 className={styles.cardTitle}>Confirm Your Courses</h1>
                <p className={styles.cardDesc}>
                    We found {courses.length} courses in your transcript.
                    Please verify they&apos;re correct before continuing.
                </p>

                <div className={styles.confirmCoursesContainer}>
                    {courses.length === 0 ? (
                        <div className={styles.emptyCoursesMessage}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v4M12 16h.01" />
                            </svg>
                            <p>No courses were found in your transcript.</p>
                            <p className={styles.emptyCoursesHint}>
                                You can go back and try a different file, or continue as a freshman.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.confirmCoursesList}>
                            {courses.map((course, index) => (
                                <div
                                    key={index}
                                    className={`${styles.confirmCourseItem} ${editingCourseIndex === index ? styles.confirmCourseItemEditing : ''}`}
                                >
                                    {editingCourseIndex === index ? (
                                        // Edit mode
                                        <div className={styles.confirmCourseEditForm}>
                                            <div className={styles.confirmCourseEditRow}>
                                                <input
                                                    type="text"
                                                    value={course.code}
                                                    onChange={(e) => handleUpdateCourse(index, 'code', e.target.value)}
                                                    className={styles.confirmCourseInput}
                                                    placeholder="Course Code"
                                                />
                                                <input
                                                    type="text"
                                                    value={course.name}
                                                    onChange={(e) => handleUpdateCourse(index, 'name', e.target.value)}
                                                    className={`${styles.confirmCourseInput} ${styles.confirmCourseInputWide}`}
                                                    placeholder="Course Name"
                                                />
                                            </div>
                                            <div className={styles.confirmCourseEditRow}>
                                                <input
                                                    type="number"
                                                    value={course.credits}
                                                    onChange={(e) => handleUpdateCourse(index, 'credits', parseInt(e.target.value) || 0)}
                                                    className={styles.confirmCourseInputSmall}
                                                    placeholder="Credits"
                                                    min="0"
                                                    max="6"
                                                />
                                                <input
                                                    type="text"
                                                    value={course.grade}
                                                    onChange={(e) => handleUpdateCourse(index, 'grade', e.target.value)}
                                                    className={styles.confirmCourseInputSmall}
                                                    placeholder="Grade"
                                                />
                                                <input
                                                    type="text"
                                                    value={course.semester}
                                                    onChange={(e) => handleUpdateCourse(index, 'semester', e.target.value)}
                                                    className={styles.confirmCourseInput}
                                                    placeholder="Semester"
                                                />
                                                <button
                                                    className={styles.confirmCourseSaveBtn}
                                                    onClick={handleStopEditing}
                                                >
                                                    Done
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Display mode
                                        <>
                                            <div className={styles.confirmCourseInfo}>
                                                <span className={styles.confirmCourseCode}>{course.code}</span>
                                                <span className={styles.confirmCourseName}>{course.name}</span>
                                            </div>
                                            <div className={styles.confirmCourseMeta}>
                                                <span className={styles.confirmCourseCredits}>{course.credits} cr</span>
                                                <span className={styles.confirmCourseGrade}>{course.grade}</span>
                                                <span className={styles.confirmCourseSemester}>{course.semester}</span>
                                            </div>
                                            <div className={styles.confirmCourseActions}>
                                                <button
                                                    className={styles.confirmCourseEditBtn}
                                                    onClick={() => handleStartEditing(index)}
                                                    title="Edit course"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className={styles.confirmCourseDeleteBtn}
                                                    onClick={() => handleRemoveCourse(index)}
                                                    title="Remove course"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {courses.length > 0 && (
                        <div className={styles.confirmCoursesSummary}>
                            <span>{courses.length} courses</span>
                            <span className={styles.confirmCoursesDivider}>•</span>
                            <span>{totalCredits} credits total</span>
                        </div>
                    )}
                </div>

                <div className={styles.transcriptFooter}>
                    <button
                        className={styles.secondaryButton}
                        onClick={onBack}
                    >
                        ← Back
                    </button>
                    <button
                        className={styles.primaryButton}
                        onClick={handleConfirm}
                    >
                        {courses.length > 0 ? 'Looks Good!' : 'Continue Anyway'}
                        <span className={styles.buttonArrow}>→</span>
                    </button>
                </div>
            </div>
        </div>
    )
})

export default ConfirmCoursesStep
