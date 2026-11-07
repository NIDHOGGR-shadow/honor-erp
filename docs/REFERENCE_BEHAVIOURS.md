# HONOR China / UK behaviour reconstruction

Source capture: 7 November 2026. REA 6.8.0 analysed the public frontend files. These observations describe shipped browser code, not private backend internals or proof that every branch executes.

| Source observation | Nigeria implementation | Evidence |
| --- | --- | --- |
| China slider uses a timer and suspends rotation while hovered. | Five-second hero rotation with hover/focus pause, manual controls, explicit pause/play, hidden-tab suspension and reduced-motion preference. Empty inventory rotates the existing reference photos without inventing prices or stock. | `hshop.honorfile.com/2026102814/js/echannel/index.js`, `Slider.prototype.auto` and `ec.index` setup. The five-second interval and accessibility controls are local adaptations. |
| UK stores three recent searches, with a 366-day expiry. | Three normalised, deduplicated search terms; expiring, versioned browser storage scoped to the shop; replay/clear actions and suggestions from the real catalogue. No cross-domain cookie is needed. | UK `clientlib-base.min.629e278ff443a75605ae5171eeb628e8.js`, `searchUtils`, original lines 2207–2320. |
| UK cart success dialog displays the selected variant and offers cart/checkout navigation. | Confirmation after an available item is added, showing its exact variant, quantity and local NGN unit price. Customers can continue shopping or open their cart. Existing reserve-and-pay checks remain responsible for stock and final prices. | Same UK bundle, `addCartItemDialogManagerUtil`, original lines 7137–7696; `addCartManagerUtil`, lines 7699–8951. |

## Analysis coverage

- China: two selected scripts parsed, 7,703 AST nodes, no parse failures.
- UK main bundle: 1,642,546 bytes and 376,548 AST nodes parsed with no parse failures after raising the deadline. Whole-bundle semantic output remained limited by alias and retention budgets.
- UK focused cart/search/account analysis: five exact top-level declarations retained with original offsets, 9,837 AST nodes, no parse failures and no semantic-capacity truncation. Unresolved dynamic calls remain unknown.
- No overseas account, promotion, analytics, risk-control or payment code is executed or connected by this implementation.
- All Nigerian product prices and availability continue to originate from the staff-managed catalogue. These findings do not import inventory, add policy-backed services or establish a functioning voucher/bundle engine.

## Validation

Check recent-search expiry, malformed storage, deduplication and exact variant suggestions. Check cart confirmation uses the current catalogue amount and never claims a reservation. Check manual carousel controls, pause/play, focus/hover and reduced-motion behaviour. Hosted acceptance of actual sales still needs business-published inventory and merchant setup.
