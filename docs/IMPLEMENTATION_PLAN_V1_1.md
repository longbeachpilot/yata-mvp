# YA TA v1.1 Implementation Plan

## Batch A — Marketplace UX

Target files:

- `app/page.tsx`
- `app/instructors/page.tsx`
- `app/instructors/[id]/page.tsx`
- `app/globals.css`

Goals:

- make instructor discovery the clearest learner CTA
- improve mobile information hierarchy
- make instructor cards easier to compare
- make booking the dominant action on instructor detail
- retain existing Supabase queries and booking behavior

## Batch B — Booking consistency

Target files:

- `app/book/page.tsx`
- `app/bookings/page.tsx`
- instructor dashboard booking UI

Goals:

- normalize status labels
- clarify learner/instructor next actions
- reduce duplicated or confusing booking entry points

## Batch C — Trust layer

Target files:

- instructor registration/profile
- instructor public profile
- admin verification workflow

Goals:

- clear verification lifecycle
- visible trust indicators without exposing private credentials
- consistent approval/inactive behavior

## Release procedure

1. Implement on `chatgpt/yata-v1-1`.
2. Confirm automated Quality workflow.
3. Confirm Vercel Preview.
4. Review visible behavior.
5. Open PR to `main`.
6. Merge only after preview/build passes.
7. Confirm Vercel Production deployment.
