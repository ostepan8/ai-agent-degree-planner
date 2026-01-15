# AI Degree Planner

A demo showcasing the [Subconscious Agent SDK](https://github.com/subconscious-systems/subconscious-python) for building 4-year degree plans from live university catalogs.

## The Approach

This project does not scrape or pre-ingest catalog data.

Instead:
- Every piece of academic information comes from live search
- The AI agent is responsible for discovering and grounding facts
- The backend validates and reasons over the agent's output

This avoids brittle scrapers, stale data, and year-over-year maintenance.

## How It Works

1. Choose your school and major
2. Upload a transcript (optional) or start as a freshman
3. Agent searches official university catalogs for requirements
4. Review extracted courses and set preferences
5. AI builds a semester-by-semester plan

## Supported Schools

The demo includes pre-configured support for Boston-area universities including Northeastern, MIT, Harvard, Boston University, Boston College, Tufts, Brandeis, and others. These schools have been tested and work well out of the box.

The agent can work with any US university, but results are better when the school is pre-configured with its catalog URL and any curriculum-specific context.

### Adding or Customizing Schools

To add a new school or improve results for an existing one, edit these files:

**1. `constants/schools.ts`**

Add your school to the `popularSchools` array:

```typescript
{
  id: 'your-school',
  name: 'Your University',
  shortName: 'YU',
  catalogUrl: 'https://catalog.youruniversity.edu',
  location: 'City, State',
}
```

**2. `lib/generate_prompt.js`**

Add school-specific curriculum notes to help the AI avoid outdated course codes or understand unique requirements:

```javascript
const SCHOOL_CURRICULUM_NOTES = {
  'your-school': `
    # Important notes about Your University
    
    - Course codes follow the format DEPT 1234
    - The CS program requires a senior capstone
    - MATH 101 was replaced by MATH 110 in Fall 2024
  `,
  // ... other schools
};
```

These notes are injected into the AI prompt and help the agent produce more accurate schedules.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Subconscious API key ([get one here](https://subconscious.dev))

### Installation

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and click "Try the Demo"

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Required: Your Subconscious API key
SUBCONSCIOUS_API_KEY=your-api-key

# Optional: Supabase for user tracking
# If not configured, user logs will be printed to console instead
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Setup (Optional)

To enable user tracking:

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Table Editor and create a table named `user_logs`
4. Add these columns:
   - `id` (int8, primary key, auto-generated)
   - `created_at` (timestamptz, default: now())
   - `email` (text, nullable)
   - `school` (text, nullable)
   - `major` (text, nullable)
   - `starting_semester` (text, nullable)
   - `credits_per_semester` (text, nullable)
   - `coop_plan` (text, nullable)
   - `is_freshman` (bool)
   - `completed_courses_count` (int4)
   - `notes` (text, nullable)
5. Go to Settings, then API, and copy your Project URL and anon key
6. Add the environment variables above

## Subconscious SDK

This project uses the [Subconscious SDK](https://github.com/subconscious-systems/subconscious-python) for AI agent capabilities:

```javascript
import { Subconscious } from 'subconscious';

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY,
});

const run = await client.run({
  engine: 'tim-large',
  input: {
    instructions: 'Search university catalog for CS degree requirements',
    tools: [{ type: 'platform', id: 'parallel_search' }],
  },
  options: { awaitCompletion: true },
});

console.log(run.result?.answer);
```

## Project Structure

```
constants/
  schools.ts          # Pre-configured school list with catalog URLs

lib/
  generate_prompt.js  # Schedule generation prompts and school-specific notes
  completion_prompt.js # Prompts for students with existing transcripts
  validateSchedule.ts # Post-processing validation and cleanup
  transcript/         # Transcript parsing utilities

app/
  api/                # Next.js API routes
  demo/               # Main demo UI components
```

## Scope

This is a demo application. It is not a replacement for academic advising.

What it does:
- Searches live university catalogs via AI agents
- Generates multi-year degree plans
- Supports co-op programs and transfer credits
- Allows interactive schedule editing

What it does not do:
- Guarantee course availability or seat counts
- Replace official degree audits
- Provide enrollment or registration

## Resources

- [Subconscious Documentation](https://docs.subconscious.dev)
- [JavaScript SDK](https://www.npmjs.com/package/subconscious)
- [API Reference](https://docs.subconscious.dev/api-reference)
