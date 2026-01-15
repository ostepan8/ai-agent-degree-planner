'use client'

/* eslint-disable @next/next/no-img-element */
import styles from './pdf.module.css'
import type { SchedulePlan } from '@/lib/schemas'

interface SchedulePDFProps {
    schedule: SchedulePlan
    major: string
    schoolName: string
}

type SemesterItem = {
    term: string
    type: 'academic' | 'coop'
    courses?: Array<{ code: string; name: string; credits: number; options?: string }>
    coopNumber?: number
    totalCredits?: number
}

interface AcademicYearGroup {
    year: string
    academicYear: string
    semesters: SemesterItem[]
    totalCredits: number
    hasCoOp: boolean
}

export function SchedulePDF({ schedule, major, schoolName }: SchedulePDFProps) {
    const semesters = (schedule.semesters || []) as SemesterItem[]

    // Group semesters by academic year
    const getAcademicYear = (term: string): number => {
        const yearMatch = term.match(/\d{4}/)
        const year = yearMatch ? parseInt(yearMatch[0]) : 2025
        const isFall = term.toLowerCase().includes('fall')
        return isFall ? year : year - 1
    }

    const startYear = semesters.length > 0 ? getAcademicYear(semesters[0].term) : 2025

    const academicYearGroups: Map<number, SemesterItem[]> = new Map()
    semesters.forEach((sem) => {
        const academicYear = getAcademicYear(sem.term)
        if (!academicYearGroups.has(academicYear)) {
            academicYearGroups.set(academicYear, [])
        }
        academicYearGroups.get(academicYear)!.push(sem)
    })

    const yearGroups: AcademicYearGroup[] = Array.from(academicYearGroups.entries())
        .sort(([a], [b]) => a - b)
        .map(([academicYear, sems]) => {
            const totalCredits = sems.reduce((sum, sem) => {
                if (sem.type === 'academic' && sem.totalCredits) {
                    return sum + sem.totalCredits
                }
                return sum
            }, 0)
            const hasCoOp = sems.some(sem => sem.type === 'coop')

            return {
                year: `Year ${academicYear - startYear + 1}`,
                academicYear: `${academicYear}-${academicYear + 1}`,
                semesters: sems,
                totalCredits,
                hasCoOp
            }
        })

    const getSeasonIcon = (term: string): string => {
        const termLower = term.toLowerCase()
        if (termLower.includes('fall')) return '🍂'
        if (termLower.includes('spring')) return '🌸'
        if (termLower.includes('summer')) return '☀️'
        return '📅'
    }

    const getSemesterClass = (term: string): string => {
        const termLower = term.toLowerCase()
        if (termLower.includes('fall')) return styles.semesterFall
        if (termLower.includes('spring')) return styles.semesterSpring
        if (termLower.includes('summer')) return styles.semesterSummer
        return styles.semesterFall
    }

    const generatedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    return (
        <div id="schedule-pdf" className={styles.pdfContainer}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.logoRow}>
                        <img
                            src="/Subconscious_Logo_Graphic.png"
                            alt="Subconscious"
                            width={32}
                            height={32}
                            className={styles.logo}
                        />
                        <h1 className={styles.title}>Degree Plan</h1>
                    </div>
                    <p className={styles.subtitle}>{schoolName}</p>
                    <p className={styles.degreeInfo}>
                        {schedule.degree} in {schedule.major || major}
                    </p>
                </div>
                <div className={styles.headerRight}>
                    <p className={styles.generatedDate}>Generated {generatedDate}</p>
                </div>
            </header>

            {/* Summary Stats */}
            <div className={styles.summaryRow}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryValue}>{schedule.totalCredits}</span>
                    <span className={styles.summaryLabel}>Total Credits</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryValue}>{yearGroups.length}</span>
                    <span className={styles.summaryLabel}>Years</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryValue}>{schedule.startTerm}</span>
                    <span className={styles.summaryLabel}>Start</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryValue}>{schedule.graduationTerm}</span>
                    <span className={styles.summaryLabel}>Graduate</span>
                </div>
            </div>

            {/* Year Sections */}
            {yearGroups.map((yearGroup, yearIndex) => (
                <section key={yearIndex} className={styles.yearSection}>
                    <div className={styles.yearHeader}>
                        <h2 className={styles.yearTitle}>
                            {yearGroup.year}
                            <span className={styles.yearSubtitle}>({yearGroup.academicYear})</span>
                        </h2>
                        <div className={styles.yearCredits}>
                            {yearGroup.hasCoOp && (
                                <span className={styles.coopBadge}>Co-op</span>
                            )}
                            <span className={styles.creditsLabel}>{yearGroup.totalCredits} credits</span>
                        </div>
                    </div>
                    <div className={styles.yearContent}>
                        <div className={styles.semesterGrid}>
                            {yearGroup.semesters.map((sem, semIndex) => (
                                sem.type === 'coop' ? (
                                    <div key={semIndex} className={styles.coopCard}>
                                        <h4 className={styles.coopTitle}>{sem.term}</h4>
                                        <span className={styles.coopNumber}>Co-op {sem.coopNumber}</span>
                                        <p className={styles.coopDesc}>Full-time work experience</p>
                                    </div>
                                ) : (
                                    <div
                                        key={semIndex}
                                        className={`${styles.semesterCard} ${getSemesterClass(sem.term)}`}
                                    >
                                        <div className={styles.semesterHeader}>
                                            <span className={styles.semesterIcon}>{getSeasonIcon(sem.term)}</span>
                                            <h4 className={styles.semesterTitle}>{sem.term}</h4>
                                            <span className={styles.semesterCreditsTotal}>{sem.totalCredits}cr</span>
                                        </div>
                                        <div className={styles.courseList}>
                                            {sem.courses?.map((course, i) => (
                                                <div key={i} className={styles.courseRow}>
                                                    <span className={styles.courseCode}>{course.code}</span>
                                                    <span className={styles.courseName}>
                                                        {course.name}
                                                        {course.options && (
                                                            <span className={styles.courseOptions}>
                                                                Options: {course.options}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className={styles.courseCredits}>{course.credits}cr</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </section>
            ))}

            {/* Warnings */}
            {schedule.warnings && schedule.warnings.length > 0 && (
                <div className={styles.warningsBox}>
                    <h4 className={styles.warningsTitle}>Important Notes</h4>
                    <ul className={styles.warningsList}>
                        {(Array.isArray(schedule.warnings) ? schedule.warnings : [schedule.warnings]).map((warning, i) => (
                            <li key={i} className={styles.warningItem}>{warning}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Footer */}
            <footer className={styles.footer}>
                <p className={styles.sourceNote}>
                    <strong>Source:</strong>{' '}
                    <a href={schedule.sourceUrl} className={styles.sourceLink}>
                        {schedule.sourceUrl}
                    </a>
                </p>
                <p className={styles.advisorNote}>
                    <svg className={styles.advisorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    This is a suggested plan based on catalog requirements. Course availability varies by semester.
                    Always verify with your academic advisor and check for registration.
                </p>
            </footer>
        </div>
    )
}

