# Buying, paying and identifying the actual device

Customers browse product models and SKUs. They do not search the company's device identifiers. A phone's serial / IMEI is recorded by staff when stock arrives; the customer sees the exact device only after staff confirm which phone was handed over.

## Customer and staff journey

1. An authorised inventory operator receives stock and scans each device's primary serial / IMEI. Duplicate identifiers within the company are rejected. No products, devices or accounts are seeded into production.
2. The buyer chooses a product and quantity. The server calculates the price and reserves available stock at one collection location. An internal device allocation prevents two buyers receiving the same phone; this allocation is hidden from the customer.
3. Hosted checkout offers the configured merchant payment methods. Paystack defaults to `card,bank_transfer`; transfer is included only for NGN/GHS orders. The merchant must activate the channel in its provider account. The buyer can make the transfer from a banking app using the provider's displayed account details. This flow does not require storing a card, linking a wallet, collecting an OPay PIN, or inventing an OPay app link.
4. A signed webhook is stored durably for the worker. The server independently verifies the transaction reference, amount, currency and success status. A return URL, screenshot or bank slip cannot mark an order paid. A private, rate-limited payment-check endpoint can recover status when the webhook is delayed.
5. After verified payment, the buyer can download a PDF purchase receipt. It lists the seller, buyer, order and payment references, dates, items, SKU, quantities, unit prices, currency, total and current payment/order status. The exact device is pending until handover. Simulated receipts are explicitly labelled.
6. At collection, staff scan the actual device. The server accepts only the correct product at the order's location, available or already reserved for that order. It rejects another buyer's reservation, wrong-location devices and duplicate scans. A replacement available phone can be selected without changing the purchased model or price.
7. Handover atomically records the sale, reduces physical/reserved stock, records the timestamp and freezes the sold identifiers on the order lines. The customer's updated private order and PDF now include those identifiers. The company can look up a device and its confirmed sale history.
8. An inspected return can put a device back into stock. Its original receipt keeps the original sale identifiers even after the live device record moves to a later order. Returns and refund-review status remain visible.

Payment confirmation does not mean collection or delivery. These documents are purchase receipts; no tax-registration details or tax-invoice claims are fabricated. Expired/cancelled reservations and late transfers follow the existing reacquisition/refund-review path; stock is never fabricated to satisfy a late payment.

## Engineering terms and plain meaning

| Engineering mechanism | Plain meaning |
| --- | --- |
| Row locks and database transactions | The last phone cannot be sold to two people; stock and the sale change together. |
| Idempotency keys | Repeating the same handover after a timeout does not issue the phone twice. A changed scan cannot reuse the old command. |
| Tenant scoping and role/location checks | Company staff see only their permitted company and locations. Device search is for ADMIN, MANAGER and STOCK roles. |
| Opaque HttpOnly sessions and private guest keys | A customer can download only their own receipt. Knowing an order number or email is insufficient. Guest keys travel in request headers, not download URLs. |
| Server-authoritative payment verification | The server asks the provider whether the exact amount really arrived. The browser cannot approve payment. |
| Immutable order-line snapshots | A later price edit, product rename, return or resale does not replace the original sold identifier and sale price. |
| Durable webhook inbox and outbox worker | Provider events and notification jobs survive retries or a restarted process. |
| Alembic migration 0003 | Existing databases acquire receipt timestamps, sale snapshots and payment method fields without deleting stock. Historical identifiers are backfilled only when still provable. |
| Same-origin API proxies | Customer and staff frontends communicate with the same backend while keeping credentials out of frontend builds. |

## New and changed interfaces

| API | Access and behaviour |
| --- | --- |
| `GET /api/v1/stock/serial-search?serial=...` | Authorised inventory roles; exact identifier; company/location-scoped current device and up to 50 historical sales. |
| `POST /api/v1/orders/{id}/fulfil` | Authorised staff at the order location; idempotency key; body `{ "devices": [{ "product_id": "...", "serials": ["..."] }] }`. Every serialized unit must be scanned. Quantity-only orders send an empty devices array. |
| `POST /api/v1/customer/orders/{id}/verify-payment` | Verified owner session or guest key; checks the configured provider; limited to 10 requests/minute per order/IP. |
| `GET /api/v1/customer/orders/{id}/receipt.pdf` | Verified owner or guest key; available only after verified payment; PDF attachment with no-store caching. |
| `GET /api/v1/orders/{id}/receipt.pdf` | Staff in the correct company/location; same server-generated receipt. |
| `GET /api/v1/storefront/{slug}` | Adds configured `payment_methods`. Continues to omit IMEIs, serials, internal cost and tenant identifiers. |
| Private customer order/history | Adds receipt availability, timestamps, purchased SKU and only the fulfilled line's frozen identifiers. |

## Activation and limits

The feature code is separate from activating real services. Before business use:

- Select the Honor Supabase project/organization. Novaxis's two free slots are occupied; neither unrelated project is paused, reused or upgraded automatically.
- Deploy the FastAPI service and outbox worker with restricted PostgreSQL access, managed identity, secure cookies, production origins and migration `alembic upgrade head` through `0003`.
- Configure the chosen pilot company's merchant ID, provider secret and signed webhook endpoint in server-side secret fields. For Paystack set `HONOR_PAYMENT_PROVIDER=paystack`, `HONOR_MERCHANT_COMPANY_ID`, `HONOR_PAYMENT_SECRET` and `HONOR_PAYSTACK_CHANNELS=card,bank_transfer`. Confirm transfer is enabled on the merchant account.
- Connect `HONOR_API_ORIGIN` to the frontends. Vercel's storefront project is `honor-storefront`; runtime project settings install the locked root/workspace dependencies with `cd ../.. && npm ci --include=dev`.
- Verify real provider test transactions, delayed/duplicate webhooks, expired reservations, receipt downloads and physical handover before switching to live merchant credentials.

This pilot uses one explicitly configured merchant company. Supporting independent merchant payouts for many companies requires separate merchant onboarding and per-company secret storage; changing a company setting in the browser does not create a merchant account. A direct OPay wallet/deep-link integration is not shipped.

Official provider references: [Paystack payment channels](https://paystack.com/docs/payments/payment-channels/), [transaction initialization and verification](https://paystack.com/docs/api/transaction/), [webhook verification](https://paystack.com/docs/payments/webhooks/).
