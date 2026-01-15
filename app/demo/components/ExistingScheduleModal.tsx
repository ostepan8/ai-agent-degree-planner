'use client'

import React from 'react'
import styles from '../demo.module.css'
import type { ExtendedSchedulePlan } from './types'

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
    createdAt,
    onLoadExisting,
    onCreateNew,
    onCancel,
}: ExistingScheduleModalProps) {
    // Format the date
    const formattedDate = createdAt 
        ? new Date(createdAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        : null

    // Count courses in schedule
    const totalCourses = schedule.semesters?.reduce((sum, sem) => {
        if (sem.type === 'academic' && sem.courses) {
            return sum + sem.courses.length
        }
        return sum
    }, 0) || 0

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
            }}
            onClick={onCancel}
        >
            <div 
                className={styles.card}
                style={{
                    maxWidth: '500px',
                    width: '100%',
                    animation: 'fadeSlideUp 0.3s ease-out',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                    <h2 style={{ 
                        fontSize: '24px', 
                        fontWeight: '600', 
                        color: 'white',
                        marginBottom: '8px',
                    }}>
                        Welcome Back!
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                        We found an existing schedule for <strong style={{ color: 'white' }}>{email}</strong>
                    </p>
                </div>

                <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '24px',
                }}>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                    }}>
                        {school && (
                            <div>
                                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>School</div>
                                <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{school}</div>
                            </div>
                        )}
                        {major && (
                            <div>
                                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Major</div>
                                <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{major}</div>
                            </div>
                        )}
                        <div>
                            <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Courses Planned</div>
                            <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{totalCourses} courses</div>
                        </div>
                        {formattedDate && (
                            <div>
                                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Created</div>
                                <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{formattedDate}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        className={styles.primaryButton}
                        onClick={onLoadExisting}
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Load My Schedule
                    </button>
                    <button
                        className={styles.secondaryButton}
                        onClick={onCreateNew}
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Create New Schedule
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#6b7280',
                            cursor: 'pointer',
                            padding: '8px',
                            fontSize: '14px',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
})

export default ExistingScheduleModal
