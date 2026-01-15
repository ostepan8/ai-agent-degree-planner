/**
 * Utility functions for semester date calculations.
 * Replaces hardcoded semester dates with dynamic calculations based on current date.
 */

type Season = 'Spring' | 'Summer' | 'Fall';

const SEASONS: Season[] = ['Spring', 'Summer', 'Fall'];

/**
 * Get the next available semester based on current date.
 * 
 * Registration typically opens:
 * - Spring: October-November for January start
 * - Summer: March-April for May start
 * - Fall: April-May for August start
 * 
 * We return the next semester that a student could reasonably register for.
 */
export function getNextAvailableSemester(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = January)
  const year = now.getFullYear();
  
  // Semester registration cutoffs (approximate):
  // Dec-Apr: Spring of current year is still available or just started
  // May-Jul: Summer or Fall of current year
  // Aug-Nov: Fall of current year or Spring of next year
  
  if (month <= 3) {
    // Jan-Apr: Spring semester just started or about to start
    return `Spring ${year}`;
  } else if (month <= 6) {
    // May-Jul: Summer or Fall
    return `Fall ${year}`;
  } else if (month <= 10) {
    // Aug-Nov: Fall just started, or register for Spring
    return `Spring ${year + 1}`;
  } else {
    // Dec: Register for Spring
    return `Spring ${year + 1}`;
  }
}

/**
 * Parse a semester string into its components.
 */
function parseSemester(semester: string): { season: Season; year: number } {
  const parts = semester.split(' ');
  const season = parts[0] as Season;
  const year = parseInt(parts[parts.length - 1]);
  return { season, year };
}

/**
 * Get the next semester after the given one.
 */
function getNextSemesterAfter(semester: string): string {
  const { season, year } = parseSemester(semester);
  const seasonIndex = SEASONS.indexOf(season);
  
  if (seasonIndex === SEASONS.length - 1) {
    // Fall -> Spring of next year
    return `Spring ${year + 1}`;
  } else {
    // Spring -> Summer, Summer -> Fall
    return `${SEASONS[seasonIndex + 1]} ${year}`;
  }
}

/**
 * Generate a list of semester options starting from the next available semester.
 * 
 * @param count - Number of semesters to generate (default: 8)
 * @returns Array of semester strings like ["Spring 2025", "Summer 2025", "Fall 2025", ...]
 */
export function generateSemesterOptions(count: number = 8): string[] {
  const options: string[] = [];
  let current = getNextAvailableSemester();
  
  for (let i = 0; i < count; i++) {
    options.push(current);
    current = getNextSemesterAfter(current);
  }
  
  return options;
}
