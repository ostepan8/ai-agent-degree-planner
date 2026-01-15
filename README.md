# Northeastern Degree Planner

A demo showcasing the [Subconscious Agent SDK](https://github.com/subconscious-systems/subconscious-python) for building 4-year degree plans from live university catalogs.

## The Approach

**We don't scrape or pre-ingest catalog data.**

Instead:
- Every piece of academic information comes from live search
- The AI agent is responsible for discovering and grounding facts  
- The backend validates and reasons over the agent's output

This avoids brittle scrapers, stale data, and year-over-year maintenance—and demonstrates how agents are meant to solve real problems.

## How It Works

1. **Choose your major** (free text input)
2. **Agent research phase** - Searches official Northeastern catalogs
3. **Requirements review** - View extracted courses with sources
4. **Set preferences** - Co-ops, credits per semester, scheduling constraints
5. **Generate plan** - AI builds an optimized 4-5 year plan with explanations

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

#### Supabase Setup (Optional)

To enable user tracking to Supabase:

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Table Editor** → **New Table** → Name it `user_logs`
4. Add these columns:
   - `id` (int8, primary key, auto-generated) - already exists by default
   - `created_at` (timestamptz, default: now()) - already exists by default
   - `email` (text, nullable)
   - `school` (text, nullable)
   - `major` (text, nullable)
   - `starting_semester` (text, nullable)
   - `credits_per_semester` (text, nullable)
   - `coop_plan` (text, nullable)
   - `is_freshman` (bool)
   - `completed_courses_count` (int4)
   - `notes` (text, nullable)
5. Go to **Settings** → **API** → Copy your Project URL and anon/public key
6. Add the environment variables above

## Subconscious SDK

Uses the [Subconscious Python SDK](https://github.com/subconscious-systems/subconscious-python):

```bash
pip install subconscious-sdk
```

```python
from subconscious import Subconscious
from pydantic import BaseModel

class DegreeRequirements(BaseModel):
    core_courses: list[dict]
    electives: list[dict]
    nupath: list[str]

client = Subconscious(api_key="your-api-key")

run = client.run(
    engine="tim-large",
    input={
        "instructions": "Search Northeastern catalog for CS BS requirements",
        "tools": [{"type": "platform", "id": "parallel_search"}],
        "answerFormat": DegreeRequirements,
    },
    options={"await_completion": True},
)

print(run.result.answer)
```

## Why This Approach

This project demonstrates:
- **Live search + grounding** - No stale scraped data
- **Agentic reasoning** - Agent extracts and structures requirements
- **Explanation-first UX** - Sources and confidence levels shown
- **Human-in-the-loop** - User reviews and adjusts before generating

If Northeastern updates their catalog tomorrow, this app automatically reflects it.

## Scope

**In scope:**
- Northeastern University undergrad degrees
- Live catalog search via Subconscious
- 4-year plan generation with co-op support

**Out of scope:**
- Scraping or catalog mirroring
- Seat availability or enrollment
- Advisor replacement claims

## Resources

- [Subconscious Documentation](https://docs.subconscious.dev)
- [Python SDK](https://github.com/subconscious-systems/subconscious-python)
- [API Reference](https://docs.subconscious.dev/api-reference)

---

*We don't own the data. We understand it. We explain it. We act on it responsibly.*
