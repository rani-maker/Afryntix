# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AFRYNTIX

A full-stack logistics platform for shipping between China and West Africa. Features include shipment management, real-time tracking, role-based portals (admin/staff/client), and WhatsApp notifications.

## Commands

```bash
# Development
npm run dev          # Start dev server on port 3000
npm run build        # prisma generate + next build
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npm run db:push      # Push schema changes to DB (no migration history)
npm run db:migrate   # Create and apply a named migration
npm run db:seed      # Seed initial data (admin user, defaults)
npm run db:studio    # Open Prisma Studio GUI
```

There are no automated tests configured.

## Environment Setup

Copy `.env.example` to `.env.local`. Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_URL` — set to `http://localhost:3000` for dev
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — WhatsApp notifications
- `DEFAULT_ADMIN_*` — used by the seed script to create the initial admin account

## Architecture

**Stack:** Next.js 15 (App Router) + React 19 RC, TypeScript strict mode, PostgreSQL + Prisma ORM, NextAuth.js v5 beta, Tailwind CSS + shadcn/ui, React Hook Form + Zod.

### Route Layout (`src/app/`)

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/tracking`, `/services`, `/addresses` | Public | Public-facing pages |
| `/login`, `/register`, `/staff-invite` | Public | Auth flows |
| `/dashboard` | CLIENT role | Client portal |
| `/staff` | STAFF or ADMIN | Staff management portal |
| `/admin` | ADMIN only | Full system administration |

Route protection is enforced in `src/middleware.ts` — it guards all non-public routes and redirects based on role.

### Server Actions (`src/server/actions/`)

All mutations go through Next.js Server Actions (files tagged `"use server"`). This is the primary backend layer — there are no separate API routes for business logic, only `/api/auth` for NextAuth callbacks.

Key action files: `shipments`, `payments`, `auth`, and supporting modules for reservations, staff, and admin operations.

### Auth (`src/auth.ts`)

NextAuth v5 with a Credentials provider (email + bcrypt password). The session JWT carries `id`, `role`, and `name`. Three roles: `ADMIN`, `STAFF`, `CLIENT`. Use the `auth()` helper from `src/auth.ts` in Server Components and actions; use the `useSession()` hook in Client Components.

### Data Layer (`src/lib/prisma.ts`)

Prisma client singleton. Schema is in `prisma/schema.prisma`. Run `db:push` for quick dev iterations; use `db:migrate` when creating a migration record.

### UI Components

`src/components/ui/` — shadcn/ui primitives (Button, Card, Input, Dialog, etc.). These are copied-in source files, not an imported package — edit them directly when needed.

`src/components/dashboard/` — Sidebar and Topbar shared across the dashboard, staff, and admin portals.

### Pricing & Business Logic

`src/lib/pricing.ts` — calculates shipping costs based on transport mode (air express/normal, sea LCL/FCL, vehicle, BTP equipment, storage), cargo category, and weight/dimensions.

`src/lib/whatsapp.ts` — Twilio WhatsApp integration for shipment status notifications.

## Language Note

UI strings and most code comments are in French.
