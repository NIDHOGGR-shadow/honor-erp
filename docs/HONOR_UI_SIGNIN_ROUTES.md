# HONOR website, sign-in and visual integration

This document explains the actual code integration introduced by PR #20. The visible brand on customer and team screens is **HONOR**.

## One website, two entrances

| Person | Website route | Can do |
|---|---|---|
| Customer | `/` / `?view=login` / `?view=signup` | Browse approved products, sign in, buy available priced stock, view orders and receipts |
| Staff or store owner | `/workspace` | Sign in with assigned staff identity; view only authorized product, branch, stock, sales and administrative operations |

Both screens call the **existing backend API**. The code uses existing customer authentication and authenticated staff sessions, company membership, owner invitations, authorization checks and stock/checkout rules. This is **not** two independent stores or two independently maintained product databases.

The public store must never link to a public staff-registration form. Knowing `/workspace` does not grant access. Customers cannot self-promote: staff role and company permissions must be checked server-side for every protected operation. Staff activation and password recovery remain available only through the existing secure flows. This PR makes NO password-policy or authentication-endpoint changes.

## Layout implementation

- **Storefront:** real product-led category navigation; photo-first grid cards; responsive real-product hero; empty states for absent catalogue; focused customer account forms. No illustrative product is inserted as stock.
- **Staff:** neutral compact navigation, the actual product list with real All/Published/Drafts/Low-stock tabs, real product photos, search and category filtering; unchanged receiving, transfers, order and staff actions.
- **Staff login:** plain HONOR wordmark, light editorial background, a single clear email/password form, unobtrusive recovery/invitation access. Customer login is visually related but remains on the customer store.

Product images are `object-fit: contain`, with responsive image spaces: desktop hero 8:5 (image column), mobile hero 4:3, cards square. Product prices and availability still come exclusively from the authenticated shop catalogue; the public store cannot create a stock balance.

## Known limits and next validation

This is a real React/CSS layout change to the existing application; it is **not yet** a full replacement with every standalone prototype page. Operations, reporting and finance require their own work and should not show made-up figures. The present category navigation is filtered using the existing storefront query system; individual category-specific URL routes are a subsequent routing change.

Before declaring the design visually approved, inspect the preview deployment at 360px, 390px, tablet, and 1360px or 1440px. Check customer sign-in, registration, recovery, staff sign-in, invitation/recovery, product management, and checkout on a permitted non-production account.

Never interpret Vercel build success as proof of visual parity or successful login. Do not put test customers, fake device prices, sample stock or fabricated reports on production.
