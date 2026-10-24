# Honor staff access

Honor is one business. `/workspace` is for its assigned staff and administrators. Customer registration creates only a customer identity; it cannot create a business or grant inventory access. The public `/companies` mutation is disabled server-side. A platform for multiple businesses is a later project.

## Initial operator setup

Apply Alembic migration 0005 using a migration connection, before deploying this backend version. The new column requires initial temporary passwords to be replaced before accessing records. Runtime credentials remain restricted.

The first administrator must verify their email and sign in to Honor. Then an operator runs the following command from `services/backend` with the intended Honor database configured:

```sh
uv run python -m honor.cli provision-honor --email FIRST_ADMIN_EMAIL --currency NGN
```

Replace the email placeholder with the intended verified administrator. This command refuses a database that already has a business and creates no products, stock or locations. It is not exposed as a public API. Currency must be confirmed by the business before provisioning.

## Staff assignment

In People & access, an administrator chooses either a private invitation or an account with a temporary password, assigns the company role and locations, and confirms active access. Production access changes require a recent password check and an authenticator code. Existing identities are invited; the create action never overwrites their password.

Invitations are email-bound, expiring and single-use when accepted. Activation only creates an identity: company permissions come from the administrator's invitation, after email verification and acceptance. Allow the intended `/workspace` confirmation and invitation callback URLs in Supabase. Keep secure email change and email confirmation enabled.

Temporary-password creation uses Supabase's server-only Admin API with `HONOR_SUPABASE_SECRET_KEY`. This key must never be placed in a public environment variable, frontend bundle, repository, log or chat. Its absence disables this creation path; invitation setup remains separate. It has not been configured in the hosted API during this implementation. Production accounts are created with email confirmation required, then a confirmation resend is queued. The first verified login can only replace the temporary password or sign out. The server rejects business API access until replacement.

## Personal security and removal

Staff change email with their current password. Supabase handles confirmation; Honor updates its identity only from a verified Auth profile. The staff UUID, role and activity links stay the same. Confirmed email changes revoke prior app sessions. Password changes require the current password, rotate the app session and revoke other sessions. Administrators see account events, never passwords or password hashes.

Suspending a membership denies company requests immediately, including requests from existing sessions. Historical stock movements and audit events remain. The last active administrator cannot be removed.

## Connection behavior

Inputs remain editable while disconnected. `You’re offline` indicates the browser has reported no network; `Waiting for Honor to reconnect` indicates server readiness is pending. These are distinct conditions.

An explicit login, signup, activation or recovery submission may wait in this open tab for at most five minutes. It is never saved to local storage, session storage, IndexedDB or a service worker. A readiness check can trigger a single dispatch. Changing form contents, changing screens, cancelling or leaving the page drops the unsent draft. An authentication POST that may already have been processed is never replayed automatically. Payment and stock commands are not included in this queue.

## Deployment acceptance gates

- Apply migration 0005 to Honor and regenerate the current bootstrap export for fresh installations.
- Connect and health-check the backend, proxy and secure cookies.
- Complete a real invite → email verification → acceptance → permitted stock-access flow.
- Complete admin-created account → verification → temporary-password replacement.
- Verify email changes from both inboxes and admin notification delivery.
- Confirm suspension blocks a previously signed-in staff session.

Local PostgreSQL integration tests cover authorization and session rules. Provider calls are contract-tested with fixtures; they are not proof of a live Supabase/email integration. The free Render pilot currently has no background worker, so queued invitation and account-update emails will not be delivered automatically until a delivery processor is explicitly configured. Do not label a queued email as sent.
