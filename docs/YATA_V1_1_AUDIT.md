# YA TA v1.1 — Product & Engineering Audit

## Current baseline

YA TA is an operational MVP built with Next.js and Supabase. The current repository already contains learner/instructor authentication, instructor registration and approval, instructor discovery/detail pages, booking lifecycle, instructor dashboard, learner logbook/reviews, admin dashboard, and Supabase setup/RLS.

## v1.1 product goal

Move the product from a functional MVP toward a consumer-ready marketplace while preserving the working booking flow.

Primary learner journey:

Home → Find instructor → Compare → Instructor detail → Choose lesson/date/time/place → Request booking → Track lesson → Logbook → Review

Primary instructor journey:

Register → Verification → Approval → Profile → Receive booking → Accept/reject → Complete lesson → Write logbook → Build rating/review history

## Priority 0 — release safety

1. Keep `main` production-safe.
2. Develop and validate changes on `chatgpt/yata-v1-1` first.
3. Require TypeScript check and Next.js production build before production merge.
4. Verify Vercel Preview deployment before modifying production behavior.

## Priority 1 — consumer marketplace UX

The instructor is the primary marketplace object. Learners should be able to understand and compare instructors quickly using:

- verified/approval state
- service area
- lesson specialties
- licenses/credentials
- vehicle
- rating and review count
- completed lesson count
- next available time
- concise instructor introduction

Improve the home page so the primary CTA is instructor discovery rather than exposing implementation details.

Improve instructor cards for fast comparison on mobile.

Improve instructor detail so booking is the dominant next action.

## Priority 2 — booking clarity

Use one consistent booking funnel. Reduce duplicated booking entry points where possible and make the booking state understandable to learners and instructors.

Booking statuses should have consistent Korean labels and clear next actions.

## Priority 3 — trust and verification

Instructor verification should become a visible trust layer rather than only an admin workflow. The product should distinguish submitted, under review, approved, rejected, and inactive states where applicable.

Do not expose private credential documents or sensitive identifiers publicly.

## Priority 4 — real transaction readiness

Payment is intentionally outside the current MVP. Before PG integration, define price ownership, cancellation/refund rules, settlement model, receipts, disputes, and the legal relationship among YA TA, partner driving schools, instructors, and learners.

## Priority 5 — maintainability

As UI work proceeds, extract repeated navigation, status labels, cards, buttons, and formatting into shared components/utilities instead of expanding page-level duplication.

## First implementation batch

1. Verify GitHub → Vercel Preview pipeline.
2. Audit home and instructor discovery code.
3. Refine marketplace information hierarchy and mobile UX.
4. Preserve existing Supabase schema and working booking behavior unless a schema change is explicitly required.
5. Validate typecheck/build before proposing production merge.
