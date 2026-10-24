# Activate Honor

Updated 24 October 2026. The app is a real inventory product. Service activation is incomplete; public presentation routes are retired. See [the current product audit](PRODUCT_READINESS.md).

## Activation sequence

1. Database upgrade complete: Honor is at Alembic 0005, with first-login password replacement installed and no business/product records created. Do not rerun the fresh installer or seed any data.
2. Grant Render access to the private Honor repository and configure the existing restricted database URL, existing session secret, Supabase public Auth configuration and exact frontend origins privately. The root `render.yaml` currently declares one free Docker API service, no paid resources or background worker.
3. Verify database-backed `/api/health`, unauthenticated inventory denial and managed sign-in. The first administrator email is verified; the business has no administrator membership yet.
4. Set Vercel's server-only `HONOR_API_ORIGIN` to the verified API host and redeploy the existing `honor-storefront` project. Keep database, session and payment secrets out of frontend builds.
5. After the designated administrator actually signs into Honor, run the operator-only `provision-honor --email FIRST_ADMIN_EMAIL --currency NGN` workflow. It requires that verified session and creates one empty business. Do not bypass verification or invent a session.
6. Verify administrator MFA, assigned staff access and revocation before entering business stock. No products or sample records are created by activation.
7. Configure and run the notification/payment job processor and verify email delivery, then test the selected merchant's hosted checkout and signed provider events before enabling payments. One free web service does not process those jobs automatically.

The database uses the private `honor` schema and restricted runtime role. Migration-owner access stays separate. Do not copy secrets into chat or GitHub. Review the exact destination and transfer authorization before supplying secrets to a host.

See [free API setup](RENDER_FREE.md), [staff access](STAFF_ACCESS.md), [runtime access](DATABASE_SECURITY.md) and [the runbook](RUNBOOK.md).
