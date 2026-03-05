# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

There are no tests in this project.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (used in API routes for admin operations)
- `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` — Zoho CRM OAuth credentials
- `RESEND_API_KEY` — Resend email service key

## Architecture

**PJ Commission Management System** — a Next.js 16 app (App Router) using Supabase (PostgreSQL) as the backend. The app manages student enrollments and sales commissions for an international education agency.

### Tech Stack
- **Next.js 16 + React 19** — App Router, all pages are `"use client"` components
- **Supabase** — Auth, database, file storage; accessed via `@supabase/supabase-js` and `@supabase/ssr`
- **Tailwind CSS v4** — styling via `@tailwindcss/postcss`
- **Recharts** — dashboard charts
- **Resend** — transactional email
- **Zoho CRM** — OAuth 2.0 integration for deal stage syncing

### Authentication & Authorization
- Supabase Auth (email/password); session checked client-side on every page
- Three roles stored in `profiles` table: `admin`, `accountant`, `sales`
- Four departments: `china`, `thailand`, `myanmar`, `korea_japan`
- Sales users see only their own department's data; admins see everything
- API routes use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for admin operations

### Database Tables (key ones)
- `profiles` — users with `role` and `department` columns
- `students` — enrollment records with `status`, `assigned_sales_id`, `department`
- `commissions` — per-student commission records; statuses: `active → enrolled → pending → claimed / cancelled`
- `schools` — institution reference data
- `activity_logs` — audit trail written via `src/lib/activityLog.ts`
- `zoho_tokens` — OAuth tokens for Zoho CRM

### Key Flows
- **Commission claim (two-step):** `pending → claimed`; triggers Zoho deal update (`src/app/api/zoho/update-deal`) and email notification (`src/app/api/send-email`)
- **Auto status transition:** dashboard auto-advances `active → enrolled` after 14 days; creates a commission record
- **Offer letter extraction:** `src/app/api/extract-offer` parses uploaded offer letter files
- **Zoho OAuth:** connect at `src/app/api/zoho/connect`, callback at `src/app/api/zoho/callback`; tokens stored in `zoho_tokens` table

### Path Alias
`@/*` maps to `./src/*` (configured in `tsconfig.json`)

### Supabase Client Usage Pattern
- Client-side pages: create browser client via `src/lib/supabase.ts`
- API routes: use service role key directly for operations that need to bypass RLS
