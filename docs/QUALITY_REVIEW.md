# Honor quality review — staff access and API responses

Date: 23 October 2026.

## Findings addressed

| Problem | Resulting behaviour | Plain explanation |
| --- | --- | --- |
| Successful HTML responses and malformed JSON were accepted as empty API results. | The shared client rejects unexpected or unreadable success responses with an API error. HTTP error status codes are retained without displaying proxy HTML. | A hosting login/error page cannot look like a successful sign-in or stock update. |
| Identity, company selection and stock records were committed in separate stages. | The workspace loader verifies the profile and returns a complete snapshot scoped to a company in the user's current membership list. | The screen receives the account and its matching records together. |
| Optional configuration reads could prevent workspace loading. | Public configuration loads independently of the verified session and company records. | An unavailable settings response does not prevent an otherwise valid staff session from loading. |
| Revoked access and expired sessions could retain workspace selections or sensitive form state. | Session clearing invalidates outstanding refresh results and removes company records, modal contents, MFA enrolment and invitation links. Confirmed logout clears these before attempting another refresh. Identity, company or role changes reset the selected screen. | Another account or changed role starts without the previous account's open forms and selections. |
| Staff navigation permissions were applied in separate places. | One permission function controls both navigation visibility and navigation actions; unknown roles/pages are denied. API permissions remain authoritative. | Hiding a button and opening a screen follow the same access rules. |
| Password-recovery links could be bypassed while restoring an existing session. | Recovery entry takes priority over session restoration. A completed reset clears local session state and removes only the recovery query parameter. | Following the email opens the password form, then returns the person to sign-in. |

## Verification

- Regression tests reproduce the original HTML/malformed-JSON false-success bugs and exercise the corrected boundaries.
- Session tests cover all four staff roles, an unowned company selection, expired sessions, invalid profiles/collections, denied company access, absent memberships and administrator-to-sales changes.
- Rendering tests cover unconfigured sign-in, protected initial loading and recovery entry before browser hydration.
- The existing frontend/proxy suite and production Next.js build pass locally. CI also runs the existing backend suite against PostgreSQL 17.
- Synthetic identities and records exist only in test fixtures. No production account, company, product or stock was created.

## Remaining acceptance work

The hosted frontend still needs the real Honor API and the selected Supabase project configured. Managed signup/confirmation, SMTP delivery, password recovery, invitations, MFA and staff access must then be exercised with real test accounts. Automated local tests do not prove those hosted-provider flows. Vercel deployment protection was not changed.

After authentication is connected, verify a complete inventory workflow in a separate test environment: receive checked stock, reserve it, confirm payment, scan the device at handover and check the stock ledger. Keep real payments disabled until merchant acceptance testing is complete.
