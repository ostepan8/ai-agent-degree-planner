'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import type { 
    School, 
    ExtendedSchedulePlan, 
    SemesterItem, 
    AcademicYearGroup,
    DragState,
    SemesterDragState,
    CourseDeleteState,
    ChatMessage,
    SchedulePlan,
} from './types'
import { isCoopSemester } from './types'
import styles from '../demo.module.css'

interface ScheduleStepProps {
    schedule: ExtendedSchedulePlan
    selectedSchool: School
    major: string
    onScheduleChange: (schedule: ExtendedSchedulePlan) => void
    onRegenerate: () => void
}

export const ScheduleStep = React.memo(function ScheduleStep({
    schedule,
    selectedSchool,
    major,
    onScheduleChange,
    onRegenerate,
}: ScheduleStepProps) {
    // Local UI state - doesn't trigger parent re-renders
    const [showAddTerm, setShowAddTerm] = useState(false)
    const [newTermSeason, setNewTermSeason] = useState<'Fall' | 'Spring' | 'Summer'>('Fall')
    const [newTermYear, setNewTermYear] = useState('2025')
    
    // Drag and drop state (courses)
    const [dragState, setDragState] = useState<DragState | null>(null)
    const [dropTargetSemester, setDropTargetSemester] = useState<string | null>(null)
    const dragDataRef = useRef<DragState | null>(null)
    const wasDraggingRef = useRef(false)
    
    // Semester drag and drop state
    const [semesterDragState, setSemesterDragState] = useState<SemesterDragState | null>(null)
    const [semesterDropTarget, setSemesterDropTarget] = useState<string | null>(null)
    const semesterDragDataRef = useRef<SemesterDragState | null>(null)
    
    // Delete confirmation state
    const [pendingDeletes, setPendingDeletes] = useState<CourseDeleteState>({})
    
    // Recently added courses for animation
    const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set())
    
    // Add course state
    const [addingToSemester, setAddingToSemester] = useState<string | null>(null)
    const [newCourseCode, setNewCourseCode] = useState('')
    const [newCourseName, setNewCourseName] = useState('')
    const [newCourseCredits, setNewCourseCredits] = useState('4')
    
    // Edit course state
    const [editingCourse, setEditingCourse] = useState<{ semester: string; index: number } | null>(null)
    const [editCourseCode, setEditCourseCode] = useState('')
    const [editCourseName, setEditCourseName] = useState('')
    const [editCourseCredits, setEditCourseCredits] = useState('4')
    
    // Selected course for detail modal
    const [selectedCourse, setSelectedCourse] = useState<{
        code: string
        name: string
        credits: number
        options?: string
        semester: string
    } | null>(null)

    // Chat state
    const [commandInput, setCommandInput] = useState('')
    const [isProcessingCommand, setIsProcessingCommand] = useState(false)
    const [commandError, setCommandError] = useState<string | null>(null)
    const [commandThoughts, setCommandThoughts] = useState<string[]>([])
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [expandedThoughts, setExpandedThoughts] = useState<Set<number>>(new Set())
    const [currentThought, setCurrentThought] = useState<string>('')
    const [webSearchEnabled, setWebSearchEnabled] = useState(false)
    const chatMessagesEndRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const commandInputRef = useRef<HTMLInputElement>(null)
    const chatMessageIdRef = useRef<number>(0)

    // Memoized yearGroups calculation
    const yearGroups = useMemo((): AcademicYearGroup[] => {
        if (!schedule) return []

        const semesters = schedule.semesters as SemesterItem[]

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

        return Array.from(academicYearGroups.entries())
            .sort(([a], [b]) => a - b)
            .map(([academicYear, sems]) => {
                const totalCredits = sems.reduce((sum, sem) => {
                    if (sem.type === 'academic' && sem.totalCredits) {
                        return sum + sem.totalCredits
                    }
                    return sum
                }, 0)

                const hasCoOp = sems.some(sem => isCoopSemester(sem))

                const yearIndex = academicYear - startYear
                let yearLabel = ''
                switch (yearIndex) {
                    case 0:
                        yearLabel = 'Year 1 - Freshman'
                        break
                    case 1:
                        yearLabel = 'Year 2 - Sophomore'
                        break
                    case 2:
                        yearLabel = 'Year 3 - Middler'
                        break
                    case 3:
                        yearLabel = 'Year 4 - Junior'
                        break
                    case 4:
                        yearLabel = 'Year 5 - Senior'
                        break
                    default:
                        yearLabel = `Year ${yearIndex + 1}`
                }

                return {
                    year: yearLabel,
                    academicYear: `${academicYear}-${academicYear + 1}`,
                    semesters: sems,
                    totalCredits,
                    hasCoOp,
                }
            })
    }, [schedule])

    // Helper function to get season icon
    const getSeasonIcon = useCallback((term: string) => {
        const termLower = term.toLowerCase()
        if (termLower.includes('fall')) return '🍂'
        if (termLower.includes('spring')) return '🌸'
        if (termLower.includes('summer')) return '☀️'
        return '📚'
    }, [])

    // Helper function to get semester class
    const getSemesterClass = useCallback((term: string) => {
        const termLower = term.toLowerCase()
        if (termLower.includes('fall')) return `${styles.semesterCard} ${styles.semesterFall}`
        if (termLower.includes('spring')) return `${styles.semesterCard} ${styles.semesterSpring}`
        if (termLower.includes('summer')) return `${styles.semesterCard} ${styles.semesterSummer}`
        return styles.semesterCard
    }, [])

    // Course drag handlers
    const handleDragStart = useCallback((
        e: React.DragEvent,
        course: { code: string; name: string; credits: number; options?: string },
        semesterTerm: string,
        courseIndex: number
    ) => {
        // Stop propagation to prevent semester drag from interfering
        e.stopPropagation()
        
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/course', course.code)

        // Create a small custom drag image for the course
        const dragImage = document.createElement('div')
        dragImage.textContent = `${course.code} (${course.credits}cr)`
        dragImage.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            padding: 6px 12px;
            background: rgba(30, 41, 59, 0.95);
            border: 1px solid rgba(52, 211, 153, 0.5);
            border-radius: 6px;
            color: white;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `
        document.body.appendChild(dragImage)
        e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2)
        
        // Clean up after a short delay
        setTimeout(() => {
            document.body.removeChild(dragImage)
        }, 0)

        dragDataRef.current = {
            courseCode: course.code,
            courseName: course.name,
            credits: course.credits,
            options: course.options,
            fromSemester: semesterTerm,
            fromIndex: courseIndex,
        }

        wasDraggingRef.current = true

        requestAnimationFrame(() => {
            setDragState(dragDataRef.current)
        })
    }, [])

    const handleDragEnd = useCallback(() => {
        setDragState(null)
        dragDataRef.current = null
        setDropTargetSemester(null)
        setTimeout(() => {
            wasDraggingRef.current = false
        }, 100)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, semesterTerm: string) => {
        if (!e.dataTransfer.types.includes('text/course')) {
            return
        }
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropTargetSemester(prev => prev !== semesterTerm ? semesterTerm : prev)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement
        const currentTarget = e.currentTarget as HTMLElement
        if (!currentTarget.contains(relatedTarget)) {
            setDropTargetSemester(null)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent, toSemesterTerm: string) => {
        if (!e.dataTransfer.types.includes('text/course')) {
            return
        }

        e.preventDefault()
        e.stopPropagation() // Prevent semester drop from also firing
        setDropTargetSemester(null)

        const currentDragData = dragState || dragDataRef.current

        if (!currentDragData || !schedule) {
            return
        }
        if (currentDragData.fromSemester === toSemesterTerm) {
            setDragState(null)
            dragDataRef.current = null
            return
        }

        const updatedSchedule = JSON.parse(JSON.stringify(schedule)) as SchedulePlan

        const fromSemester = updatedSchedule.semesters.find(s => s.term === currentDragData.fromSemester) as SemesterItem | undefined
        const toSemester = updatedSchedule.semesters.find(s => s.term === toSemesterTerm) as SemesterItem | undefined

        if (!fromSemester || !toSemester) {
            setDragState(null)
            dragDataRef.current = null
            return
        }

        if (isCoopSemester(fromSemester as SemesterItem) || isCoopSemester(toSemester as SemesterItem)) {
            setDragState(null)
            dragDataRef.current = null
            return
        }

        if (fromSemester.type !== 'academic' || toSemester.type !== 'academic') {
            setDragState(null)
            dragDataRef.current = null
            return
        }

        if (fromSemester.status === 'completed' || toSemester.status === 'completed') {
            setDragState(null)
            dragDataRef.current = null
            return
        }

        let courseToMove = fromSemester.courses?.[currentDragData.fromIndex]
        const courseIndex = currentDragData.fromIndex

        // Use index directly for identification (handles duplicate course codes like "ELECTIVE")
        if (!courseToMove || courseIndex < 0 || courseIndex >= (fromSemester.courses?.length ?? 0)) {
            setDragState(null)
            dragDataRef.current = null
            return
        }

        if (!courseToMove) {
            setDragState(null)
            dragDataRef.current = null
            return
        }

        fromSemester.courses?.splice(courseIndex, 1)

        if (!toSemester.courses) toSemester.courses = []
        toSemester.courses.push(courseToMove)

        fromSemester.totalCredits = fromSemester.courses?.reduce((sum, c) => sum + c.credits, 0) || 0
        toSemester.totalCredits = toSemester.courses.reduce((sum, c) => sum + c.credits, 0)
        updatedSchedule.totalCredits = updatedSchedule.semesters.reduce((sum, sem) => {
            if (sem.type === 'academic' && sem.totalCredits) return sum + sem.totalCredits
            return sum
        }, 0)

        const courseKey = `${toSemesterTerm}-${courseToMove.code}`
        setRecentlyAdded(prev => new Set(prev).add(courseKey))
        setTimeout(() => {
            setRecentlyAdded(prev => {
                const next = new Set(prev)
                next.delete(courseKey)
                return next
            })
        }, 600)

        onScheduleChange(updatedSchedule as ExtendedSchedulePlan)
        setDragState(null)
        dragDataRef.current = null
    }, [dragState, schedule, onScheduleChange])

    // Semester drag handlers
    const handleSemesterDragStart = useCallback((e: React.DragEvent, semester: SemesterItem) => {
        if (semester.status === 'completed') {
            e.preventDefault()
            return
        }

        // Stop propagation to prevent course drag from interfering
        e.stopPropagation()

        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/semester', semester.term)

        // Create a small custom drag image instead of using the whole card
        const dragImage = document.createElement('div')
        dragImage.textContent = semester.term
        dragImage.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            padding: 8px 16px;
            background: rgba(30, 41, 59, 0.95);
            border: 1px solid rgba(99, 102, 241, 0.5);
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `
        document.body.appendChild(dragImage)
        e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2)
        
        // Clean up after a short delay
        setTimeout(() => {
            document.body.removeChild(dragImage)
        }, 0)

        const semesterType = isCoopSemester(semester) ? 'coop' : 'academic'

        semesterDragDataRef.current = {
            term: semester.term,
            type: semesterType as 'academic' | 'coop',
        }

        requestAnimationFrame(() => {
            setSemesterDragState(semesterDragDataRef.current)
        })
    }, [])

    const handleSemesterDragEnd = useCallback(() => {
        setSemesterDragState(null)
        semesterDragDataRef.current = null
        setSemesterDropTarget(null)
    }, [])

    const handleSemesterDragOver = useCallback((e: React.DragEvent, semesterTerm: string, status?: 'completed' | 'planned') => {
        if (!e.dataTransfer.types.includes('text/semester')) {
            return
        }

        if (status === 'completed') {
            return
        }

        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'

        setSemesterDropTarget(prev => prev !== semesterTerm ? semesterTerm : prev)
    }, [])

    const handleSemesterDragLeave = useCallback((e: React.DragEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement
        const currentTarget = e.currentTarget as HTMLElement
        if (!currentTarget.contains(relatedTarget)) {
            setSemesterDropTarget(null)
        }
    }, [])

    const handleSemesterDrop = useCallback((e: React.DragEvent, toSemesterTerm: string, status?: 'completed' | 'planned') => {
        if (!e.dataTransfer.types.includes('text/semester')) {
            return
        }

        e.preventDefault()
        e.stopPropagation()
        setSemesterDropTarget(null)

        if (status === 'completed') {
            setSemesterDragState(null)
            semesterDragDataRef.current = null
            return
        }

        const currentDragData = semesterDragState || semesterDragDataRef.current

        if (!currentDragData || !schedule) {
            return
        }

        if (currentDragData.term === toSemesterTerm) {
            setSemesterDragState(null)
            semesterDragDataRef.current = null
            return
        }

        const updatedSchedule = JSON.parse(JSON.stringify(schedule)) as SchedulePlan

        const sem1Index = updatedSchedule.semesters.findIndex(s => s.term === currentDragData.term)
        const sem2Index = updatedSchedule.semesters.findIndex(s => s.term === toSemesterTerm)

        if (sem1Index === -1 || sem2Index === -1) {
            setSemesterDragState(null)
            semesterDragDataRef.current = null
            return
        }

        const sem1 = updatedSchedule.semesters[sem1Index] as SemesterItem
        const sem2 = updatedSchedule.semesters[sem2Index] as SemesterItem

        if (sem1.status === 'completed' || sem2.status === 'completed') {
            setSemesterDragState(null)
            semesterDragDataRef.current = null
            return
        }

        const sem1IsCoop = isCoopSemester(sem1)
        const sem2IsCoop = isCoopSemester(sem2)

        // Cast semesters array once for cleaner type handling
        const semesters = updatedSchedule.semesters as SemesterItem[]
        
        if (!sem1IsCoop && !sem2IsCoop) {
            // Swap academic semester contents (keep terms, swap courses)
            const sem1Courses = sem1.courses || []
            const sem2Courses = sem2.courses || []
            const sem1Credits = sem1.totalCredits || 0
            const sem2Credits = sem2.totalCredits || 0
            
            semesters[sem1Index] = {
                term: sem1.term, type: 'academic', courses: sem2Courses, totalCredits: sem2Credits, status: sem1.status
            }
            semesters[sem2Index] = {
                term: sem2.term, type: 'academic', courses: sem1Courses, totalCredits: sem1Credits, status: sem2.status
            }
        } else if (sem1IsCoop && sem2IsCoop) {
            // Swap co-op numbers
            semesters[sem1Index] = {
                term: sem1.term, type: 'coop', coopNumber: sem2.coopNumber, status: sem1.status
            }
            semesters[sem2Index] = {
                term: sem2.term, type: 'coop', coopNumber: sem1.coopNumber, status: sem2.status
            }
        } else if (!sem1IsCoop && sem2IsCoop) {
            // Swap academic and co-op
            semesters[sem1Index] = {
                term: sem1.term, type: 'coop', coopNumber: sem2.coopNumber, status: sem1.status
            }
            semesters[sem2Index] = {
                term: sem2.term, type: 'academic', courses: sem1.courses || [], totalCredits: sem1.totalCredits || 0, status: sem2.status
            }
        } else {
            // sem1IsCoop && !sem2IsCoop
            semesters[sem1Index] = {
                term: sem1.term, type: 'academic', courses: sem2.courses || [], totalCredits: sem2.totalCredits || 0, status: sem1.status
            }
            semesters[sem2Index] = {
                term: sem2.term, type: 'coop', coopNumber: sem1.coopNumber, status: sem2.status
            }
        }

        updatedSchedule.totalCredits = updatedSchedule.semesters.reduce((sum, sem) => {
            if (sem.type === 'academic' && 'totalCredits' in sem && sem.totalCredits) {
                return sum + sem.totalCredits
            }
            return sum
        }, 0)

        onScheduleChange(updatedSchedule as ExtendedSchedulePlan)
        setSemesterDragState(null)
        semesterDragDataRef.current = null
    }, [semesterDragState, schedule, onScheduleChange])

    // Delete handlers - use index for unique identification (handles duplicate course codes like "ELECTIVE")
    const handleDeleteClick = useCallback((semesterTerm: string, courseIndex: number) => {
        const key = `${semesterTerm}-${courseIndex}`
        setPendingDeletes(prev => {
            if (prev[key]) {
                // Confirm delete
                const updatedSchedule = JSON.parse(JSON.stringify(schedule)) as SchedulePlan
                const semester = updatedSchedule.semesters.find(s => s.term === semesterTerm)

                if (!semester || semester.type !== 'academic' || !semester.courses) {
                    return prev
                }

                if (courseIndex < 0 || courseIndex >= semester.courses.length) return prev

                semester.courses.splice(courseIndex, 1)
                semester.totalCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0)
                updatedSchedule.totalCredits = updatedSchedule.semesters.reduce((sum, sem) => {
                    if (sem.type === 'academic' && sem.totalCredits) return sum + sem.totalCredits
                    return sum
                }, 0)

                onScheduleChange(updatedSchedule as ExtendedSchedulePlan)

                const next = { ...prev }
                delete next[key]
                return next
            } else {
                // Mark as pending
                setTimeout(() => {
                    setPendingDeletes(p => {
                        const updated = { ...p }
                        delete updated[key]
                        return updated
                    })
                }, 3000)
                return { ...prev, [key]: true }
            }
        })
    }, [schedule, onScheduleChange])

    const cancelDelete = useCallback((semesterTerm: string, courseIndex: number) => {
        const key = `${semesterTerm}-${courseIndex}`
        setPendingDeletes(prev => {
            const next = { ...prev }
            delete next[key]
            return next
        })
    }, [])

    // Add course handlers
    const handleAddCourse = useCallback((semesterTerm: string) => {
        if (!schedule || !newCourseCode.trim() || !newCourseName.trim()) return

        const credits = parseInt(newCourseCredits) || 4
        const newCourse = {
            code: newCourseCode.trim().toUpperCase(),
            name: newCourseName.trim(),
            credits,
        }

        const updatedSchedule = JSON.parse(JSON.stringify(schedule)) as SchedulePlan
        const semester = updatedSchedule.semesters.find(s => s.term === semesterTerm)

        if (!semester || semester.type !== 'academic') return

        if (!semester.courses) semester.courses = []
        semester.courses.push(newCourse)
        semester.totalCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0)
        updatedSchedule.totalCredits = updatedSchedule.semesters.reduce((sum, sem) => {
            if (sem.type === 'academic' && sem.totalCredits) return sum + sem.totalCredits
            return sum
        }, 0)

        onScheduleChange(updatedSchedule as ExtendedSchedulePlan)

        const courseKey = `${semesterTerm}-${newCourse.code}`
        setRecentlyAdded(prev => new Set(prev).add(courseKey))
        setTimeout(() => {
            setRecentlyAdded(prev => {
                const next = new Set(prev)
                next.delete(courseKey)
                return next
            })
        }, 600)

        setNewCourseCode('')
        setNewCourseName('')
        setNewCourseCredits('4')
        setAddingToSemester(null)
    }, [schedule, newCourseCode, newCourseName, newCourseCredits, onScheduleChange])

    const cancelAddCourse = useCallback(() => {
        setAddingToSemester(null)
        setNewCourseCode('')
        setNewCourseName('')
        setNewCourseCredits('4')
    }, [])

    // Edit course handlers
    const startEditCourse = useCallback((semesterTerm: string, index: number, course: { code: string; name: string; credits: number }) => {
        setEditingCourse({ semester: semesterTerm, index })
        setEditCourseCode(course.code)
        setEditCourseName(course.name)
        setEditCourseCredits(String(course.credits))
    }, [])

    const cancelEditCourse = useCallback(() => {
        setEditingCourse(null)
        setEditCourseCode('')
        setEditCourseName('')
        setEditCourseCredits('4')
    }, [])

    const handleSaveEdit = useCallback(() => {
        if (!schedule || !editingCourse || !editCourseCode.trim() || !editCourseName.trim()) return

        const credits = parseInt(editCourseCredits) || 4
        const updatedSchedule = JSON.parse(JSON.stringify(schedule)) as SchedulePlan
        const semester = updatedSchedule.semesters.find(s => s.term === editingCourse.semester)

        if (!semester || semester.type !== 'academic' || !semester.courses) return

        semester.courses[editingCourse.index] = {
            code: editCourseCode.trim().toUpperCase(),
            name: editCourseName.trim(),
            credits,
        }

        semester.totalCredits = semester.courses.reduce((sum, c) => sum + c.credits, 0)
        updatedSchedule.totalCredits = updatedSchedule.semesters.reduce((sum, sem) => {
            if (sem.type === 'academic' && sem.totalCredits) return sum + sem.totalCredits
            return sum
        }, 0)

        onScheduleChange(updatedSchedule as ExtendedSchedulePlan)
        cancelEditCourse()
    }, [schedule, editingCourse, editCourseCode, editCourseName, editCourseCredits, onScheduleChange, cancelEditCourse])

    // Delete term handler
    const handleDeleteTerm = useCallback((termToDelete: string) => {
        if (!schedule) return

        const semester = schedule.semesters.find(s => s.term === termToDelete)
        if (semester && semester.type === 'academic' && semester.courses && semester.courses.length > 0) {
            if (!confirm(`Delete "${termToDelete}" and its ${semester.courses.length} courses?`)) {
                return
            }
        }

        const updatedSchedule = JSON.parse(JSON.stringify(schedule)) as SchedulePlan
        updatedSchedule.semesters = updatedSchedule.semesters.filter(s => s.term !== termToDelete)

        updatedSchedule.totalCredits = updatedSchedule.semesters.reduce((sum, sem) => {
            if (sem.type === 'academic' && sem.totalCredits) return sum + sem.totalCredits
            return sum
        }, 0)

        onScheduleChange(updatedSchedule as ExtendedSchedulePlan)
    }, [schedule, onScheduleChange])

    // Add term handler
    const handleAddTerm = useCallback(() => {
        if (!schedule) return

        const newTerm = `${newTermSeason} ${newTermYear}`

        if (schedule.semesters.some(s => s.term === newTerm)) {
            setCommandError(`Term "${newTerm}" already exists`)
            return
        }

        const updatedSchedule = JSON.parse(JSON.stringify(schedule)) as SchedulePlan

        const newSemester = {
            term: newTerm,
            type: 'academic' as const,
            courses: [],
            totalCredits: 0,
            status: 'planned' as const,
        }

        updatedSchedule.semesters.push(newSemester)

        // Sort semesters by date
        updatedSchedule.semesters.sort((a, b) => {
            const getOrder = (term: string) => {
                const yearMatch = term.match(/\d{4}/)
                const year = yearMatch ? parseInt(yearMatch[0]) : 0
                const termLower = term.toLowerCase()
                let seasonOrder = 0
                if (termLower.includes('spring')) seasonOrder = 1
                else if (termLower.includes('summer')) seasonOrder = 2
                else if (termLower.includes('fall')) seasonOrder = 3
                return year * 10 + seasonOrder
            }
            return getOrder(a.term) - getOrder(b.term)
        })

        onScheduleChange(updatedSchedule as ExtendedSchedulePlan)
        setShowAddTerm(false)
        setNewTermSeason('Fall')
        setNewTermYear('2025')
    }, [schedule, newTermSeason, newTermYear, onScheduleChange])

    // PDF save handler
    const handleSavePDF = useCallback(async () => {
        if (!schedule) return
        
        // Dynamic import for PDF generation
        const { default: jsPDF } = await import('jspdf')
        
        const doc = new jsPDF()
        
        // Add title
        doc.setFontSize(20)
        doc.text(`${schedule.degree} in ${schedule.major || major}`, 20, 20)
        
        doc.setFontSize(12)
        doc.text(`${selectedSchool?.name}`, 20, 30)
        doc.text(`${schedule.startTerm} - ${schedule.graduationTerm}`, 20, 40)
        
        let y = 60
        
        yearGroups.forEach((yearGroup) => {
            if (y > 250) {
                doc.addPage()
                y = 20
            }
            
            doc.setFontSize(14)
            doc.text(`${yearGroup.year} (${yearGroup.academicYear})`, 20, y)
            y += 10
            
            yearGroup.semesters.forEach((sem) => {
                if (isCoopSemester(sem)) {
                    doc.setFontSize(10)
                    doc.text(`${sem.term}: Co-op ${sem.coopNumber}`, 25, y)
                    y += 6
                } else if (sem.type === 'academic' && sem.courses) {
                    doc.setFontSize(10)
                    doc.text(`${sem.term} (${sem.totalCredits} credits)`, 25, y)
                    y += 6
                    
                    sem.courses.forEach((course) => {
                        doc.setFontSize(9)
                        doc.text(`  ${course.code} - ${course.name} (${course.credits} cr)`, 30, y)
                        y += 5
                    })
                }
                y += 4
            })
            y += 6
        })
        
        doc.save(`${schedule.major || major}_schedule.pdf`)
    }, [schedule, selectedSchool, major, yearGroups])

    // Scroll chat to bottom when messages change
    useEffect(() => {
        if (chatMessagesEndRef.current) {
            chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [chatMessages, isProcessingCommand])

    // Send message to the schedule assistant
    const handleSendMessage = useCallback(async () => {
        const message = commandInput.trim()
        if (!message || isProcessingCommand || !schedule) return

        // Clear input and set processing state
        setCommandInput('')
        setIsProcessingCommand(true)
        setCommandError(null)
        setCommandThoughts([])
        setCurrentThought('')

        // Add user message to chat
        const userMessageId = chatMessageIdRef.current++
        setChatMessages(prev => [...prev, {
            id: userMessageId,
            role: 'user',
            content: message,
            timestamp: new Date(),
        }])

        // Cancel any previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        try {
            const response = await fetch('/api/schedule/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentSchedule: schedule,
                    editRequest: message,
                    webSearchEnabled,
                }),
                signal: abortControllerRef.current.signal,
            })

            if (!response.ok) {
                throw new Error('Failed to process request')
            }

            const reader = response.body?.getReader()
            if (!reader) {
                throw new Error('No response stream available')
            }

            const decoder = new TextDecoder()
            let buffer = ''
            const thoughts: string[] = []

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))

                            switch (data.type) {
                                case 'thought':
                                    if (data.thought) {
                                        thoughts.push(data.thought)
                                        setCommandThoughts([...thoughts])
                                        setCurrentThought(data.thought)
                                    }
                                    break

                                case 'tool_call':
                                    // Show tool calls as thoughts
                                    if (data.tool) {
                                        const toolThought = `Using ${data.tool}...`
                                        thoughts.push(toolThought)
                                        setCommandThoughts([...thoughts])
                                        setCurrentThought(toolThought)
                                    }
                                    break

                                case 'tool_result':
                                    // Update schedule when tool makes changes
                                    if (data.schedule) {
                                        onScheduleChange(data.schedule as ExtendedSchedulePlan)
                                    }
                                    break

                                case 'complete':
                                    // Update schedule with final result
                                    if (data.schedule) {
                                        onScheduleChange(data.schedule as ExtendedSchedulePlan)
                                    }
                                    
                                    // Add assistant message to chat
                                    const assistantMessageId = chatMessageIdRef.current++
                                    setChatMessages(prev => [...prev, {
                                        id: assistantMessageId,
                                        role: 'assistant',
                                        content: data.message || 'Done!',
                                        timestamp: new Date(),
                                        thoughts: thoughts.length > 0 ? [...thoughts] : undefined,
                                    }])
                                    break

                                case 'error':
                                    throw new Error(data.message || 'Unknown error')
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
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                // Request was cancelled, ignore
                return
            }
            console.error('Chat error:', error)
            setCommandError(error instanceof Error ? error.message : 'Failed to process request')
        } finally {
            setIsProcessingCommand(false)
            setCurrentThought('')
            abortControllerRef.current = null
        }
    }, [commandInput, isProcessingCommand, schedule, webSearchEnabled, onScheduleChange])

    // The component is very large, so we return the JSX in a simpler format
    // In a real implementation, you might want to split this into sub-components
    
    return (
        <div className={styles.splitLayout}>
            {/* Left Panel - Schedule */}
            <div className={styles.schedulePanel}>
                {/* Schedule Header */}
                <div className={styles.scheduleHeader}>
                    <div>
                        <h1 className={styles.scheduleTitle}>
                            Your {yearGroups.length}-Year Plan
                        </h1>
                        <p className={styles.scheduleSubtitle}>
                            {schedule.degree} in {schedule.major || major} • {selectedSchool?.name}
                        </p>
                    </div>
                    <div className={styles.scheduleActions}>
                        <button className={styles.regenerateButton} onClick={onRegenerate}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            Regenerate
                        </button>
                        <button className={styles.savePdfButton} onClick={handleSavePDF}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            Save as PDF
                        </button>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className={styles.scheduleSummary}>
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

                {/* Transfer Credits */}
                {schedule.transferCredits && schedule.transferCredits.length > 0 && (
                    <div className={styles.transferCreditsSection}>
                        <div className={styles.transferCreditsHeader}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <h3>AP & Transfer Credits</h3>
                            <span className={styles.transferCreditsTotal}>
                                {schedule.transferCredits.reduce((sum, c) => sum + c.credits, 0)} credits
                            </span>
                        </div>
                        <div className={styles.transferCreditsGrid}>
                            {schedule.transferCredits.map((course, index) => (
                                <div key={index} className={styles.transferCourseItem}>
                                    <span className={styles.transferCourseCode}>{course.code}</span>
                                    <span className={styles.transferCourseName}>{course.name}</span>
                                    <span className={styles.transferCourseCredits}>{course.credits} cr</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add Term Button */}
                <div className={styles.addTermSection}>
                    {showAddTerm ? (
                        <div className={styles.addTermForm}>
                            <select
                                value={newTermSeason}
                                onChange={(e) => setNewTermSeason(e.target.value as 'Fall' | 'Spring' | 'Summer')}
                                className={styles.addTermSelect}
                            >
                                <option value="Fall">Fall</option>
                                <option value="Spring">Spring</option>
                                <option value="Summer">Summer</option>
                            </select>
                            <input
                                type="text"
                                value={newTermYear}
                                onChange={(e) => setNewTermYear(e.target.value)}
                                placeholder="Year"
                                className={styles.addTermInput}
                            />
                            <button onClick={handleAddTerm} className={styles.addTermConfirm}>
                                Add
                            </button>
                            <button onClick={() => setShowAddTerm(false)} className={styles.addTermCancel}>
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setShowAddTerm(true)} className={styles.addTermButton}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Term
                        </button>
                    )}
                </div>

                {/* Year-Based Schedule Layout */}
                <div className={styles.yearRows}>
                    {yearGroups.map((yearGroup) => (
                        <div key={yearGroup.academicYear} className={styles.yearRow}>
                            <div className={styles.yearRowHeader}>
                                <div className={styles.yearRowTitle}>
                                    <h3>{yearGroup.year}</h3>
                                    <span>{yearGroup.academicYear}</span>
                                </div>
                                <div className={styles.yearRowMeta}>
                                    {yearGroup.hasCoOp && (
                                        <span className={styles.yearRowCoopBadge}>Co-op</span>
                                    )}
                                    <span className={styles.yearRowCredits}>
                                        {yearGroup.totalCredits} credits
                                    </span>
                                </div>
                            </div>
                            <div className={styles.yearRowSemesters}>
                                {yearGroup.semesters.map((sem, semIndex) => (
                                    isCoopSemester(sem) ? (
                                        <div
                                            key={semIndex}
                                            className={`${styles.coopCard} ${semesterDropTarget === sem.term ? styles.semesterSwapTarget : ''} ${sem.status === 'completed' ? styles.semesterCompleted : ''} ${semesterDragState?.term === sem.term ? styles.semesterDragging : ''}`}
                                            draggable={sem.status !== 'completed'}
                                            onDragStart={sem.status !== 'completed' ? (e) => handleSemesterDragStart(e, sem) : undefined}
                                            onDragEnd={sem.status !== 'completed' ? handleSemesterDragEnd : undefined}
                                            onDragOver={sem.status !== 'completed' ? (e) => handleSemesterDragOver(e, sem.term, sem.status) : undefined}
                                            onDragLeave={sem.status !== 'completed' ? handleSemesterDragLeave : undefined}
                                            onDrop={sem.status !== 'completed' ? (e) => handleSemesterDrop(e, sem.term, sem.status) : undefined}
                                        >
                                            {sem.status !== 'completed' && (
                                                <button
                                                    className={styles.termDeleteButton}
                                                    onClick={() => handleDeleteTerm(sem.term)}
                                                    title="Delete term"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="18" y1="6" x2="6" y2="18" />
                                                        <line x1="6" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                </button>
                                            )}
                                            <div className={styles.semesterHeader}>
                                                <span className={styles.semesterIcon}>💼</span>
                                                <h4 className={styles.coopTitle}>{sem.term}</h4>
                                            </div>
                                            <div className={styles.coopBadge}>
                                                Co-op {sem.coopNumber}
                                            </div>
                                            <p className={styles.coopDescription}>
                                                Full-time work experience
                                            </p>
                                        </div>
                                    ) : (
                                        <div
                                            key={semIndex}
                                            className={`${getSemesterClass(sem.term)} ${dropTargetSemester === sem.term ? styles.semesterDropTarget : ''} ${semesterDropTarget === sem.term ? styles.semesterSwapTarget : ''} ${sem.status === 'completed' ? styles.semesterCompleted : ''} ${semesterDragState?.term === sem.term ? styles.semesterDragging : ''}`}
                                            draggable={sem.status !== 'completed'}
                                            onDragStart={sem.status !== 'completed' ? (e) => handleSemesterDragStart(e, sem) : undefined}
                                            onDragEnd={sem.status !== 'completed' ? handleSemesterDragEnd : undefined}
                                            onDragOver={sem.status !== 'completed' ? (e) => {
                                                handleDragOver(e, sem.term)
                                                handleSemesterDragOver(e, sem.term, sem.status)
                                            } : undefined}
                                            onDragLeave={sem.status !== 'completed' ? (e) => {
                                                handleDragLeave(e)
                                                handleSemesterDragLeave(e)
                                            } : undefined}
                                            onDrop={sem.status !== 'completed' ? (e) => {
                                                handleDrop(e, sem.term)
                                                handleSemesterDrop(e, sem.term, sem.status)
                                            } : undefined}
                                        >
                                            {sem.status !== 'completed' && (
                                                <button
                                                    className={styles.termDeleteButton}
                                                    onClick={() => handleDeleteTerm(sem.term)}
                                                    title="Delete term"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="18" y1="6" x2="6" y2="18" />
                                                        <line x1="6" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                </button>
                                            )}
                                            <div className={styles.semesterHeader}>
                                                <span className={styles.semesterIcon}>{getSeasonIcon(sem.term)}</span>
                                                <h4 className={styles.semesterTitle}>{sem.term}</h4>
                                                {sem.status === 'completed' && (
                                                    <span className={styles.completedBadge}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                        Completed
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.semesterCourses}>
                                                {sem.courses?.map((course, i) => {
                                                    // Use index for unique identification (handles duplicate course codes like "ELECTIVE")
                                                    const courseKey = `${sem.term}-${i}`
                                                    const isPendingDelete = pendingDeletes[courseKey]
                                                    const isRecentlyAdded = recentlyAdded.has(`${sem.term}-${course.code}`)
                                                    const isDragging = dragState?.fromSemester === sem.term && dragState?.fromIndex === i
                                                    const isCompleted = sem.status === 'completed'
                                                    const isEditing = editingCourse?.semester === sem.term && editingCourse?.index === i

                                                    if (isEditing && !isCompleted) {
                                                        return (
                                                            <div key={i} className={styles.editCourseForm}>
                                                                <div className={styles.editCourseRow}>
                                                                    <input
                                                                        type="text"
                                                                        value={editCourseCode}
                                                                        onChange={(e) => setEditCourseCode(e.target.value)}
                                                                        placeholder="CS 1234"
                                                                        className={styles.editCourseInput}
                                                                        autoFocus
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        value={editCourseCredits}
                                                                        onChange={(e) => setEditCourseCredits(e.target.value)}
                                                                        placeholder="4"
                                                                        className={`${styles.editCourseInput} ${styles.editCourseInputSmall}`}
                                                                        min="1"
                                                                        max="6"
                                                                    />
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={editCourseName}
                                                                    onChange={(e) => setEditCourseName(e.target.value)}
                                                                    placeholder="Course Name"
                                                                    className={styles.editCourseInput}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveEdit()
                                                                        if (e.key === 'Escape') cancelEditCourse()
                                                                    }}
                                                                />
                                                                <div className={styles.editCourseActions}>
                                                                    <button className={styles.editCourseCancel} onClick={cancelEditCourse}>
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        className={styles.editCourseSave}
                                                                        onClick={handleSaveEdit}
                                                                        disabled={!editCourseCode.trim() || !editCourseName.trim()}
                                                                    >
                                                                        Save
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )
                                                    }

                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`${styles.courseItem} ${!isCompleted ? styles.courseItemDraggable : styles.courseItemCompleted} ${isPendingDelete ? styles.courseItemPendingDelete : ''} ${isRecentlyAdded ? styles.courseItemAdded : ''} ${isDragging ? styles.courseItemDragging : ''}`}
                                                            draggable={!isCompleted}
                                                            onDragStart={!isCompleted ? (e) => handleDragStart(e, course, sem.term, i) : undefined}
                                                            onDragEnd={!isCompleted ? handleDragEnd : undefined}
                                                        >
                                                            <div className={styles.courseHeader}>
                                                                {!isCompleted && (
                                                                    <div className={styles.dragHandle}>
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                                            <circle cx="9" cy="5" r="2" />
                                                                            <circle cx="15" cy="5" r="2" />
                                                                            <circle cx="9" cy="12" r="2" />
                                                                            <circle cx="15" cy="12" r="2" />
                                                                            <circle cx="9" cy="19" r="2" />
                                                                            <circle cx="15" cy="19" r="2" />
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                                <span className={styles.courseCode}>{course.code}</span>
                                                                <span className={styles.courseCredits}>{course.credits}cr</span>
                                                            </div>
                                                            {course.options && !isCompleted && (
                                                                <button
                                                                    className={styles.infoButton}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setSelectedCourse({ ...course, semester: sem.term })
                                                                    }}
                                                                    title="View course options"
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <circle cx="12" cy="12" r="10" />
                                                                        <line x1="12" y1="16" x2="12" y2="12" />
                                                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {!isCompleted && (
                                                                <button
                                                                    className={styles.editButton}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        startEditCourse(sem.term, i, course)
                                                                    }}
                                                                    title="Edit course"
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {!isCompleted && (
                                                                <button
                                                                    className={`${styles.deleteButton} ${isPendingDelete ? styles.deleteButtonConfirm : ''}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleDeleteClick(sem.term, i)
                                                                    }}
                                                                    title={isPendingDelete ? "Click again to confirm delete" : "Remove course"}
                                                                >
                                                                    {isPendingDelete ? (
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                            <polyline points="20 6 9 17 4 12" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <line x1="18" y1="6" x2="6" y2="18" />
                                                                            <line x1="6" y1="6" x2="18" y2="18" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                            )}
                                                            <span className={styles.courseName}>{course.name}</span>
                                                            {course.options && !isCompleted && !editingCourse && (
                                                                <span className={styles.courseOptions}>Options: {course.options}</span>
                                                            )}
                                                            {isPendingDelete && !isCompleted && (
                                                                <div className={styles.deleteConfirmHint}>
                                                                    Click ✓ to confirm • <button onClick={(e) => { e.stopPropagation(); cancelDelete(sem.term, i) }}>Cancel</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Drop zone hint */}
                                            {dragState && dragState.fromSemester !== sem.term && sem.status !== 'completed' && (
                                                <div className={styles.dropZoneHint}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="12" y1="5" x2="12" y2="19" />
                                                        <line x1="5" y1="12" x2="19" y2="12" />
                                                    </svg>
                                                    Drop here
                                                </div>
                                            )}

                                            {/* Add Course */}
                                            {sem.status !== 'completed' && addingToSemester === sem.term ? (
                                                <div className={styles.addCourseForm}>
                                                    <div className={styles.addCourseRow}>
                                                        <input
                                                            type="text"
                                                            value={newCourseCode}
                                                            onChange={(e) => setNewCourseCode(e.target.value)}
                                                            placeholder="CS 1234"
                                                            className={styles.addCourseInput}
                                                            autoFocus
                                                        />
                                                        <input
                                                            type="number"
                                                            value={newCourseCredits}
                                                            onChange={(e) => setNewCourseCredits(e.target.value)}
                                                            placeholder="4"
                                                            className={`${styles.addCourseInput} ${styles.addCourseInputSmall}`}
                                                            min="1"
                                                            max="6"
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={newCourseName}
                                                        onChange={(e) => setNewCourseName(e.target.value)}
                                                        placeholder="Course Name"
                                                        className={styles.addCourseInput}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleAddCourse(sem.term)
                                                            if (e.key === 'Escape') cancelAddCourse()
                                                        }}
                                                    />
                                                    <div className={styles.addCourseActions}>
                                                        <button className={styles.addCourseCancel} onClick={cancelAddCourse}>
                                                            Cancel
                                                        </button>
                                                        <button
                                                            className={styles.addCourseConfirm}
                                                            onClick={() => handleAddCourse(sem.term)}
                                                            disabled={!newCourseCode.trim() || !newCourseName.trim()}
                                                        >
                                                            Add Course
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : sem.status !== 'completed' ? (
                                                <button
                                                    className={styles.addCourseButton}
                                                    onClick={() => setAddingToSemester(sem.term)}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="12" y1="5" x2="12" y2="19" />
                                                        <line x1="5" y1="12" x2="19" y2="12" />
                                                    </svg>
                                                    Add Course
                                                </button>
                                            ) : null}

                                            <div className={styles.semesterFooter}>
                                                <span className={styles.semesterCredits}>{sem.totalCredits} credits</span>
                                                <span className={styles.courseCount}>{sem.courses?.length || 0} courses</span>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Warnings */}
                {schedule.warnings && schedule.warnings.length > 0 && (
                    <div className={styles.warningsBox}>
                        <h4>Important Notes</h4>
                        <ul>
                            {(Array.isArray(schedule.warnings) ? schedule.warnings : [schedule.warnings]).map((warning, i) => (
                                <li key={i}>{warning}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Source Note */}
                {schedule.sourceUrl && (
                    <p className={styles.sourceNote}>
                        <strong>Source:</strong>{' '}
                        <a href={schedule.sourceUrl} target="_blank" rel="noopener noreferrer">
                            {schedule.sourceUrl}
                        </a>
                    </p>
                )}

                <p className={styles.advisorNote}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    This is a suggested plan based on catalog requirements. Course availability varies by semester.
                    Always verify with your academic advisor and check for registration.
                </p>
            </div>

            {/* Right Panel - Chat (placeholder for now - can be extracted to its own component) */}
            <div className={styles.chatPanel}>
                <div className={styles.chatHeader}>
                    <div className={styles.chatHeaderIcon}>
                        <Image
                            src="/Subconscious_Logo_Graphic.png"
                            alt=""
                            width={24}
                            height={24}
                        />
                    </div>
                    <span>Schedule Assistant</span>
                </div>
                <div className={styles.chatMessages}>
                    {chatMessages.length === 0 ? (
                        <div className={styles.chatWelcome}>
                            <div className={styles.chatWelcomeIcon}>
                                <Image
                                    src="/Subconscious_Logo_Graphic.png"
                                    alt=""
                                    width={48}
                                    height={48}
                                />
                            </div>
                            <h3>How can I help?</h3>
                            <p>Ask me to modify your schedule. I can move courses, add requirements, swap semesters, and more.</p>
                            <div className={styles.chatSuggestions}>
                                <button onClick={() => setCommandInput('Move CS 3500 to Spring 2027')}>
                                    Move CS 3500 to Spring 2027
                                </button>
                                <button onClick={() => setCommandInput('Add a minor in Mathematics')}>
                                    Add a minor in Mathematics
                                </button>
                                <button onClick={() => setCommandInput('Reduce my credit load in Year 2')}>
                                    Reduce my credit load in Year 2
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {chatMessages.map((msg) => (
                                <div 
                                    key={msg.id} 
                                    className={`${styles.chatMessage} ${msg.role === 'user' ? styles.chatMessageUser : styles.chatMessageAssistant}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className={styles.chatMessageIcon}>
                                            <Image
                                                src="/Subconscious_Logo_Graphic.png"
                                                alt=""
                                                width={24}
                                                height={24}
                                            />
                                        </div>
                                    )}
                                    <div className={styles.chatMessageContent}>
                                        <p>{msg.content}</p>
                                        {msg.thoughts && msg.thoughts.length > 0 && (
                                            <button
                                                className={styles.thoughtsToggle}
                                                onClick={() => setExpandedThoughts(prev => {
                                                    const next = new Set(prev)
                                                    if (next.has(msg.id)) {
                                                        next.delete(msg.id)
                                                    } else {
                                                        next.add(msg.id)
                                                    }
                                                    return next
                                                })}
                                            >
                                                {expandedThoughts.has(msg.id) ? 'Hide' : 'Show'} thinking ({msg.thoughts.length})
                                            </button>
                                        )}
                                        {msg.thoughts && expandedThoughts.has(msg.id) && (
                                            <div className={styles.thoughtsExpanded}>
                                                {msg.thoughts.map((thought, i) => (
                                                    <div key={i} className={styles.thoughtItem}>{thought}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                    
                    {/* Show current thinking state */}
                    {isProcessingCommand && (
                        <div className={`${styles.chatMessage} ${styles.chatMessageAssistant}`}>
                            <div className={styles.chatMessageIcon}>
                                <Image
                                    src="/Subconscious_Logo_Graphic.png"
                                    alt=""
                                    width={24}
                                    height={24}
                                />
                            </div>
                            <div className={styles.chatMessageContent}>
                                <div className={styles.thinkingIndicator}>
                                    <span className={styles.thinkingDot}></span>
                                    <span className={styles.thinkingDot}></span>
                                    <span className={styles.thinkingDot}></span>
                                </div>
                                {currentThought && (
                                    <div className={styles.currentThought}>{currentThought}</div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <div ref={chatMessagesEndRef} />
                </div>
                <div className={styles.chatInputArea}>
                    {commandError && (
                        <div className={styles.chatError}>
                            {commandError}
                            <button onClick={() => setCommandError(null)}>×</button>
                        </div>
                    )}
                    <div className={styles.chatInputWrapper}>
                        <button
                            className={`${styles.webSearchToggle} ${webSearchEnabled ? styles.webSearchToggleActive : ''}`}
                            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                            disabled={isProcessingCommand}
                            title={webSearchEnabled ? "Web search enabled" : "Enable web search"}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                        </button>
                        <input
                            ref={commandInputRef}
                            type="text"
                            value={commandInput}
                            onChange={(e) => setCommandInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && commandInput.trim()) {
                                    e.preventDefault()
                                    handleSendMessage()
                                }
                            }}
                            placeholder={webSearchEnabled ? "Search the web to modify your schedule..." : "Ask to modify your schedule..."}
                            className={styles.chatInput}
                            disabled={isProcessingCommand}
                        />
                        <button
                            className={styles.chatSendButton}
                            onClick={handleSendMessage}
                            disabled={!commandInput.trim() || isProcessingCommand}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Course Detail Modal */}
            {selectedCourse && (
                <div className={styles.courseModal} onClick={() => setSelectedCourse(null)}>
                    <div className={styles.courseModalContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.courseModalClose} onClick={() => setSelectedCourse(null)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <div className={styles.courseModalHeader}>
                            <span className={styles.courseModalCode}>{selectedCourse.code}</span>
                            <span className={styles.courseModalCredits}>{selectedCourse.credits} credits</span>
                        </div>
                        <h3 className={styles.courseModalName}>{selectedCourse.name}</h3>
                        <div className={styles.courseModalMeta}>
                            <span className={styles.courseModalSemester}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                {selectedCourse.semester}
                            </span>
                        </div>
                        {selectedCourse.options && (
                            <div className={styles.courseModalOptions}>
                                <h4>Course Options</h4>
                                <p>{selectedCourse.options}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
})

export default ScheduleStep
