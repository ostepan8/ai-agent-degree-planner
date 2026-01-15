import { z } from "zod";

// School schema
export const SchoolSchema = z.object({
  id: z.string().describe("Unique identifier for the school"),
  name: z.string().describe("Full name of the university"),
  shortName: z.string().optional().describe("Short name or abbreviation"),
  catalogUrl: z.string().url().describe("URL to the official course catalog"),
  location: z.string().optional().describe("City, State"),
});

export type School = z.infer<typeof SchoolSchema>;

export const SchoolSearchResultSchema = z.object({
  schools: z.array(SchoolSchema).describe("List of matching schools"),
});

export type SchoolSearchResult = z.infer<typeof SchoolSearchResultSchema>;

// ============================================
// STUDENT CONTEXT SCHEMA
// Comprehensive student academic context
// ============================================

export const StudyAbroadSchema = z.object({
  planned: z.boolean().describe("Whether study abroad is planned"),
  term: z
    .string()
    .optional()
    .describe('Term for study abroad, e.g. "Spring 2027"'),
});

export type StudyAbroad = z.infer<typeof StudyAbroadSchema>;

export const StudentContextSchema = z.object({
  major: z.string().describe("Primary major"),
  concentration: z
    .string()
    .optional()
    .describe(
      'Concentration within major, e.g. "Artificial Intelligence", "Systems"'
    ),
  minor: z
    .string()
    .optional()
    .describe('Minor field of study, e.g. "Mathematics", "Business"'),
  combinedMajor: z
    .string()
    .optional()
    .describe("Combined/dual major if pursuing two majors"),
  catalogYear: z
    .string()
    .optional()
    .describe('Catalog year for requirements, e.g. "2024-2025"'),
  honors: z.boolean().optional().describe("Whether enrolled in honors program"),
  studyAbroad: StudyAbroadSchema.optional().describe("Study abroad plans"),
});

export type StudentContext = z.infer<typeof StudentContextSchema>;

// ============================================
// STRICT SCHEDULE SCHEMAS
// These schemas enforce exact structure
// ============================================

// A single course in the schedule
// Can be either a required course (exact code) or an elective slot (code: "ELECTIVE")
export const ScheduleCourseSchema = z.object({
  code: z
    .string()
    .describe(
      'Course code from catalog (e.g. "CS 2500") OR "ELECTIVE" for elective slots'
    ),
  name: z
    .string()
    .describe(
      'Official course name OR elective type (e.g. "Science with Lab Elective", "CS Concentration Elective")'
    ),
  credits: z
    .number()
    .int()
    .min(1)
    .max(6)
    .describe("Credit hours as integer (1-6)"),
  options: z
    .string()
    .optional()
    .describe(
      "For electives: comma-separated list of example courses the student can choose from"
    ),
});

export type ScheduleCourse = z.infer<typeof ScheduleCourseSchema>;

// Semester status - whether the semester is already completed or planned
export const SemesterStatusSchema = z
  .enum(["completed", "planned"])
  .optional()
  .describe('Status of the semester: "completed" for past semesters from transcript, "planned" for AI-generated future semesters');

// An academic semester with courses
export const AcademicSemesterSchema = z.object({
  term: z.string().describe('Term in format "Season YYYY", e.g. "Fall 2025"'),
  type: z
    .literal("academic")
    .describe('Must be "academic" for course semesters'),
  courses: z
    .array(ScheduleCourseSchema)
    .min(1)
    .max(8)
    .describe("Array of 1-8 real courses with actual catalog codes and names"),
  totalCredits: z
    .number()
    .int()
    .min(1)
    .max(21)
    .describe("Sum of all course credits for this semester"),
  status: SemesterStatusSchema,
});

export type AcademicSemester = z.infer<typeof AcademicSemesterSchema>;

// A co-op semester
export const CoopSemesterSchema = z.object({
  term: z.string().describe('Term in format "Season YYYY", e.g. "Summer 2027"'),
  type: z.literal("coop").describe('Must be "coop" for co-op semesters'),
  coopNumber: z
    .number()
    .int()
    .min(1)
    .max(3)
    .describe("Co-op number: 1, 2, or 3"),
  status: SemesterStatusSchema,
});

export type CoopSemester = z.infer<typeof CoopSemesterSchema>;

// Union of semester types
export const SemesterSchema = z.discriminatedUnion("type", [
  AcademicSemesterSchema,
  CoopSemesterSchema,
]);

export type Semester = z.infer<typeof SemesterSchema>;

