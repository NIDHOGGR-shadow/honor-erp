# HONOR device-image library — Ikeja first

This change is an **assisted product-entry tool**, not a data import into production.

## What has been prepared

- 142 manufacturer-listed HONOR model names grouped into Phones, Laptops, Tablets, Wearables, Earwears and Accessories.
- 26 first-party manufacturer image-link **candidates** (links require in-app availability, exact product match, regional configuration and usage-rights review).
- The product picker prioritizes models appearing on HONOR Nigeria's public catalogue, but this does **not** establish availability in Ikeja.\n- Each model has an official manufacturer catalogue reference. Models without a matched image display "Picture to be confirmed"; we intentionally do not substitute a similar-looking model.
- There are **no prices, quantities, SKUs, branch addresses or customer sales** in the reference library.
- A searchable authenticated picker under Products lets an authorized manager choose a model to prefill the existing product form. Users must still supply SKU and commercial details, review its photo and explicitly save.
- An unpublished product can have an unset selling price (stored as zero in the current API, displayed as "Not priced" in staff and never purchasable). Publication requires a positive selling price. Stock is **not** invented and must be received by the approved stock workflow.

## Ikeja only for the first pilot

- Keep one **real, administrator-created Ikeja location** in company data. We do not create or guess the location/address.
- When a company has exactly one location, the workspace shows its actual name instead of a needless location selector.
- Keep the multi-location backend and transfer logic intact for possible expansion; do not create fictional Yaba/other branches just for a screenshot.
- If an administrator later creates more branches, the existing location selector reappears.

## Simple language for actual staff

- **Products:** the devices you sell, their photos, models and selling prices.
- **Draft:** product saved for staff to finish, not visible for purchase.
- **Published:** product made visible in the online shop. Availability still comes from real stock.
- **Add stock / Receive stock:** record the items that physically arrived in Ikeja. Quantity increases through a traceable stock receipt.
- **Transfers:** movement between different locations. Not needed while Ikeja is the only location.
- **Orders:** online orders, paid status, collection and receipts.
- **Point of sale (later):** recording in-person counter purchases; do not pretend online checkout already implements POS.
- **People & access / Staff accounts:** business owner chooses who can view inventory, adjust prices and handle orders. Customers signing up for the online shop do not become staff.
- **Security:** keep employee accounts private; first-time temporary passwords must be replaced.

## Before putting pictures on a public commerce site

1. Confirm the retailer has permission to reuse HONOR marketing assets. External manufacturer CDN URLs can change or block hotlinking.
2. Inspect the candidate image: right model, memory/colour/market, correct crop and no trademark confusion.
3. Store approved assets on a controlled CDN/object store and set the relevant product image URL through the product form.
4. Confirm exact selling price, SKU, owner-approved published status and real Ikeja stock.
5. Test product → published shop → cart → reservation/payment verification/collection.

The reference list is a broad curated **starting inventory of model names**, not a claim to cover every global/historical HONOR variant. Even where source catalogue contains a model, **that does not establish that the Ikeja shop sells it**.

Official category references (accessed 10 Nov 2026):
https://www.honor.com/global/phones/
https://www.honor.com/global/laptops/
https://www.honor.com/global/tablets/
https://www.honor.com/global/wearables/
https://www.honor.com/global/audio/
https://www.honor.com/global/accessories/
