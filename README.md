# PACE Measurement Platform

Mobile-first web app for Medwell Solutions that verifies, scores and reports community
participation. Volunteers check in at nonprofit events by scanning a rotating QR code and earn
PACE points (Performance, Accountability, Community, Engagement).

UTA CSE Senior Design, Fall 2026 – Spring 2027, team PACEmakers. Code is owned by Medwell Solutions.

## Stack

- [Next.js 16](https://nextjs.org/docs) (App Router) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com/docs): Postgres, Auth, row-level security
- [Vercel](https://vercel.com/docs): production deploys from `main`, a preview deploy for every pull request

## Getting started

Requires Node.js 24.

```bash
npm install
cp .env.example .env.local   # then fill in the values; ask the team if you don't have them
npm run dev                  # http://localhost:3000
```

The home page shows "Supabase: connected" when your `.env.local` is correct.

## Database changes

All schema changes go in migration files under `supabase/migrations/`, never ad hoc in the
Supabase dashboard. The Supabase CLI is installed as a dev dependency, so run it with `npx`:

```bash
npx supabase login                      # once per machine
npx supabase link --project-ref <ref>   # once per clone; needs the database password
npx supabase migration new <name>       # creates an empty migration file to edit
npx supabase db push                    # applies new migrations to the linked project
```

## Project layout

```
src/
  app/              pages and routes (App Router)
  lib/supabase/     Supabase clients: client.ts (browser), server.ts (server), proxy.ts (session refresh)
  proxy.ts          runs before each request (Next.js 16's name for middleware)
supabase/
  config.toml       Supabase CLI settings
  migrations/       database schema, applied in order
```

## Workflow

- Branch from `main`, keep pull requests small, and get one review before merging.
- Explain design decisions in the PR description so they can go into the SRS and ADS.
- Never commit `.env.local` or any keys.