// The complete schedule plan - STRICT structure
export const SchedulePlanSchema = z.object({
  school: z.string().describe("Exact university name"),
  major: z.string().describe("Exact major/program name"),
  degree: z.string().describe('Degree type: "BS", "BA", "BFA", etc.'),
  startTerm: z.string().describe('Starting term in format "Season YYYY"'),
  graduationTerm: z
    .string()
    .describe('Expected graduation term in format "Season YYYY"'),
  totalCredits: z
    .number()
    .int()
    .min(100)
    .max(200)
    .describe("Total credits required for degree"),
  semesters: z
    .array(SemesterSchema)
    .min(1)
    .max(20)
    .describe(
      "REQUIRED: Complete array of ALL semesters with real courses. Must include every semester from start to graduation. Never use placeholder text."
    ),
  warnings: z
    .array(z.string())
    .describe(
      "Array of specific warnings about course availability or prerequisites"
    ),
  sourceUrl: z
    .string()
    .url()
    .describe("URL of the catalog page used as source"),
  studentContext: StudentContextSchema.optional().describe(
    "Comprehensive student academic context including concentration, minor, honors, etc."
  ),
  transferCredits: z
    .array(z.object({
      code: z.string().describe("Course code"),
      name: z.string().describe("Course name"),
      credits: z.number().describe("Credits earned"),
      grade: z.string().optional().describe("Grade received (e.g., 'T' for transfer)"),
    }))
    .optional()
    .describe("AP and transfer credits that count toward the degree but are not part of regular semesters"),
});

export type SchedulePlan = z.infer<typeof SchedulePlanSchema>;

// ============================================
// DEGREE REQUIREMENTS SCHEMAS
// ============================================

// Course schema
export const CourseSchema = z.object({
  code: z.string().describe("Course code (e.g., CS 2500)"),
  name: z.string().describe("Course name"),
  credits: z.number().describe("Number of credits"),
  description: z.string().optional().describe("Course description"),
  prerequisites: z
    .array(z.string())
    .optional()
    .describe("List of prerequisite course codes"),
});

export type Course = z.infer<typeof CourseSchema>;

// Requirement group schema
export const RequirementGroupSchema = z.object({
  name: z
    .string()
    .describe(
      "Name of the requirement group (e.g., Core Requirements, Electives)"
    ),
  type: z
    .enum(["all", "choose_n", "credits"])
    .describe(
      "Type: all = take all, choose_n = pick N, credits = need X credits"
    ),
  required: z
    .number()
    .optional()
    .describe("For choose_n: number to choose. For credits: credits needed"),
  courses: z.array(CourseSchema).describe("Courses in this group"),
});

export type RequirementGroup = z.infer<typeof RequirementGroupSchema>;

// Degree requirements schema
export const DegreeRequirementsSchema = z.object({
  school: z.string().describe("University name"),
  major: z.string().describe("Major/program name"),
  degree: z.string().describe("Degree type (e.g., BS, BA)"),
  totalCredits: z.number().describe("Total credits required for degree"),
  requirementGroups: z
    .array(RequirementGroupSchema)
    .describe("All requirement groups"),
  generalEducation: z
    .array(z.string())
    .optional()
    .describe("General education/NUpath requirements"),
  sourceUrl: z.string().url().describe("Source catalog URL"),
  notes: z
    .array(z.string())
    .optional()
    .describe("Additional notes or advisor recommendations"),
});

export type DegreeRequirements = z.infer<typeof DegreeRequirementsSchema>;

// ============================================
// COMPLETED COURSES & PREFERENCES
// ============================================

// Completed course schema (from transcript)
export const CompletedCourseSchema = z.object({
  code: z.string().describe("Course code"),
  name: z.string().describe("Course name"),
  credits: z.number().describe("Credits earned"),
  grade: z.string().describe("Grade received"),
  semester: z.string().describe("Semester taken"),
});

export type CompletedCourse = z.infer<typeof CompletedCourseSchema>;

// Preferences schema
export const PreferencesSchema = z.object({
  email: z.string().email().optional().describe("User's email address"),
  startingSemester: z.string().describe("When to start (e.g., Fall 2025)"),
  creditsPerSemester: z
    .enum(["light", "standard", "accelerated"])
    .describe("Credit load preference"),
  coopPlan: z
    .enum(["none", "one", "two", "three"])
    .describe("Number of co-ops"),
  additionalNotes: z.string().optional().describe("Any additional preferences"),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

// API request/response types
export interface GenerateScheduleRequest {
  school: School;
  major: string;
  completedCourses: CompletedCourse[];
  preferences: Preferences;
  isFreshman: boolean;
}

export interface SearchSchoolsRequest {
  query: string;
}

// ============================================
// TRANSCRIPT DATA STRUCTURES
// ============================================

// A completed semester from the transcript
export interface CompletedSemesterData {
  term: string;
  courses: CompletedCourse[];
  totalCredits: number;
}

// Structured transcript data with grouped semesters and separated transfer credits
export interface TranscriptData {
  completedSemesters: CompletedSemesterData[];
  transferCredits: CompletedCourse[];
  totalCompletedCredits: number;
  totalTransferCredits: number;
  lastCompletedTerm: string | null;
  nextSemester: string | null;
  // Number of completed co-op work experiences detected from transcript
  completedCoops: number;
}
