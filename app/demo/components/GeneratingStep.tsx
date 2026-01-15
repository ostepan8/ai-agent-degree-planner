'use client'

import React, { useRef, useEffect } from 'react'
import Image from 'next/image'
import type { AgentThought } from './types'
import styles from '../demo.module.css'

type GenerationPhase = 'requirements' | 'searching' | 'extracting' | 'building' | 'validating' | 'complete'

interface GeneratingStepProps {
    schoolName: string
    generationError: string | null
    generationPhase: GenerationPhase
    currentStage: 1 | 2
    elapsedTime: number
    estimatedMinutes: number
    stage1CompletedTime: number | null
    thoughts: AgentThought[]
    onRetry: () => void
}

// Helper to format elapsed time as "M:SS"
const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
}

export const GeneratingStep = React.memo(function GeneratingStep({
    schoolName,
    generationError,
    generationPhase,
    currentStage,
    elapsedTime,
    estimatedMinutes,
    stage1CompletedTime,
    thoughts,
    onRetry,
}: GeneratingStepProps) {
    const thoughtsContainerRef = useRef<HTMLDivElement>(null)

    // Auto-scroll thoughts container
    useEffect(() => {
        if (thoughtsContainerRef.current) {
            thoughtsContainerRef.current.scrollTop = thoughtsContainerRef.current.scrollHeight
        }
    }, [thoughts])

    return (
        <div className={styles.centerSection}>
            <div className={`${styles.researchCard} ${styles.animatedCard}`}>
                <div className={styles.researchAnimation}>
                    <div className={styles.searchPulse}>
                        <Image
                            src="/Subconscious_Logo_Graphic.png"
                            alt=""
                            width={56}
                            height={56}
                        />
                    </div>
                </div>

                <h1 className={styles.cardTitle}>Building Your Degree Plan</h1>
                <p className={styles.cardDesc}>
                    Our AI agent is analyzing {schoolName}&apos;s course catalog and requirements to create your personalized plan.
                </p>
                {generationError ? (
                    <div className={styles.errorBox}>
                        <p>{generationError}</p>
                        <button
                            className={styles.primaryButton}
                            onClick={onRetry}
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Two-Stage Progress */}
                        <div className={styles.stageProgress}>
                            {/* Stage 1: Requirements Research */}
                            <div className={`${styles.stageCard} ${currentStage === 1 ? styles.stageActive :
                                    currentStage === 2 ? styles.stageComplete : ''
                                }`}>
                                <div className={styles.stageHeader}>
                                    <div className={styles.stageIndicator}>
                                        {currentStage > 1 ? (
                                            <span className={styles.stageCheck}>✓</span>
                                        ) : (
                                            <span className={styles.stageSpinner} />
                                        )}
                                    </div>
                                    <div className={styles.stageInfo}>
                                        <div className={styles.stageTitle}>
                                            Stage 1: Researching Requirements
                                        </div>
                                        <div className={styles.stageTime}>
                                            {currentStage === 1 ? (
                                                <>
                                                    <span className={styles.elapsed}>
                                                        {formatElapsedTime(elapsedTime)}
                                                    </span>
                                                    <span className={styles.estimated}>
                                                        / ~{estimatedMinutes} min
                                                    </span>
                                                </>
                                            ) : stage1CompletedTime ? (
                                                <span className={styles.completedTime}>
                                                    Completed in {formatElapsedTime(stage1CompletedTime)}
                                                </span>
                                            ) : (
                                                <span className={styles.estimated}>~1.5 min</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {currentStage === 1 && (
                                    <div className={styles.stageProgressBar}>
                                        <div
                                            className={styles.stageProgressFill}
                                            style={{
                                                width: `${Math.min(
                                                    (elapsedTime / (estimatedMinutes * 60)) * 100,
                                                    95
                                                )}%`
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Connector */}
                            <div className={`${styles.stageConnector} ${currentStage > 1 ? styles.connectorActive : ''
                                }`}>
                                <div className={styles.connectorLine} />
                            </div>

                            {/* Stage 2: Schedule Building */}
                            <div className={`${styles.stageCard} ${currentStage === 2 ? styles.stageActive :
                                    generationPhase === 'complete' ? styles.stageComplete :
                                        styles.stagePending
                                }`}>
                                <div className={styles.stageHeader}>
                                    <div className={styles.stageIndicator}>
                                        {generationPhase === 'complete' ? (
                                            <span className={styles.stageCheck}>✓</span>
                                        ) : currentStage === 2 ? (
                                            <span className={styles.stageSpinner} />
                                        ) : (
                                            <span className={styles.stagePendingIcon}>2</span>
                                        )}
                                    </div>
                                    <div className={styles.stageInfo}>
                                        <div className={styles.stageTitle}>
                                            Stage 2: Building Your Schedule
                                        </div>
                                        <div className={styles.stageTime}>
                                            {currentStage === 2 ? (
                                                <>
                                                    <span className={styles.elapsed}>
                                                        {formatElapsedTime(elapsedTime)}
                                                    </span>
                                                    <span className={styles.estimated}>
                                                        / ~{estimatedMinutes} min
                                                    </span>
                                                </>
                                            ) : (
                                                <span className={styles.estimated}>~2.5 min</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {currentStage === 2 && (
                                    <div className={styles.stageProgressBar}>
                                        <div
                                            className={styles.stageProgressFill}
                                            style={{
                                                width: `${Math.min(
                                                    (elapsedTime / (estimatedMinutes * 60)) * 100,
                                                    95
                                                )}%`
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Current phase indicator */}
                        <div className={styles.currentPhase}>
                            {generationPhase === 'requirements' && 'Searching university catalog...'}
                            {generationPhase === 'building' && 'Analyzing prerequisites...'}
                            {generationPhase === 'validating' && 'Validating schedule...'}
                            {generationPhase === 'complete' && 'Complete!'}
                        </div>

                        <div className={styles.thoughtsContainer}>
                            <div className={styles.thoughtsHeader}>
                                <span className={styles.thoughtsDot} />
                                Agent Thinking
                            </div>
                            <div className={styles.thoughtsList} ref={thoughtsContainerRef}>
                                {thoughts.length === 0 ? (
                                    <div className={styles.thoughtItem}>
                                        <span className={styles.thoughtText}>Researching degree requirements from catalog...</span>
                                        <span className={styles.cursor}>▌</span>
                                    </div>
                                ) : (
                                    thoughts.map((thought, index) => (
                                        <div
                                            key={thought.id}
                                            className={`${styles.thoughtItem} ${thought.isComplete ? styles.thoughtComplete : styles.thoughtActive}`}
                                        >
                                            <span className={styles.thoughtNumber}>{index + 1}</span>
                                            <span className={styles.thoughtText}>
                                                {thought.text || 'Thinking...'}
                                                {!thought.isComplete && <span className={styles.cursor}>▌</span>}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
})

export default GeneratingStep
