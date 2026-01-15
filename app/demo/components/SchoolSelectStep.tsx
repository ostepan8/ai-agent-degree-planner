'use client'

import React, { useState, useEffect, useCallback, useRef, memo } from 'react'
import type { School } from './types'
import styles from '../demo.module.css'

interface SchoolSelectStepProps {
    onSelectSchool: (school: School) => void
}

// Memoized individual school card to prevent re-renders
interface SchoolCardProps {
    school: School
    onSelect: (school: School) => void
}

const SchoolCard = memo(function SchoolCard({ school, onSelect }: SchoolCardProps) {
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onSelect(school)
    }, [school, onSelect])

    return (
        <button
            type="button"
            className={styles.schoolCard}
            onClick={handleClick}
        >
            <div className={styles.schoolIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                </svg>
            </div>
            <div className={styles.schoolInfo}>
                <span className={styles.schoolName}>{school.name}</span>
                {school.location && (
                    <span className={styles.schoolLocation}>{school.location}</span>
                )}
            </div>
        </button>
    )
})

export const SchoolSelectStep = React.memo(function SchoolSelectStep({
    onSelectSchool,
}: SchoolSelectStepProps) {
    // Local state for search - prevents parent re-renders
    const [schoolSearch, setSchoolSearch] = useState('')
    const [schoolResults, setSchoolResults] = useState<School[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isInitialLoading, setIsInitialLoading] = useState(true)
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Load popular schools on mount
    useEffect(() => {
        let cancelled = false
        
        fetch('/api/schools/search')
            .then(res => res.json())
            .then(data => {
                if (!cancelled) {
                    setSchoolResults(data.schools || [])
                    setIsInitialLoading(false)
                }
            })
            .catch(err => {
                console.error(err)
                if (!cancelled) {
                    setIsInitialLoading(false)
                }
            })
        
        return () => { cancelled = true }
    }, [])

    // Debounced school search
    const handleSchoolSearch = useCallback((query: string) => {
        setSchoolSearch(query)

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        if (query.trim().length < 2) {
            // Only refetch if we have a search term that was cleared
            if (schoolSearch.trim().length >= 2) {
                fetch('/api/schools/search')
                    .then(res => res.json())
                    .then(data => setSchoolResults(data.schools || []))
                    .catch(console.error)
            }
            return
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true)
            try {
                const res = await fetch('/api/schools/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query }),
                })
                const data = await res.json()
                setSchoolResults(data.schools || [])
            } catch (error) {
                console.error('School search error:', error)
            } finally {
                setIsSearching(false)
            }
        }, 300)
    }, [schoolSearch])

    // Stable onChange handler for search input
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        handleSchoolSearch(e.target.value)
    }, [handleSchoolSearch])

    return (
        <div className={styles.centerSection}>
            <div className={styles.card}>
                <div className={styles.stepIndicator}>
                    <span className={styles.stepActive}>1</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>2</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>3</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>4</span>
                    <span className={styles.stepLine} />
                    <span className={styles.stepInactive}>5</span>
                </div>

                <h1 className={styles.cardTitle}>Select Your School</h1>
                <p className={styles.cardDesc}>
                    Choose your university from the list below or search for any school.
                    The agent will search official catalogs to find your degree requirements.
                </p>

                <div className={styles.inputWrapper}>
                    <input
                        type="text"
                        value={schoolSearch}
                        onChange={handleInputChange}
                        placeholder="Search for a university..."
                        className={styles.input}
                        autoFocus
                    />
                    {isSearching && <span className={styles.searchingIndicator}>Searching...</span>}
                </div>

                <div className={styles.schoolGrid}>
                    {schoolResults.map((school) => (
                        <SchoolCard
                            key={school.id}
                            school={school}
                            onSelect={onSelectSchool}
                        />
                    ))}
                </div>

                {isInitialLoading && (
                    <p className={styles.noResults}>Loading schools...</p>
                )}

                {!isInitialLoading && schoolResults.length === 0 && !isSearching && (
                    <p className={styles.noResults}>
                        No schools found. Try a different search or the agent will search the web.
                    </p>
                )}
            </div>
        </div>
    )
})

export default SchoolSelectStep
