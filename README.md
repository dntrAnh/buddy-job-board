# Crew Connect

**Job hunting is a team sport now.**

Your friends find the good postings. They drop them in the group chat. The chat scrolls, the posting gets buried under memes, and three weeks later somebody says "wait, did anyone actually apply to that?"

Crew Connect is the board that ends that story. It is a private job board for one small crew: anyone can paste a job link, the whole group gets an email alert, and the board keeps score of who has applied and who is still sleeping on it. Social pressure, but make it productive.

**Live app:** https://buddy-job-board.vercel.app/board

## How it works

1. **Paste a link.** Any member drops in a job posting URL. Crew Connect reads the page and pulls out the company, role, and details automatically, so every posting lands on the board in the same clean format no matter where it came from.
2. **The crew gets pinged.** Everyone in the group gets an email alert for the new posting. No more "oh I never saw that link."
3. **Work your own board.** Your personal dashboard splits everything into **To Apply**, **Applied**, and **Skipped**, so your pipeline is yours to manage.
4. **The group board keeps everyone honest.** It shows who has applied to what, and the quiet names get reminder emails. Friendly, automated nagging.
5. **Apply better, not just faster.** Each posting gets an ATS match score against your resume, with the exact resume changes that would raise it and the estimated impact of each change.

## Features

- **Private groups, up to 15 members.** Join through a shared invite link. For a small trusted crew, the link itself is the gate: zero admin overhead, zero approval queues.
- **One-link job posts.** Paste a URL and the posting imports itself (title, company, description) and is normalized into one clean list, no matter how messy the source site was.
- **Email alerts that do the remembering for you.** New job alerts, "your friend just applied" notifications, an easy digest three times a day, and weekly reminders. Every email type can be opted out of individually, and a delivery log shows what was actually sent.
- **Reminder modes.** Each member picks how much nagging they want, from gentle to "do not let me miss this."
- **Personal application pipeline.** To Apply / Applied / Skipped boards with filters and sorting by company, role, match score, status, and date.
- **Group board.** See at a glance which friends have applied to which postings, which is the whole point: the reminder is built into the product.
- **ATS match scoring.** Every posting is scored against your resume, with re-grading after you edit and a prioritized list of fixes ranked by estimated score impact.
- **AI resume bullet improvements.** Per-job suggestions to rewrite your resume bullets for that specific posting, plus the ability to save, edit, and reuse a tailored resume version for each company and role.
- **Mobile friendly.** The board and group management work on your phone, because job links get shared from phones.

## Design decisions worth stealing

- **Normalize everything at the door.** People paste links from a dozen different job sites in a dozen formats. The board accepts all of them and stores one clean shape, so posting a job never feels like paperwork.
- **The shared link is the access control.** Approval flows and member requests are friction a 10-person friend group does not need. If you have the link, you are in the crew. Simple on purpose.
- **Reminders are a feature, not a side effect.** Most job boards track postings. Crew Connect tracks *people*: who has seen it, who has applied, who needs a nudge. The accountability is the product.

## Tech stack

**Frontend**
- React 19 and React DOM 19
- TypeScript 5
- TanStack Start (full-stack React framework with SSR)
- TanStack Router (file-based routing)
- TanStack Query (server state and caching)
- Tailwind CSS v4
- Radix UI primitives (dialogs, dropdowns, tooltips, tabs, and the rest of the component layer)
- Lucide React (icons)
- React Hook Form with Zod validation (and @hookform/resolvers)
- Recharts (charts)
- Sonner (toasts), Vaul (drawers), Embla Carousel, cmdk (command palette), react-day-picker, input-otp, react-resizable-panels
- date-fns (date handling)
- clsx, tailwind-merge, class-variance-authority, tw-animate-css (styling utilities)

**Backend**
- TanStack Start server functions (API and server logic in the same codebase)
- Nitro (server runtime and build output)
- Supabase: PostgreSQL database with SQL migrations, and @supabase/supabase-js
- Supabase Auth: email/password accounts plus "Continue with Google" (Google OAuth provider configured directly in Supabase, no third-party auth broker)

**AI**
- Vercel AI SDK (`ai`) with the OpenAI provider (@ai-sdk/openai)
- Powers the job-posting import extraction, ATS match scoring, and resume bullet suggestions

**Email**
- React Email (@react-email/components and @react-email/render) for templated transactional email
- Scheduled endpoints for the job digest (3x per day) and weekly reminder emails
- Per-type opt-outs and a delivery status log

**Tooling and deployment**
- Vite 8 (bundler and dev server)
- Bun (package manager, bun.lock)
- ESLint 9 and Prettier 3
- Deployed on Vercel

## Getting started

You need Node.js (or Bun) and a Supabase project.

```sh
git clone https://github.com/dntrAnh/buddy-job-board.git
cd buddy-job-board
bun install
bun run dev
```

Create a `.env` file with your Supabase credentials:

```sh
SUPABASE_PROJECT_ID=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

## Why I built this

I was job hunting with my friends, and we kept losing good postings inside our own group chat. The information was there; the follow-through was not. Crew Connect is the tool I wanted us to have: one shared list nobody can lose, alerts nobody can miss, and just enough peer pressure to turn "I should apply to that" into "Applied."
