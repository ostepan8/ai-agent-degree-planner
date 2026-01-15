'use client'

import React from 'react'
import styles from '../demo.module.css'
import type { ExtendedSchedulePlan, SemesterItem } from './types'

interface ExistingScheduleModalProps {
    email: string
    schedule: ExtendedSchedulePlan
    school?: string
    major?: string
    createdAt?: string
    onLoadExisting: () => void
    onCreateNew: () => void
    onCancel: () => void
}

export const ExistingScheduleModal = React.memo(function ExistingScheduleModal({
    email,
    schedule,
    school,
    major,
    onLoadExisting,
    onCreateNew,
    onCancel,
}: ExistingScheduleModalProps) {
    // Parse schedule if it's a string (from database)
    const parsedSchedule: ExtendedSchedulePlan = typeof schedule === 'string' 
        ? JSON.parse(schedule) 
        : schedule

    // Calculate schedule stats
    const semesters = (parsedSchedule.semesters || []) as SemesterItem[]
    
    const totalCourses = semesters.reduce((sum, sem) => {
        if (sem.type === 'academic' && sem.courses) {
            return sum + sem.courses.length
        }
        return sum
    }, 0)

    const totalCredits = parsedSchedule.totalCredits || semesters.reduce((sum, sem) => {
        if (sem.type === 'academic' && sem.totalCredits) {
            return sum + sem.totalCredits
        }
        return sum
    }, 0)

    const coopCount = semesters.filter(sem => sem.type === 'coop').length
    const academicSemesters = semesters.filter(sem => sem.type === 'academic').length

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
            }}
            onClick={onCancel}
        >
            <div 
                style={{
                    maxWidth: '520px',
                    width: '100%',
                    background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '20px',
                    padding: '32px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                        boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
                    }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <polyline points="16 13 12 17 8 13" />
                            <line x1="12" y1="17" x2="12" y2="9" />
                        </svg>
                    </div>
                    <h2 style={{ 
                        fontSize: '26px', 
                        fontWeight: '700', 
                        color: 'white',
                        marginBottom: '10px',
                        letterSpacing: '-0.02em',
                    }}>
                        Welcome Back!
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.5' }}>
                        We found your saved schedule
                    </p>
                </div>

                {/* Schedule Preview Card */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px',
                }}>
                    {/* School and Major Header */}
                    <div style={{ 
                        marginBottom: '16px', 
                        paddingBottom: '16px', 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px',
                            marginBottom: '6px',
                        }}>
                            <svg 
                                width="18" 
                                height="18" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="#3b82f6" 
                                strokeWidth="2"
                            >
                                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                <path d="M6 12v5c3 3 9 3 12 0v-5" />
                            </svg>
                            <span style={{ color: 'white', fontSize: '16px', fontWeight: '600' }}>
                                {school || 'University'}
                            </span>
                        </div>
                        <div style={{ 
                            color: '#94a3b8', 
                            fontSize: '14px',
                            paddingLeft: '28px',
                        }}>
                            {parsedSchedule.degree || 'BS'} in {major || parsedSchedule.major || 'Computer Science'}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '16px',
                    }}>
                        <div style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '12px',
                            padding: '14px',
                            textAlign: 'center',
                        }}>
                            <div style={{ 
                                color: '#3b82f6', 
                                fontSize: '24px', 
                                fontWeight: '700',
                                marginBottom: '4px',
                            }}>
                                {totalCredits}
                            </div>
                            <div style={{ 
                                color: '#94a3b8', 
                                fontSize: '12px', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em',
                            }}>
                                Total Credits
                            </div>
                        </div>
                        <div style={{
                            background: 'rgba(139, 92, 246, 0.1)',
                            borderRadius: '12px',
                            padding: '14px',
                            textAlign: 'center',
                        }}>
                            <div style={{ 
                                color: '#8b5cf6', 
                                fontSize: '24px', 
                                fontWeight: '700',
                                marginBottom: '4px',
                            }}>
                                {totalCourses}
                            </div>
                            <div style={{ 
                                color: '#94a3b8', 
                                fontSize: '12px', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em',
                            }}>
                                Courses
                            </div>
                        </div>
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '12px',
                            padding: '14px',
                            textAlign: 'center',
                        }}>
                            <div style={{ 
                                color: '#10b981', 
                                fontSize: '24px', 
                                fontWeight: '700',
                                marginBottom: '4px',
                            }}>
                                {academicSemesters}
                            </div>
                            <div style={{ 
                                color: '#94a3b8', 
                                fontSize: '12px', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em',
                            }}>
                                Semesters
                            </div>
                        </div>
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            borderRadius: '12px',
                            padding: '14px',
                            textAlign: 'center',
                        }}>
                            <div style={{ 
                                color: '#f59e0b', 
                                fontSize: '24px', 
                                fontWeight: '700',
                                marginBottom: '4px',
                            }}>
                                {coopCount}
                            </div>
                            <div style={{ 
                                color: '#94a3b8', 
                                fontSize: '12px', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em',
                            }}>
                                Co-ops
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    {(parsedSchedule.startTerm || parsedSchedule.graduationTerm) && (
                        <div style={{
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                        }}>
                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                                {parsedSchedule.startTerm || 'Start'}
                            </span>
                            <div style={{
                                flex: 1,
                                maxWidth: '120px',
                                height: '2px',
                                background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                                borderRadius: '2px',
                            }} />
                            <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
                                {parsedSchedule.graduationTerm || 'Graduate'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        className={styles.primaryButton}
                        onClick={onLoadExisting}
                        style={{ 
                            width: '100%', 
                            justifyContent: 'center',
                            padding: '14px 24px',
                            fontSize: '15px',
                            fontWeight: '600',
                        }}
                    >
                        <svg 
                            width="20" 
                            height="20" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            style={{ marginRight: '10px' }}
                        >
                            <polyline points="16 13 12 17 8 13" />
                            <line x1="12" y1="17" x2="12" y2="3" />
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        </svg>
                        Load My Schedule
                    </button>
                    <button
                        onClick={onCreateNew}
                        style={{
                            width: '100%',
                            padding: '14px 24px',
                            fontSize: '15px',
                            fontWeight: '500',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '12px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                        }}
                    >
                        <svg 
                            width="18" 
                            height="18" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            style={{ marginRight: '10px' }}
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Start Fresh Instead
                    </button>
                </div>

                {/* Cancel Link */}
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '8px 16px',
                            fontSize: '14px',
                            transition: 'color 0.2s ease',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#94a3b8'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
})

export default ExistingScheduleModal
