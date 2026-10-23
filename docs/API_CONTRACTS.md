# Honor API: implemented surface

The FastAPI implementation lives in `services/backend/honor`. When running, `/api/docs` and `/api/openapi.json` expose its request schemas. The base path is `/api/v1`. These are local implementation contracts, not a claim that an online API has been deployed.

## Session and scope

Sign-in sets an opaque `honor_session` HttpOnly cookie. Protected requests include it; staff requests additionally set `X-Company-Id`. The backend checks current membership, location permissions, role and company-scoped session revocation. A supplied company ID or client-side role never authorises access by itself. Server-managed identity tokens stay encrypted on the server.

State-changing stock operations and public checkout creation require an `Idempotency-Key` of 16–128 characters. Reuse the key after a timeout. A changed payload/actor/operation under the same company/key returns a conflict. The typed frontend client preserves pending command keys across a reload without storing form contents.

| Route                                                                                     | Implemented behaviour                                                                                                                   |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`, `/auth/register`, `/auth/exchange`, `/auth/logout`                    | Managed identity and opaque application sessions; explicit development adapter for tests.                                               |
| `POST /auth/password`, `/auth/recover`, `/auth/recovery-password`, `/auth/reauthenticate` | Password changes/recovery and recent verification.                                                                                      |
| `POST /auth/mfa/enrol`, `/auth/mfa/verify`                                                | Supabase authenticator enrollment/challenge/verification.                                                                               |
| `GET /me`                                                                                 | User, active companies, roles and authenticator/session information.                                                                    |
| `POST /companies`                                                                         | Create a company under the verified signed-in user.                                                                                     |
| `GET, POST /locations`                                                                    | Scoped location reads and administrator creation, including collection address/permission.                                              |
| `GET /transfer-destinations`                                                              | Company location names for authorised transfer operators; no other locations' stock or costs.                                           |
| `GET, POST /products`, `PUT /products/{id}`                                               | Catalogue, SKU uniqueness, publication, price and tracking policy; cost fields redacted for non-manager roles.                          |
| `GET /stock/balances`, `/stock/movements`, `/stock/serials`                               | Company/location-scoped stock facts, history and serial state.                                                                          |
| `POST /receipts`, `/adjustments`                                                          | Atomic receipt or authorised reasoned quantity adjustment. Serial stock uses unit-specific workflows.                                   |
| `GET, POST /transfers`, `POST /transfers/{id}/receive`                                    | Dispatch into transit and complete destination receipt.                                                                                 |
| `GET /orders`, `POST /orders/{id}/fulfil`                                                 | Staff order queue and idempotent fulfilment after verified payment.                                                                     |
| `POST /orders/{id}/returns`                                                               | Inspected line return, existing serial reuse, excess-return prevention and restock/quarantine disposition. Monetary refund is separate. |
| `GET /team`, `PATCH /team/{user}`, `POST /team/{user}/sign-out`, `/recover`               | Company administrator access changes, company-scoped session blocking and recovery requests.                                            |
| `POST /invitations`, `/invitations/accept`                                                | Expiring email-bound role/location invitations.                                                                                         |
| `GET /audit`, `/jobs`                                                                     | Administrator audit and queue status; no secret payloads.                                                                               |
| `GET /storefront/{slug}`                                                                  | Published public catalogue, eligible collection availability and checkout configuration.                                                |
| `POST /storefront/{slug}/checkouts`                                                       | Recalculate current prices; reserve a complete cart at one collection location; create private order access.                            |
| `GET /customer/orders/{id}`                                                               | Private customer order status, lines and collection details. Requires `X-Order-Key`.                                                    |
| `POST /checkouts/{id}/payment`                                                            | Hosted payment initiation; requires `X-Order-Key`.                                                                                      |
| `POST /customer/orders/{id}/cancel`                                                       | Release an unpaid reservation; requires `X-Order-Key`.                                                                                  |
| `POST /payment-webhooks/{provider}`                                                       | Provider signature validation, durable event inbox and deduplicated processing. No staff cookie required.                               |
| `POST /checkouts/{id}/simulate`                                                           | Development-only payment simulation; forbidden by production configuration.                                                             |

## Stock receipt example

```json
{
  "product_id": "product-uuid",
  "location_id": "location-uuid",
  "quantity": 2,
  "serials": ["CHECKED-SERIAL-1", "CHECKED-SERIAL-2"],
  "reason": "Supplier delivery reference"
}
```

Quantities must be positive JSON integers, not strings, booleans or fractions. Quantity-tracked products omit serials; serial-tracked products require exactly one unique serial per unit. There is no partial receipt commit if one serial conflicts.

## Customer checkout example

```json
{
  "customer_name": "Customer name",
  "email": "customer@example.test",
  "client_token": "a-cryptographically-random-value-of-at-least-32-characters",
  "lines": [{ "product_id": "published-product-uuid", "quantity": 1 }]
}
```

The customer browser generates the client token and retains it as the order credential. Prices, totals, company, fulfilment location and payment status are resolved by the server. A cart alone does not reserve stock. A checkout response does not prove payment. A late successful payment rechecks stock and can enter an exception/refund-review state without overselling.

## Errors and boundaries

Errors use a human-readable `detail`, a suitable 4xx/5xx status and an `X-Request-Id`. Validation errors do not echo passwords or tokens. Use 401 for missing/expired identity, 403 for denied access, 404 for unknown/inaccessible records, 409 for state/availability/idempotency conflicts, 422 for invalid input and 429 for rate limits. Database/provider failures do not mark payments or stock commands successful.

The current API limits catalogue reads to 1,000 products, staff order/transfers to 200 records and movement history to at most 500 per request. Cursor pagination, imports, persisted stock counts, approval requests, purchasing workflows, partial transfer discrepancies, automatic refunds, shipping, valuation policies, forecast endpoints and LLM tools remain planned extensions. The older browser demo contains additional screens that are not connected implementations of those features.
