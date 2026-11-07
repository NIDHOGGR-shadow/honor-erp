# Storefront recommendations: research and first implementation

Reviewed 6 November 2026. The aim is to help customers find an available, suitable device at a price they can afford.

## What the retailers disclose

| Retailer | Verified evidence | What we can learn | Limits |
| --- | --- | --- | --- |
| HONOR UK | Its product page exposes variant selection, bundles, gifts, vouchers, points, cart and stock notifications. Its platform notice describes browsing/click/search records and order information. | Keep campaign eligibility separate from product recommendation and availability. | These pages do not disclose a recommender architecture, training method or weights. Some offer copy contains old dates; it is not a source of current Nigerian offers. |
| HONOR US | No United States storefront is listed in the official country selector examined, and the proposed /us/ page could not be verified. | Use verified UK/China stores as HONOR references and US retailers for the technical comparison. | This does not establish that US consumers cannot obtain HONOR products from third parties. |
| Amazon | Amazon Science documents item-to-item collaborative filtering, where related purchases generate candidates for a customer. | Learn relationships between products from purchases; use them to recommend suitable alternatives or complements. | The 2017/2019 publications describe disclosed approaches, not Amazon's complete current stack. |
| eBay | Engineering articles describe two-tower neural retrieval, nearest-neighbour search, and a subsequent wide-and-deep ranker using browsing/search history and item/user features. | Separate candidate generation from ranking; evaluate recommendations with click and purchase outcomes. | These are documented production designs from particular publications, not proof that every eBay module uses the same model today. |
| Walmart | Its technical conference lists product knowledge graph embeddings for ecommerce recommendations; its customer page describes personalised picks, trends and frequently bought together. | Product relationships can improve recommendations, especially related products and complements. | The conference agenda alone does not disclose the full deployed architecture or its performance. |

## Model families and the actual job they perform

| Model or method | Inputs | Example output | Appropriate stage for Honor Nigeria |
| --- | --- | --- | --- |
| Popularity and trend ranking | Verified purchases and timestamps | Popular this week; selling momentum | First release; requires sales evidence for badges. |
| Content-based similarity | Category, model, RAM/storage, features, price, region | Similar phones within a budget | Next step after product metadata is sufficiently complete. |
| Item-to-item collaborative filtering | Co-purchases and customer interactions | Customers interested in this also considered that | Later, after enough diverse interactions exist. |
| Association rules / co-purchase statistics | Completed baskets | Frequently bought together | Later; require adequate support, compatible accessories and real component stock. |
| Two-tower neural retrieval | User/context history plus product representations | A shortlist of relevant products | Only if catalogue size and interaction volume justify learned retrieval. |
| Learning-to-rank / neural rankers | Candidate relevance, history, price, availability, outcomes | Personalised ordering of the shortlist | Later, compare against the simple baseline before release. |
| Campaign rules | Approved discount, eligible SKUs, dates, stock, limits | A valid gift, voucher or bundle price | Independent feature; a recommendation must not invent a discount. |

Budget selection does not require a trained model. A price filter or category-relative rule is sufficient. Low price alone does not establish quality or best value. A phone and a charging cable should not compete as equivalent budget choices.

## Implemented baseline

- The existing public catalogue returns optional ordered product IDs; no customer identifiers, order counts, private costs or serials are included.
- Only published products with available collection stock can enter recommendations. A refreshed browser catalogue updates availability and rankings; checkout still performs the authoritative reservation and price checks.
- **Popular this week:** paid, non-exception orders from the last seven days; at least three distinct orders and three net units per SKU. Returned quantities are subtracted; unpaid, cancelled, refunded, refund-review and future-dated records are excluded.
- **Selling fast:** popular candidates whose recent net units exceed the preceding seven days by at least 25%. A new SKU with no prior-week sales still needs three qualifying orders. This measures observed momentum, not a forecast or a claim about concurrent shoppers.
- **Budget picks:** the lowest-priced quarter of available models in each category, with at least one choice per category and one cheapest available variant per model/market. This is a proposed starting rule, not a learned ranking or a claim about HONOR's algorithm.
- **Featured:** eligible trending products, then recent popular products, then remaining available products. Sold-out items remain browsable but do not receive recommendation badges.
- **Cold start:** no invented popularity. Without qualifying sales, only catalogue and budget discovery appear. Reference photos are clearly labelled previews without prices, purchase controls or assertions of Nigerian stock.
- No additional paid recommendation service, tracking vendor, database table, RLS change or schema migration is introduced.

## Learning and evaluation before a trained model

Record impressions with the recommendation's version, viewed products, additions to cart and completed purchases, subject to the product's agreed privacy settings. Treat a purchase as confirmed only from the order's verified payment state. Preserve source, timestamp, SKU and available-at-display context. Do not treat an unexposed item as a negative preference.

Keep search and declared budget as strong immediate signals. Start content-based recommendations from good product attributes, then compare collaborative or hybrid approaches when data exists. Reserve some exposure for new products so historical popularity does not permanently hide them.

Use time-based train/validation splits. Measure coverage and relevance offline, then test against the rules baseline using purchase conversion, suitable-product discovery and latency; monitor returns/cancellations and unavailable recommendations. Do not choose a model solely for clicks or deploy without measurable improvement. Determine training-data sufficiency from coverage and evaluation; there is no universal sales-count threshold. AWS's specific Trending-Now product requires 1,000 interactions, which is a service requirement rather than a universal recommender rule.

## Primary sources

1. [HONOR official country selector](https://www.honor.com/global/choose-country-region/).
2. [HONOR UK product purchase flow](https://www.honor.com/uk/phones/honor-400/buy/).
3. [HONOR UK platform notice, updated 30 October 2026](https://agreement.itsec.honor.com/asm/agrFile/getHtmlFile?agrNo=1024&branchId=0&country=gb&langCode=en-gb).
4. [Amazon: recommendation algorithm history](https://www.amazon.science/the-history-of-amazons-recommendation-algorithm?community_post=true).
5. [Amazon: Two Decades of Recommender Systems](https://cdn.amazon.science/76/9e/7eac89c14a838746e91dde0a5e9f/two-decades-of-recommender-systems-at-amazon.pdf).
6. [eBay: two-tower retrieval](https://innovation.ebayinc.com/stories/building-a-deep-learning-based-retrieval-system-for-personalized-recommendations/).
7. [eBay: personalised ranking](https://innovation.ebayinc.com/stories/evolving-recommendations-a-personalized-user-based-ranking-model/).
8. [eBay: multimodal item embeddings](https://innovation.ebayinc.com/stories/beyond-words-how-multimodal-embeddings-elevate-ebays-product-recommendations/).
9. [Walmart: recommendation research agenda](https://tech.walmart.com/content/walmart-global-tech/en_us/flagship-conferences/ai-at-walmart.html).
10. [Walmart: Top picks for you](https://www.walmart.com/cp/top-picks-for-you/7188034).
11. [Google: content-based filtering](https://developers.google.com/machine-learning/recommendation/content-based/basics).
12. [Google: collaborative filtering](https://developers.google.com/machine-learning/recommendation/collaborative/basics).
13. [Google: recommendation model types](https://docs.cloud.google.com/gemini-enterprise-cx/ai-commerce-search/models).
14. [TensorFlow: retrieval and ranking](https://www.tensorflow.org/recommenders/examples/basic_retrieval).
15. [AWS: Trending-Now](https://docs.aws.amazon.com/personalize/latest/dg/native-recipe-trending-now.html).
