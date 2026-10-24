# Honor: the product and the current pilot

Honor is an inventory system for a business, with a staff workspace and a connected customer shop. Inventory is the core: what is available, where it is, who moved it and which physical unit was handed to a customer. Orders, customer accounts and payments support that record.

## Who uses it

- A company administrator creates the business workspace, locations and staff permissions. Administrators can suspend access while retaining stock and audit history.
- Stock staff receive, adjust and transfer stock within permitted locations. Managers and sales staff receive their own company-controlled permissions.
- Customers browse published products, create accounts, place collection orders, track payment and download private receipts. Customer signup grants no access to company inventory or staff administration.

The business operating Honor should control its production hosting, merchant accounts, email delivery and administrator access. Developer support access should be granted by the business. No paid hosting has been activated by the free-pilot configuration.

## Main workflow

1. Register and verify an individual account.
2. Create the business workspace or accept an invitation. The workspace creator becomes that company's administrator.
3. Add locations, products and opening stock when the business is ready. Initial setup adds no sample inventory.
4. Publish products to the company shop at `/shop/<company-slug>`. A preferred single-company home page can additionally use `HONOR_STORE_SLUG`.
5. A customer reserves available stock; the server controls quantities and payment state. Staff record physical collection and the available serial/IMEI at handover. Receipts retain the relevant device information privately.

## Refinement delivered in this pass

- A missing shop now renders an explicit opening-soon page with a clear staff entry, instead of an almost-empty error screen. This does not claim that commerce is active.
- Customer account availability depends on the backend connection, independently of a catalogue slug. An unconfigured shop no longer blocks account setup when the API is connected.
- Company shop URLs now have an actual Next.js route, matching the links used in the staff workspace.
- Confirmation fragments are handled on both the shop and workspace. Credentials are removed from the address bar and validated through the backend exchange; client-side claims do not grant permissions.
- Collection details no longer remain in an endless loading state when there is no shop configured.
- Disconnected account forms are visibly disabled, first-company setup explains administrator access, and staff can show or hide a password.

## What remains blocked

The live interface is available, but the Honor API has not been deployed on Render. Render could not fetch the private repository, and transferring runtime credentials still requires explicit authorization. The connected Vercel account did not expose the existing storefront project for environment-variable management during this review. The database has no company or products, so there is no real catalogue to publish yet.

After hosting access is resolved: deploy the free API with the existing restricted Supabase connection and session settings, verify `/api/health`, set Vercel's server-only `HONOR_API_ORIGIN`, and complete verified company onboarding. Keep payments disabled until the merchant integration is tested.

The free pilot has no background worker. Automatic queued email, payment-event reconciliation and scheduled reservation cleanup are not provided by this deployment. See [the free Render setup](RENDER_FREE.md). Real authenticated, stock, payment and receipt flows remain deployment acceptance gates; an opening-soon screen is not proof that those flows work.
