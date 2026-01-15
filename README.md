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
6. **Edit your schedule interactively** - add/remove courses, swap semesters
7. **Changes persist automatically** - come back anytime to continue editing

## Features

### Persistent Schedules

Schedules are saved to your account and persist across sessions:
- Enter your email when generating a schedule
- Returning users see a "Welcome back" modal with their existing schedule
- All edits (manual or AI-assisted) are automatically saved
- Load your schedule from any device

### Interactive Editing

Once your schedule is generated, you can:
- **Add/remove courses** - Click to modify any semester
- **Move courses** between semesters via drag-and-drop
- **Chat with AI** - Ask the agent to make changes ("Remove all electives from Spring 2027")
- **Swap semesters** - Reorder your plan as needed

### AI-Powered Tools

The agent has access to 18+ tools for schedule manipulation:
- `add-course` / `remove-course` - Modify individual courses
- `bulk-add-courses` / `bulk-remove-courses` - Batch operations
- `move-course` / `swap-courses` - Reorganize your plan
- `get-credit-summary` - Check progress toward graduation
- `validate-schedule` - Verify prerequisites and requirements

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

Create a `.env` file in the root directory with the following variables:

```bash
# Required: Your Subconscious API key
SUBCONSCIOUS_API_KEY=your-api-key

# Required for schedule persistence: Supabase credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

You can also create a `.env.local` file for local overrides (e.g., tunnel URLs for agent callbacks).

### Supabase Setup

Supabase is required for schedule persistence. Without it, schedules will only be stored in-memory and lost on server restart.

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **SQL Editor** and run:

```sql
CREATE TABLE user_logs (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  school TEXT,
  major TEXT,
  starting_semester TEXT,
  credits_per_semester TEXT,
  coop_plan TEXT,
  is_freshman BOOLEAN DEFAULT true,
  completed_courses_count INTEGER DEFAULT 0,
  notes TEXT,
  schedule TEXT
);

-- Create index for faster email lookups
CREATE INDEX idx_user_logs_email ON user_logs(email);
```

4. Go to **Settings > API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY`

> **Note:** The service role key bypasses Row Level Security (RLS) and is used for server-side operations. Keep it secret and never expose it to the client.

### Cloudflare Tunnel (for AI Agent Callbacks)

When the AI agent makes schedule edits, it needs to call back to your local server. For local development:

1. Install Cloudflare Tunnel: `brew install cloudflare/cloudflare/cloudflared`
2. Start a tunnel: `cloudflared tunnel --url http://localhost:3000`
3. Copy the generated URL and add to `.env.local`:

```bash
TUNNEL_URL=https://your-tunnel-url.trycloudflare.com
```

This is only needed for AI-assisted schedule editing, not for viewing or manual editing.

## API Routes

### User Data

| Route | Method | Description |
|-------|--------|-------------|
| `/api/log` | POST | Save user preferences and schedule |
| `/api/user/schedule` | GET | Retrieve user's saved schedule by email |

### Schedule Generation

| Route | Method | Description |
|-------|--------|-------------|
| `/api/schedule/stream` | POST | Generate schedule via streaming |
| `/api/schedule/edit` | POST | AI-assisted schedule editing |
| `/api/schedule/requirements` | POST | Fetch degree requirements |

### Schedule Tools (Agent Callbacks)

| Route | Description |
|-------|-------------|
| `/api/tools/add-course` | Add a course to a semester |
| `/api/tools/remove-course` | Remove a course from a semester |
| `/api/tools/move-course` | Move course between semesters |
| `/api/tools/swap-courses` | Swap two courses |
| `/api/tools/bulk-add-courses` | Add multiple courses |
| `/api/tools/bulk-remove-courses` | Remove multiple courses |
| `/api/tools/add-semester` | Add a new semester |
| `/api/tools/remove-semester` | Remove a semester |
| `/api/tools/swap-semesters` | Swap two semesters |
| `/api/tools/set-semester-type` | Change semester type (academic/coop) |
| `/api/tools/get-schedule` | Get current schedule state |
| `/api/tools/get-semester` | Get specific semester details |
| `/api/tools/get-credit-summary` | Get credit totals |
| `/api/tools/count-courses-by-type` | Count courses by category |
| `/api/tools/find-courses-in-schedule` | Search for courses |
| `/api/tools/find-light-semesters` | Find semesters with low credits |
| `/api/tools/fill-semester-to-credits` | Auto-fill a semester |
| `/api/tools/validate-schedule` | Validate the schedule |

## Project Structure

```
constants/
  schools.ts              # Pre-configured school list with catalog URLs

lib/
  generate_prompt.js      # Schedule generation prompts and school-specific notes
  completion_prompt.js    # Prompts for students with existing transcripts
  validateSchedule.ts     # Post-processing validation and cleanup
  scheduleStore.ts        # Schedule persistence (Supabase + in-memory fallback)
  schemas.ts              # TypeScript types for schedules
  transcript/             # Transcript parsing utilities

app/
  api/
    log/                  # User data logging endpoint
    user/schedule/        # User schedule retrieval endpoint
    schedule/             # Schedule generation endpoints
    tools/                # AI agent tool endpoints (18+ tools)
    schools/              # School search endpoint
    transcript/           # Transcript parsing endpoint
  demo/
    page.tsx              # Main demo page
    components/
      SchoolStep.tsx      # School/major selection
      TranscriptStep.tsx  # Transcript upload
      PreferencesStep.tsx # Schedule preferences (email, co-op, etc.)
      ScheduleStep.tsx    # Interactive schedule view + editing
      ExistingScheduleModal.tsx  # "Welcome back" modal for returning users
```

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

## Troubleshooting

### Schedule changes not persisting

If edits aren't being saved:
1. Check that `SUPABASE_SERVICE_ROLE_KEY` is set (not just `SUPABASE_ANON_KEY`)
2. Verify the `user_logs` table exists with a `schedule` column
3. Check server logs for Supabase errors

### "Failed to generate schedule" errors

This usually indicates an issue with the Subconscious API:
1. Verify `SUBCONSCIOUS_API_KEY` is valid
2. Check if the Subconscious service is operational
3. Try again after a few minutes

### AI agent can't edit schedule

For AI-assisted editing to work:
1. Start a Cloudflare tunnel or ngrok
2. Set `TUNNEL_URL` in `.env.local`
3. Restart the dev server

## Scope

This is a demo application. It is not a replacement for academic advising.

What it does:
- Searches live university catalogs via AI agents
- Generates multi-year degree plans
- Supports co-op programs and transfer credits
- Allows interactive schedule editing
- Persists schedules to a database

What it does not do:
- Guarantee course availability or seat counts
- Replace official degree audits
- Provide enrollment or registration

## Resources

- [Subconscious Documentation](https://docs.subconscious.dev)
- [JavaScript SDK](https://www.npmjs.com/package/subconscious)
- [API Reference](https://docs.subconscious.dev/api-reference)
- [Supabase Documentation](https://supabase.com/docs)
