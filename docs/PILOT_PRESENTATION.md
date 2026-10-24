# Honor first presentation pilot

Start at `/pilot` on the existing Honor storefront deployment. Use the inventory walkthrough at `/demo#/dashboard` for the meeting. This is an interactive presentation pilot, not an operational deployment for recording live business stock.

## What to say

“Honor focuses on inventory: what is available, where it is, who can change it and how each movement is recorded. Staff access and the customer shop support that inventory record. This first walkthrough starts empty so we can review the workflow before adding the business's actual stock.”

## Five-minute route

1. **Inventory overview** — open the walkthrough. Show available stock, stock attention and the empty product state. No products or sample staff/customer records have been seeded.
2. **Products and receiving** — use the guide to open Products, then Receive stock. Review product information, quantity-based goods, serialized devices and IMEI entry. Do not invent stock for the meeting. Receiving needs configured products and locations; the empty preview is not evidence of a completed receiving transaction.
3. **Movement history** — show where receipts, transfers, sales and adjustments are reviewed. No fabricated history is added.
4. **People & access** — inspect roles, permitted locations and the access editor. The preview editor changes only browser records and sends no invitation. Explain that the connected backend has separate administrator-controlled assignment and temporary-password replacement rules that still need hosted acceptance testing.
5. **Customer shop** — open the customer link. Show the opening-soon shop and separate customer signup/sign-in/recovery screens. Explain that real accounts, stock reservations and payments remain inactive until the service connections are complete.

The walkthrough guide can be collapsed for a cleaner screen. The existing profile menu includes **Reset empty preview** for clearing this browser's preview records. It does not reset Supabase or production stock.

## What is working for the presentation

- A shareable introduction and chapter links on `/pilot`.
- An interactive browser workspace with navigation, empty inventory screens, product/receiving forms, staff role layout and local preview operations.
- Separate customer and staff entry points; customer forms accept focus and input while connection status is shown honestly.
- A first-party Vercel deployment; no new project, paid service or demo password is required.

Use preview details only. Browser-local preview data is not a secure shared business database. No backend login is bypassed: `/demo` has no access to authenticated API records and `/workspace` keeps its normal sign-in controls.

## Connected pilot activation after the meeting

The presentation should not be described as production-ready or as an already-running shared stock system. Backend hosting access and credential authorization remain unresolved. Migration 0005 is prepared and tested but not yet applied to the hosted database. Real staff verification, notification delivery, payment processing and receipt flows have not passed hosted acceptance tests.

After the business agrees on the workflow: confirm its administrator, locations, real opening stock, merchant country/currency, payment account and who authorizes refunds. Then finish the service connection and test the complete workflows with the business. See [the security work plan](SECURITY_WORK_PLAN.md).
