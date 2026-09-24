# Crew Job Board — private group job sharing with nudges

A small invite-only job board: anyone in a group pastes a job, everyone else gets an email, and each person tracks what they still need to apply to — with visibility into who in the group already applied.

## Core flows

**Groups & invites**
- Sign up / sign in with email.
- Create a group, or join by accepting an emailed invite.
- Members invite by email address; only invited addresses can join that group. Groups are capped at 15 members (pending invites count toward the cap).
- A person can belong to several groups; a group switcher picks the active board.

**Posting a job**
- Paste the job description, plus company name and role.
- Optional link and notes.
- On save, every other member of that group gets an email: "New job at <company> — go apply."

**Resume match score**
- Each person saves their resume text once in their profile.
- When a job is posted, the app scores each member's resume against that job description and shows a match percentage on their own board (each person sees only their own score).
- People can edit their resume at any time and click "Re-grade" (per job, or for all jobs) to instantly re-score against the new version and see how the changes improved their match.
- Scoring works like an ATS: built-in AI pulls the keywords from the job post, checks which appear in your primary resume, and gives a score plus matched/missing keywords and a few short, direct suggestions for changes (only when needed). No external account needed.

**My board (dashboard)**
- Two columns: "To apply" and "Applied".
- Each job card shows company, role, my match %, and who else has applied.
- One click marks a job as applied (or skipped, so it stops nagging).

**Group board**
- The full job list with, per job, avatars/names of who applied.
- Sorted to surface jobs where friends have applied but you haven't.

**Emails**
- New job posted → to all other members.
- A groupmate applied to a job you haven't → nudge email.
- Weekly reminder of jobs you still haven't applied to.
- Each person can turn off any of these three in settings.

## Look and feel

Clean, slightly playful, card-based, light and dark mode. Accent color used for match scores and "friends applied" badges so urgency reads at a glance.

## Technical notes

- Lovable Cloud for accounts, data and server logic.
- Tables: `groups`, `group_members`, `invites`, `jobs`, `applications` (per member per job: to_apply / applied / skipped), `profiles` (resume text, notification prefs), `match_scores`. Row-level security so data is only visible to members of the same group.
- Match scoring via the built-in AI gateway, run server-side when a job is created and when a resume changes; cached per (member, job).
- Emails via Lovable's built-in email sending, with React email templates for the three alert types. Weekly reminders run on a schedule.
- Notifications fire from server code after the job insert / application update, not from the browser.

## Needs your input before emails can send

Sending email requires a domain you own — your emails come from your own brand, which improves deliverability and builds trust with your group.

Let's set up your sender domain (e.g. notify@yourdomain.com). Everything else can be built and used meanwhile; alerts start flowing once the domain verifies.

## Suggested build order

1. Accounts, groups, invites.
2. Job posting + group board + apply/skip tracking.
3. Personal dashboard with friends-applied visibility.
4. Resume + match scores.
5. Email alerts and reminder schedule.
