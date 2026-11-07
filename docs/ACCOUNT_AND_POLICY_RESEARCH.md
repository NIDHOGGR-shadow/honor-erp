# Account and policy investigation

Recorded 7 November 2026. This is an engineering investigation note, not customer policy text or an instruction to publish legal pages.

- Supabase project `uxbpiigidvmlfwysomnl` reports email authentication enabled, signup allowed and Google disabled. No provider configuration was changed.
- Customer Google sign-in needs an approved Google OAuth client, exact Supabase/application redirect configuration, verified application domains and a tested return to the customer's existing cart/account. Google profile claims must never grant staff membership.
- Before preparing a privacy notice, establish the legal operator, public privacy/support contact, actual processing purposes, retention periods, third-party processing/transfers, rights-request process and browser-storage choices.
- Current storage includes secure application sessions, session-scoped cart/checkout details and up to three recent searches with a 366-day expiry. Hosting/request logs and authentication records also need to be covered by the investigation.
- FAQ answers must come from confirmed business operations: actual collection branches, stock/price changes, payment verification, account access and order tracking. Do not invent delivery, warranty or refund promises.
- Privacy/account terms, FAQ pages, acceptance controls and Google sign-in remain investigation items. The footer update introduces none of these.

Primary references reviewed: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), and [Nigeria Data Protection Commission](https://ndpc.gov.ng/).

The deployed recommendation system is an explainable popularity/trend/price baseline. No trained recommender or language model is deployed in the shop; see `RECOMMENDATIONS.md` for the implementation and proposed later model families.
