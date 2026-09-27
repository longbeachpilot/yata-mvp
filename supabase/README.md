# Current database and launch hardening

The live database and the historical `MVP_SETUP.sql` have diverged. The historical installer is retained as reference and deliberately raises an error: executing it would replace current policies/functions with an older authorization model. Do not remove the guard or use that file to reset a database.

`migrations/20260922061105_launch_hardening.sql` targets the existing September 2026 schema. It was applied to the connected YA TA database on 2026-09-22 after a transaction/rollback regression test, and tested again after application. It does **not** bootstrap an empty project. Earlier production migrations are not all present in this repository; export and reconcile the complete schema before creating staging or a new installation.

Changes:

- Limit profile updates to display name, phone, avatar and home area; user roles cannot be edited through the client table API.
- Keep insurance verification under administrator control. Changes to credentials, vehicle or safety equipment withdraw publication/verification until reviewed.
- Use the existing private credential RPCs for instructor profile editing.
- Register the instructor and update a learner's role in the same transaction; the obsolete `become_instructor` call is no longer used.
- Require the advertised 120-minute duration, a positive server-side price, valid date/time and a future start in Asia/Seoul. Reject midnight-crossing lessons and compare full timestamps for booking overlaps.
- Revoke public execution of the signup trigger and unnecessary table-level truncate/reference/trigger privileges.

## Regression suite

`tests/database-launch.sql` creates synthetic users and bookings. The file includes BEGIN and ROLLBACK. Execute it as a single SQL batch. It must never be executed as a committed migration or against a database client that splits statements into independent transactions.

```sql
-- Execute the complete tests/database-launch.sql in one batch.
-- Its BEGIN and ROLLBACK must remain in place.
```

The original verification also executed the migration DDL inside the same rollback transaction before applying it. Authorization is checked as `authenticated`, using synthetic JWT subjects. Tests cover allowed profile edits, rejected role edits, unauthorized administrator/credential access, past time, invalid duration, midnight crossing, exact and overlapping bookings, learner overlap, server pricing and self-verification attempts.

Intentional security-definer RPCs remain callable by authenticated users and must continue checking ownership/admin capability internally. Private credential/admin tables intentionally have no client RLS policies. Neither warning is a reason to grant blanket access. Leaked-password protection remains an Auth configuration follow-up.

## Scheduled lesson completion (2026-09-27)

`migrations/20260927001019_prevent_early_booking_completion.sql` updates the existing instructor transition RPC. A confirmed booking can only become completed at or after its scheduled end (`lesson_date + start_time + duration_minutes`, Asia/Seoul). Before then it stays confirmed, so the existing instructor and learner overlap checks keep blocking conflicting bookings. Ownership, row locking, valid transitions, cancellation and duplicate-click handling remain enforced. No booking rows are changed by the migration.

`tests/database-booking-completion.sql` must also run as one complete BEGIN/ROLLBACK batch. It checks missing authentication, ownership, future and in-progress completion rejection, both overlap checks after rejection, post-end completion, duplicate clicks, prohibited backwards transitions, cancellation and rebooking. It uses a non-Korean session timezone to check the explicit Seoul conversion. All users and bookings are synthetic and rolled back.

The dashboard disables completion until the scheduled end and refreshes its clock while open. The database remains authoritative if the browser clock is wrong or an RPC is called directly. `npm run check` covers the date helper's exact end boundary, timezone boundary and invalid schedules in addition to the existing checks.
