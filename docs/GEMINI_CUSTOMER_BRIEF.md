# Build Honor's customer interface

Act as a senior frontend engineer and product designer. Build the customer-facing interface for **Honor**, an inventory-first business product with a company workspace and connected customer shop. Deliver reviewable source that we can improve and integrate later.

## Scope and references

I will provide the existing main page, login/signup design or source. Treat them as references, preserve their branding, and reuse compatible components. If they have not been provided, build the customer area as an isolated module with configurable links to the main/login/signup pages. Do not invent a replacement main website or overwrite the staff dashboard.

Use Next.js App Router, React, TypeScript and Tailwind CSS, compatible with the existing Next.js 16/React 19 workspace. The intended app is `apps/storefront` in `NIDHOGGR-shadow/honor-erp`; shared customer components/API code already exist in `src/online/Storefront.tsx` and `src/online/api.ts`. Inspect them if supplied. Extend suitable existing work instead of replacing its checkout behaviour blindly. If repository source is unavailable, deliver a self-contained customer module with documented integration seams.

## Design

Use Honor branding, deep emerald accents, light neutral backgrounds, readable typography and generous spacing. Keep the interface calm and responsive. Avoid crowded dashboards, excessive cards, carousels, fake urgency, invented testimonials or decorative statistics. Support keyboard navigation, visible focus, labelled inputs, helpful validation and accessible dialogs. Test mobile, tablet and desktop layouts.

**Do not add products, prices, stock, orders, customers, reviews or business addresses.** Start with empty data. Show genuine loading, empty, error, unavailable and signed-out states. Skeletons may indicate loading but must not masquerade as actual products. Sample fixtures belong in tests only and must never seed the running app.

## Customer screens

1. Shop/catalogue: navigation, product search, filters/sorting that fit the supplied catalogue, and a useful “No products available yet” state.
2. Product details: images, documented attributes, variants, current availability and price from data; handle missing/unpublished products correctly.
3. Cart: quantity controls, removal, empty state and order summary. Cart contents alone do not reserve stock. Persist only nonsensitive product IDs/quantities if necessary.
4. Customer authentication UI: email sign-in/signup, name/email, password visibility, recovery and Google sign-in. Reuse the provided auth pages where possible. With no configured auth adapter, clearly show that sign-in is not connected; never fake successful login, verification or registration.
5. Account centre: profile, own order history, order detail/status, collection details and sign-out. Provide empty-order and expired-session states. Show “No orders yet” only after a successful empty response, not after an API failure.
6. Checkout review: contact information, server-validated totals, supported collection location and a hosted-payment handoff. Collection is the implemented fulfilment method; shipping must not be presented as working. Support pending, failed, expired, cancelled and confirmed order states.

## Integration boundaries

This assignment is frontend work. Leave real Supabase setup, customer-account endpoints, OAuth configuration, payment credentials, webhooks and database changes to our integration work. Do not create a second backend or a competing authentication system.

Keep a typed service layer for catalogue, customer authentication/profile/orders and checkout. Default it to explicit unconfigured/empty responses without fabricated success. Document which adapters are implemented and which remain TODO. Do not present proposed endpoints as existing APIs.

Honor currently has `/api/v1/storefront/{slug}` and checkout/order functions in the existing API client. It uses integer minor-unit prices, server-calculated totals, idempotent checkout, protected order access and HttpOnly sessions. Reuse existing contracts when source is available; otherwise document required request/response types for review. The backend decides price, stock availability, permissions and payment state.

Customer login never grants staff access. Company administrators/managers control selling prices. Customers see public catalogue data and their own orders; supplier costs and other customers' records must never be exposed.

Do not put passwords, identity tokens, service-role keys or payment secrets in localStorage or client code. Do not build a card/CVV storage form. Payment entry belongs to hosted checkout. A browser redirect is not proof of payment. Google sign-in and checkout buttons must use typed adapters or display an honest unavailable state until connected.

Guest checkout can remain available. A customer account adds profile/order history and repeat-purchase convenience. Do not add a pretend chatbot or hardcoded AI recommendations; leave a documented extension point for a future catalogue-grounded assistant.

## Delivery and acceptance

Return the complete source, route map, reusable components, typed interfaces, lockfile, run/build instructions and a short integration TODO list. Use a separate branch such as `feat/customer-storefront-gemini`; do not merge or deploy into production. If a repo patch cannot be supplied, provide a source ZIP with the same information.

Verify that the app builds, empty catalogue/cart/orders render correctly, navigation works, unconfigured auth/payment cannot show fake success, and forms work with keyboard and small screens. Provide screenshots and describe any checks you could not complete. Distinguish finished frontend behaviour from pending backend integration. No credentials are required for this design task.
