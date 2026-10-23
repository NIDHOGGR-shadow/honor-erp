# Customer storefront integration

Source reviewed: Samuel's `honor-customer-storefront.zip`, supplied on 23 October 2026. The visual direction and customer screen structure were adapted into Honor's shared customer UI. The uploaded replacement dashboard, stub API client, fabricated business details, fixture data and conflicting dependency manifest were not imported.

## Implemented

- Calm collection shop with larger readable text, responsive spacing, real search/category/price controls, product detail, cart and checkout.
- Reloadable query-based customer views, shared by Next.js and `/shop/{slug}` in the API-hosted Vite frontend. Browser back/forward restores the selected screen; no separate competing router replaces the staff app.
- Actual catalogue/price/availability data and integer currency formatting from the original API. Sellable variants remain independent SKU/product IDs; there is no invented variant resource.
- Idempotent complete-cart reservation, stable guest credential saved before hosted-payment navigation, order recovery, verified status refresh and unpaid cancellation. A saved unpaid reservation is resolved before starting another checkout. Only a verified paid order clears its cart, once.
- Server-cookie email registration, sign-in/recovery/sign-out, account profile and per-shop order history. No browser identity JWTs. Order ownership is recorded from the current verified session at checkout, never from an email match.
- Guests still use a private access code; unrelated users cannot view, list, pay or cancel another account's orders. Company staff permissions are unchanged.
- Public collection addresses include only explicitly enabled locations. The server still assigns one location capable of supplying the complete cart; the frontend does not invent customer location-selection support.
- Vercel project configuration and Cloudflare Pages advanced-mode API proxy/build packaging.

## Truthful boundaries

Production inventory starts empty. Fixtures remain confined to tests. A cart does not reserve stock; payment redirect does not confirm payment; verified payment does not mean collection is ready; physical fulfilment decrements stock. Returns do not imply a completed monetary refund.

Google OAuth, customer profile editing, shipping, appointment slots, pickup codes, ML forecasting and a language-model assistant remain future work. Merchant onboarding, real Supabase/SMTP setup and production acceptance require configured services. See DEPLOYMENT.md for the deployment roles and remaining activation steps.
