# Honor API on free Render hosting

The root `render.yaml` creates exactly one free Docker web service, `honor-api`, from `main`. It creates no background worker, cron job, database, disk or paid compute service. PostgreSQL and managed identity remain in the existing Honor Supabase project; the customer and staff interface remains on the connected Vercel project.

## Setup and access

Render must have permission to clone the private `NIDHOGGR-shadow/honor-erp` repository. In GitHub's Render app installation, grant repository access specifically to Honor. Do not make the repository public.

Apply the root Blueprint after reviewing that the single service has plan `free`. Supply the seven requested runtime values privately, using the existing restricted database URL and the existing session secret. Do not generate a replacement session secret during this move: stored managed-auth tokens depend on it. Database owner and Supabase service-role credentials are not required.

The Dockerfile starts native FastAPI on `0.0.0.0` using Render's `PORT`. The Blueprint uses `/api/health` to verify database-backed readiness. Production mode, Supabase Auth, secure cookies and disabled payments remain enforced. No sample products or administrator accounts are created.

## Verification and frontend connection

After the deploy becomes live, verify `/api/health`, unauthenticated inventory denial and managed sign-in. Only after API readiness passes, set the server-only Vercel `HONOR_API_ORIGIN` to the actual Render HTTPS origin and redeploy the existing storefront project. The Next.js rewrite is evaluated during build, so saving the value alone is insufficient. Then check `/workspace`, customer sign-in and company/location permissions through the Vercel origin.

## Hosting limitations

Free web services sleep after 15 minutes without inbound traffic and restart on the next request. Free instance hours are shared across the workspace. Do not use keep-alive requests to defeat sleeping.

No process runs `honor.jobs` in this configuration. Queued application email and payment reconciliation jobs do not process automatically, and reservation cleanup does not run on a timed schedule. Checkout already clears expired reservations for the current company when it reserves stock, but this is not a substitute for a running worker. Supabase's own authentication emails are separate. Keep payments disabled and do not describe the application as operationally complete.

No existing Cloudflare resource or other application is deleted or repurposed. Hosted deployment, identity flows and customer checkout must be verified before a business launch.

## References

- https://render.com/docs/git-provider
- https://render.com/docs/blueprint-spec
- https://render.com/docs/free
- https://render.com/docs/health-checks
