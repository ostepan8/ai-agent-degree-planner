import type { SchedulePlan, StudentContext } from './schemas';

// In-memory schedule store with TTL
interface StoredSchedule {
  schedule: SchedulePlan;
  expires: number;
  version: number;  // Increments on each update
  lastModified: number;  // Timestamp of last modification
  lastUpdatedBy?: string;  // Which tool last updated this schedule
}

// Use globalThis to survive Next.js hot reloads in development
// This ensures the store persists when modules are recompiled
const globalKey = '__scheduleStore__';

// Extend globalThis type for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __scheduleStore__: Map<string, StoredSchedule> | undefined;
}

// Get or create the global schedules map
function getSchedulesMap(): Map<string, StoredSchedule> {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new Map<string, StoredSchedule>();
    console.log('📦 Created new global schedule store');
  }
  return globalThis[globalKey];
}

// Default TTL: 30 minutes
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * Store a schedule with a given ID
 */
export function storeSchedule(id: string, schedule: SchedulePlan, ttlMs: number = DEFAULT_TTL_MS): void {
  const schedules = getSchedulesMap();
  schedules.set(id, {
    schedule,
    expires: Date.now() + ttlMs,
    version: 1,
    lastModified: Date.now(),
  });
  console.log(`📦 Stored schedule ${id}, store size: ${schedules.size}`);
}

/**
 * Get a schedule by ID, returns null if not found or expired
 */
export function getSchedule(id: string): SchedulePlan | null {
  const schedules = getSchedulesMap();
  const stored = schedules.get(id);
  
  if (!stored) {
    console.log(`📦 Schedule ${id} not found, store size: ${schedules.size}`);
    return null;
  }
  
  // Check if expired
  if (stored.expires < Date.now()) {
    schedules.delete(id);
    return null;
  }
  
  return stored.schedule;
}

/**
 * Update an existing schedule, returns false if not found
 */
export function updateSchedule(id: string, schedule: SchedulePlan, updatedBy?: string): boolean {
  const schedules = getSchedulesMap();
  const stored = schedules.get(id);
  
  if (!stored) {
    return false;
  }
  
  // Update schedule, increment version, keep the same expiry
  stored.schedule = schedule;
  stored.version++;
  stored.lastModified = Date.now();
  stored.lastUpdatedBy = updatedBy;
  console.log(`📦 Updated schedule ${id} to version ${stored.version} by ${updatedBy || 'unknown'}`);
  return true;
}

/**
 * Get info about the last update
 */
export function getLastUpdate(id: string): { version: number; tool: string } | null {
  const schedules = getSchedulesMap();
  const stored = schedules.get(id);
  if (!stored) return null;
  return { version: stored.version, tool: stored.lastUpdatedBy || 'unknown' };
}

/**
 * Get the version number for a schedule (for change detection)
 */
export function getScheduleVersion(id: string): number {
  const schedules = getSchedulesMap();
  const stored = schedules.get(id);
  return stored?.version || 0;
}

/**
 * Get schedule with metadata
 */
export function getScheduleWithMeta(id: string): { schedule: SchedulePlan; version: number } | null {
  const schedules = getSchedulesMap();
  const stored = schedules.get(id);
  
  if (!stored) {
    return null;
  }
  
  // Check if expired
  if (stored.expires < Date.now()) {
    schedules.delete(id);
    return null;
  }
  
  return { schedule: stored.schedule, version: stored.version };
}

/**
 * Get the student context from a stored schedule
 * Returns the studentContext if available, otherwise constructs a minimal one from schedule fields
 */
export function getStudentContext(id: string): StudentContext | null {
  const schedule = getSchedule(id);
  
  if (!schedule) {
    return null;
  }
  
  // Return the stored studentContext if available
  if (schedule.studentContext) {
    return schedule.studentContext;
  }
  
  // Otherwise, construct a minimal context from the schedule's basic fields
  return {
    major: schedule.major,
    // Other fields are optional and not available without explicit studentContext
  };
}

/**
 * Delete a schedule by ID
 */
export function deleteSchedule(id: string): void {
  const schedules = getSchedulesMap();
  schedules.delete(id);
}

/**
 * Generate a unique schedule ID
 */
export function generateScheduleId(): string {
  return crypto.randomUUID();
}

/**
 * Helper to recalculate semester credits after modifications
 */
export function recalculateSemesterCredits(schedule: SchedulePlan): SchedulePlan {
  const updatedSemesters = schedule.semesters.map(semester => {
    if (semester.type === 'academic' && semester.courses) {
      const totalCredits = semester.courses.reduce((sum, course) => sum + course.credits, 0);
      return { ...semester, totalCredits };
    }
    return semester;
  });
  
  // Also recalculate total credits
  const totalCredits = updatedSemesters.reduce((sum, semester) => {
    if (semester.type === 'academic' && semester.totalCredits) {
      return sum + semester.totalCredits;
    }
    return sum;
  }, 0);
  
  return {
    ...schedule,
    semesters: updatedSemesters,
    totalCredits,
  };
}

