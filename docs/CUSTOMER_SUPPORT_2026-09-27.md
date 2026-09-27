# Customer support and booking guidance

The confirmed initial flow is YA TA reservation request → instructor/school confirmation → customer pays the education provider directly. WEED incorporation/registration is in progress, and a real-car partner school has not yet been secured.

## Implemented

- `/support`: email-only contact at `ssk04058@gmail.com`, request versus confirmation, direct payment, cancellation versus refund, password recovery and account/privacy inquiry instructions.
- Shared footer: contact page, email address and accurate WEED preparation status.
- Booking form: guidance before submitting a request.
- Learner bookings: status explanations, explicit refund warning before cancellation, manual refresh and a booking-specific email link.
- Instructor bookings: the same booking-specific inquiry link.
- Profile: contact and account/privacy inquiry links.

Email links open a draft in the customer's mail application. The customer reviews and sends it. Booking links include only the booking ID, not the account email, name, phone or pickup location. They do not send mail, create a support ticket, notify the other participant or change a booking. The displayed email address can be copied if no mail application is configured.

## Manual handling

The operator must monitor the confirmed inbox and verify the requester before sharing booking or account information. Possession of a booking ID alone is not proof of ownership. Account deletion requests require identity checks and a decision about the records to retain or delete; sending a message is not an automatic deletion operation.

For a paid cancellation, the education provider handles the payment/refund. A cancelled YA TA booking is not a receipt or evidence that a refund completed. The operator can receive an inquiry if the customer cannot reach the provider.

## Still required before real customer lessons

- A verified partner, agreed price/service/cancellation conditions and actual available schedules.
- Final operator details, customer response hours and an assigned inbox operator.
- Full operating terms and privacy notice, including retention, processors/transfers and consent records. The support page does not replace these documents.
- Reservation notifications and delivery-failure handling. Authentication SMTP does not send booking notifications.
- End-to-end customer/instructor tests on real devices. This change passed build/type checks and link checks; browser installation was blocked by the execution environment's network approval flow.

No partner facts, verified flags, schedules, refund policy, response deadline or registration number were invented. No authentication settings, database schema, bookings or email-delivery settings were changed by this UI update.
