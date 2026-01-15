import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SchedulePlan, StudentContext } from './schemas';

// In-memory fallback store (for local development without Supabase)
interface StoredSchedule {
  schedule: SchedulePlan;
  expires: number;
  version: number;
  lastModified: number;
  lastUpdatedBy?: string;
}

const globalKey = '__scheduleStore__';

declare global {
  // eslint-disable-next-line no-var
  var __scheduleStore__: Map<string, StoredSchedule> | undefined;
}

function getSchedulesMap(): Map<string, StoredSchedule> {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new Map<string, StoredSchedule>();
    console.log('📦 Created in-memory schedule store (fallback mode)');
  }
  return globalThis[globalKey];
}

// Default TTL: 30 minutes
const DEFAULT_TTL_MS = 30 * 60 * 1000;

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
}

/**
 * Store a schedule with a given ID
 */
export async function storeSchedule(
  id: string, 
  schedule: SchedulePlan, 
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    
    const { error } = await supabase
      .from('schedules')
      .upsert({
        id,
        schedule,
        version: 1,
        expires_at: expiresAt,
        last_modified: new Date().toISOString(),
        last_updated_by: null,
      });
    
    if (error) {
      console.error('Supabase storeSchedule error:', error);
      throw new Error(`Failed to store schedule: ${error.message}`);
    }
    
    console.log(`📦 Stored schedule ${id} in Supabase`);
  } else {
    // Fallback to in-memory
    const schedules = getSchedulesMap();
    schedules.set(id, {
      schedule,
      expires: Date.now() + ttlMs,
      version: 1,
      lastModified: Date.now(),
    });
    console.log(`📦 Stored schedule ${id} in memory (Supabase not configured)`);
  }
}

/**
 * Get a schedule by ID, returns null if not found or expired
 */
export async function getSchedule(id: string): Promise<SchedulePlan | null> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    const { data, error } = await supabase
      .from('schedules')
      .select('schedule, expires_at')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      console.log(`📦 Schedule ${id} not found in Supabase`);
      return null;
    }
    
    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired schedule
      await supabase.from('schedules').delete().eq('id', id);
      console.log(`📦 Schedule ${id} expired, deleted from Supabase`);
      return null;
    }
    
    return data.schedule as SchedulePlan;
  } else {
    // Fallback to in-memory
    const schedules = getSchedulesMap();
    const stored = schedules.get(id);
    
    if (!stored) {
      console.log(`📦 Schedule ${id} not found in memory`);
      return null;
    }
    
    if (stored.expires < Date.now()) {
      schedules.delete(id);
      return null;
    }
    
    return stored.schedule;
  }
}

/**
 * Update an existing schedule, returns false if not found
 */
export async function updateSchedule(
  id: string, 
  schedule: SchedulePlan, 
  updatedBy?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    // First check if it exists
    const { data: existing } = await supabase
      .from('schedules')
      .select('version')
      .eq('id', id)
      .single();
    
    if (!existing) {
      console.log(`📦 Schedule ${id} not found for update`);
      return false;
    }
    
    const { error } = await supabase
      .from('schedules')
      .update({
        schedule,
        version: existing.version + 1,
        last_modified: new Date().toISOString(),
        last_updated_by: updatedBy || null,
      })
      .eq('id', id);
    
    if (error) {
      console.error('Supabase updateSchedule error:', error);
      return false;
    }
    
    console.log(`📦 Updated schedule ${id} to version ${existing.version + 1} by ${updatedBy || 'unknown'}`);
    return true;
  } else {
    // Fallback to in-memory
    const schedules = getSchedulesMap();
    const stored = schedules.get(id);
    
    if (!stored) {
      return false;
    }
    
    stored.schedule = schedule;
    stored.version++;
    stored.lastModified = Date.now();
    stored.lastUpdatedBy = updatedBy;
    console.log(`📦 Updated schedule ${id} to version ${stored.version} in memory`);
    return true;
  }
}

/**
 * Get info about the last update
 */
export async function getLastUpdate(id: string): Promise<{ version: number; tool: string } | null> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    const { data } = await supabase
      .from('schedules')
      .select('version, last_updated_by')
      .eq('id', id)
      .single();
    
    if (!data) return null;
    return { version: data.version, tool: data.last_updated_by || 'unknown' };
  } else {
    const schedules = getSchedulesMap();
    const stored = schedules.get(id);
    if (!stored) return null;
    return { version: stored.version, tool: stored.lastUpdatedBy || 'unknown' };
  }
}

/**
 * Get the version number for a schedule (for change detection)
 */
export async function getScheduleVersion(id: string): Promise<number> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    const { data } = await supabase
      .from('schedules')
      .select('version')
      .eq('id', id)
      .single();
    
    return data?.version || 0;
  } else {
    const schedules = getSchedulesMap();
    const stored = schedules.get(id);
    return stored?.version || 0;
  }
}

/**
 * Get schedule with metadata
 */
export async function getScheduleWithMeta(id: string): Promise<{ schedule: SchedulePlan; version: number } | null> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    const { data } = await supabase
      .from('schedules')
      .select('schedule, version, expires_at')
      .eq('id', id)
      .single();
    
    if (!data) return null;
    
    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      await supabase.from('schedules').delete().eq('id', id);
      return null;
    }
    
    return { schedule: data.schedule as SchedulePlan, version: data.version };
  } else {
    const schedules = getSchedulesMap();
    const stored = schedules.get(id);
    
    if (!stored) return null;
    
    if (stored.expires < Date.now()) {
      schedules.delete(id);
      return null;
    }
    
    return { schedule: stored.schedule, version: stored.version };
  }
}

/**
 * Get the student context from a stored schedule
 */
export async function getStudentContext(id: string): Promise<StudentContext | null> {
  const schedule = await getSchedule(id);
  
  if (!schedule) {
    return null;
  }
  
  if (schedule.studentContext) {
    return schedule.studentContext;
  }
  
  return {
    major: schedule.major,
  };
}

/**
 * Delete a schedule by ID
 */
export async function deleteSchedule(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    await supabase.from('schedules').delete().eq('id', id);
  } else {
    const schedules = getSchedulesMap();
    schedules.delete(id);
  }
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

/**
 * Check if Supabase storage is available
 */
export function isStorageConfigured(): boolean {
  return isSupabaseConfigured();
}
