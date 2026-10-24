# Honor security and launch work

## Confirmed product decisions

- One business: Honor. Public registration for other businesses is excluded.
- Administrators invite staff or assign an initial temporary password, role and locations.
- Staff control their eventual private password and can request a verified email change.
- Administrators can suspend company access and receive account-change notifications without passwords.
- Keep the green design, improve mobile forms, and display a clear offline message.
- Inventory remains the primary product; no sample products or stock are added.

## Work and evidence

| Area | Implementation status | Remaining acceptance work |
| --- | --- | --- |
| Mobile forms | Editable inputs, 16px input text, larger touch controls, shorter notices, distinct customer and staff entry | Verify current deployment on a phone |
| Staff assignment | Invitation activation; admin account creation; first-password gate; no public company creation | Connect Admin API key securely; real email verification and account activation |
| Personal account changes | Reauthentication for changes, stable UUID, session revocation, admin event outbox without credentials | Verify secure email-change settings and deliver notifications |
| Staff removal | Company-scoped suspension enforced on each request, last-admin protection, immutable history | Hosted session-removal acceptance test |
| Offline behavior | Browser offline notice, in-memory unsent action, cancellation, expiration, one dispatch after readiness | Browser reconnect acceptance test; no offline payment execution |
| Customer privacy | Existing customer ownership/order-access checks and private receipt endpoint | Hosted cross-customer access tests and retention decisions |
| Payment integrity | Existing server-controlled totals, provider verification, signed webhook checks, stable references and duplicate-event handling | Confirm merchant country/currency/provider; provider test-mode flow, recovery and refunds |
| Web protections | Existing secure cookies, origin checks, no-store private APIs; added frame denial and basic CSP restrictions | Broader script policy, endpoint abuse limits, platform firewall configuration and dependency review |
| Recovery and operations | Existing restricted runtime database role and append-only history | Business-owned accounts, backup/restore drill, incident contacts, retention schedule and monitoring |

## Decisions still needed

1. Where is the Honor merchant registered, which currency will it sell in, and does it already have a Paystack/Stripe/other merchant account?
2. Should checkout require a customer account or allow guest checkout with a private order-access link? Existing implementation supports both, but this is a business decision.
3. Are purchases collection-only at launch? Who may approve cancellations, refunds and inspected returns?

Keep payment processing disabled until the merchant integration and operational process are verified. A browser success redirect or uploaded transfer slip must never mark an order paid. The backend must validate the provider's payment reference, amount, currency and status. No card details or CVV are stored by Honor.

## Implementation order

1. Finish and deploy the staff/form changes with local regression tests.
2. Resolve backend hosting access, apply the migration and configure the server connections.
3. Provision the verified first administrator, configure email delivery and test assigned staff flows.
4. Test customer privacy, account recovery and suspension against the hosted system.
5. Configure the selected provider in test mode; test forged/duplicate callbacks, amount mismatches, interrupted payment, delayed bank transfer and refunds.
6. Review dependency findings, firewall/abuse controls, logs and backups with the business operator before launch.

## Security references

- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Email Validation and Verification: https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html
- OWASP Payment Gateway Integration: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html
- Paystack verification: https://paystack.com/docs/payments/verify-payments/
- Paystack webhooks: https://paystack.com/docs/payments/webhooks/
- Supabase server-only user creation: https://supabase.com/docs/reference/javascript/auth-admin-createuser
- Supabase auth redirect allowlist: https://supabase.com/docs/guides/auth/redirect-urls
