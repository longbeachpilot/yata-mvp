# YA TA MVP 0.6 Developer Handoff

## 현재 완성 범위
- Email/password Auth
- profiles role: learner / instructor
- instructor registration linked to auth user
- public active instructor discovery/detail
- learner booking creation and list
- instructor scoped booking dashboard
- booking requested → confirmed/cancelled → completed
- instructor lesson log + skill scores
- learner logbook
- instructor profile edit
- basic responsive navigation
- RLS policies consolidated in `supabase/MVP_SETUP.sql`

## Next priorities after closed beta
1. Booking collision prevention / availability model
2. Verified instructor workflow and admin review
3. Payment provider + cancellation/refund state machine
4. Notification (email/SMS/push)
5. Map/geospatial search
6. Images/storage
7. Reviews and reputation
8. Audit log / observability

## Security notes
- Never expose service-role keys to the browser.
- Current MVP intentionally uses anon/publishable key + RLS.
- Verify all RLS policies in staging before public launch.
