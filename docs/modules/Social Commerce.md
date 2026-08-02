\# Module 7: Social Commerce



\*\*Document Version:\*\* 1.0.0

\*\*Last Updated:\*\* 2026-07-21

\*\*Status:\*\* Active

\*\*Owner:\*\* Product Lead



\---



\## 1. Overview



\### 1.1 Module Description



The Social Commerce module provides integrated shopping capabilities across social media platforms, enabling organizations to sell products directly through social channels without friction. It includes end-to-end product catalog management, multi-platform integration, shoppable content creation, commerce analytics, and performance optimization tools — all managed from a single unified interface.



This module transforms social media from a passive marketing channel into an active, measurable revenue channel, enabling seamless shopping experiences where customers already spend their time. By connecting product data, content publishing, and sales attribution in one place, it eliminates the operational gap between social engagement and commercial outcomes.



\### 1.2 Module Objectives



| Objective | Description | Success Metric |

|-----------|-------------|----------------|

| \*\*Platform Integration\*\* | Integrate with major social commerce platforms | Instagram Shopping, Facebook Shops, TikTok Shop live at launch |

| \*\*Product Management\*\* | Centralized product catalog management across all platforms | <5 minute sync time per update cycle |

| \*\*Revenue Generation\*\* | Enable direct, attributable social commerce revenue | Trackable sales attribution per content piece and platform |

| \*\*Performance Analytics\*\* | Measure and report commerce performance in real time | ≤1 hour data update latency |

| \*\*Customer Experience\*\* | Deliver seamless, low-friction shopping experiences | <10 second checkout completion time |

| \*\*Content Attribution\*\* | Link individual content pieces to sales outcomes | Multi-touch attribution model with ≥99% accuracy |

| \*\*Inventory Integrity\*\* | Prevent overselling across all connected platforms | Real-time inventory sync with conflict resolution |



\### 1.3 Target Users



| Persona | Role | Primary Use Cases |

|---------|------|-------------------|

| \*\*Chidi\*\* | Head of Marketing | Commerce strategy, revenue tracking, ROI reporting, budget decisions |

| \*\*Bola\*\* | Social Media Manager | Product tagging, shoppable post creation, content commerce optimization |

| \*\*Ifeoma\*\* | Agency Owner | Multi-client commerce management, aggregate performance reporting |

| \*\*Kemi\*\* | Content Strategist | Commerce content optimization, attribution analysis, best-performing content identification |

| \*\*Emeka\*\* | Digital Analyst | Commerce data exports, custom analysis, conversion funnel review |



\### 1.4 Module Scope



\*\*In Scope:\*\*

\- Product catalog creation, management, and cross-platform sync

\- Platform integrations: Instagram Shopping, Facebook Shops, TikTok Shop

\- Product tagging in posts, stories, and reels

\- Commerce analytics and attribution reporting

\- Order tracking and status management

\- Inventory management with low-stock alerts

\- E-commerce platform sync (Shopify, WooCommerce — roadmap)



\*\*Out of Scope:\*\*

\- Payment processing (handled by platform-native checkout)

\- Logistics and physical fulfillment

\- Returns and refunds management (deferred to e-commerce platform)

\- Customer identity management (handled by MOD-008)



\### 1.5 Dependencies



| Dependency | Module | Purpose |

|------------|--------|---------|

| \*\*User Management \& Organization\*\* | MOD-008 | Authentication, authorization, tenant context, RBAC enforcement |

| \*\*Social Publishing \& Scheduling\*\* | MOD-002 | Product tagging within scheduled and published content |

| \*\*Analytics \& Reporting\*\* | MOD-004 | Commerce performance reporting, dashboard integration |

| \*\*Engagement Hub\*\* | MOD-003 | Handling customer commerce inquiries from DMs and comments |

| \*\*Notification Service\*\* | MOD-011 | Delivery of commerce alerts (orders, inventory, milestones) |



\---



\## 2. User Stories



\### 2.1 Primary User Stories (P0 — Must Have)



| ID | User Story | Priority | Acceptance Criteria |

|----|------------|----------|---------------------|

| \*\*US-COM-001\*\* | As a Head of Marketing, I want to manage my product catalog centrally so I can sell consistently across multiple social platforms without duplicating effort. | P0 | Products created once sync to all connected platforms within 5 minutes |

| \*\*US-COM-002\*\* | As a Social Media Manager, I want to tag products in my social content so customers can shop directly without leaving the platform. | P0 | Product tags appear correctly on Instagram, Facebook, and TikTok |

| \*\*US-COM-003\*\* | As a Head of Marketing, I want to track social commerce revenue by platform and content piece so I can measure the ROI of my social content investment. | P0 | Revenue data attributed per platform and content, updated within 1 hour |

| \*\*US-COM-008\*\* | As a Social Media Manager, I want to create shoppable posts so customers can complete a purchase without being redirected away from their feed. | P0 | Shoppable posts with native checkout tested and live on Instagram and Facebook |



\### 2.2 Secondary User Stories (P1 — Should Have)



| ID | User Story | Priority | Acceptance Criteria |

|----|------------|----------|---------------------|

| \*\*US-COM-004\*\* | As a Social Media Manager, I want to see which products are selling best so I can optimize my content strategy around high-performing items. | P1 | Top products ranked by revenue and units sold, filterable by date and platform |

| \*\*US-COM-005\*\* | As an Agency Owner, I want to manage commerce settings and catalogs for multiple clients from a single dashboard so I can scale efficiently. | P1 | Workspace switcher supports multi-client commerce views with isolated data |

| \*\*US-COM-006\*\* | As a Content Strategist, I want to see which specific content pieces drive the most sales so I can replicate and scale what works. | P1 | Content attribution table links each post to clicks, conversions, and revenue |

| \*\*US-COM-007\*\* | As a Head of Marketing, I want to integrate with my existing e-commerce platform so inventory and product data stay in sync automatically. | P1 | Bidirectional sync with Shopify or WooCommerce within 5-minute update cycle |



\### 2.3 Tertiary User Stories (P2 — Nice to Have)



| ID | User Story | Priority | Acceptance Criteria |

|----|------------|----------|---------------------|

| \*\*US-COM-009\*\* | As a Head of Marketing, I want to understand customer shopping behavior on social platforms so I can optimize the customer journey from discovery to purchase. | P2 | Funnel view from impression → click → cart → checkout available per platform |

| \*\*US-COM-010\*\* | As a Digital Analyst, I want to export raw commerce data in CSV or Excel format so I can perform custom analysis outside the platform. | P2 | Export function available for all commerce reports with configurable date ranges |

| \*\*US-COM-011\*\* | As a Head of Marketing, I want to group products into collections so I can organize catalog displays by campaign or season. | P2 | Collections creatable with custom names, assigned to platforms independently |

| \*\*US-COM-012\*\* | As a Social Media Manager, I want to generate UTM-tagged product links so I can accurately track traffic sources in external analytics tools. | P2 | UTM builder available per product, auto-appended to external checkout links |



\---



\## 3. Functional Requirements



\### 3.1 Product Catalog Management



| Requirement ID | Description | Priority | Notes |

|----------------|-------------|----------|-------|

| \*\*FR-COM-001\*\* | System shall provide a centralized product catalog shared across all connected platforms | P0 | Single source of truth |

| \*\*FR-COM-002\*\* | System shall support product creation with name, description, multiple images, price (NGN), SKU, and inventory count | P0 | All fields validated on save |

| \*\*FR-COM-003\*\* | System shall support product categories, subcategories, and custom collections | P1 | Collections groupable per campaign |

| \*\*FR-COM-004\*\* | System shall support product variants (e.g., size, color) with variant-level pricing and inventory | P1 | Max 100 variants per product |

| \*\*FR-COM-005\*\* | System shall track inventory in real time and surface low-stock and out-of-stock status | P1 | Threshold configurable per product |

| \*\*FR-COM-006\*\* | System shall support bidirectional product sync with external e-commerce platforms where API permits | P1 | Conflict resolution favors external platform |

| \*\*FR-COM-007\*\* | System shall sync product catalog to all connected platforms within 5 minutes of any update | P0 | Failure triggers retry with alert |

| \*\*FR-COM-008\*\* | System shall support bulk product import via CSV upload | P2 | Template provided in UI |

| \*\*FR-COM-009\*\* | System shall support product archiving without deletion to preserve historical analytics | P2 | Archived products hidden from active catalog |



\### 3.2 Platform Integration



| Requirement ID | Description | Priority | Notes |

|----------------|-------------|----------|-------|

| \*\*FR-COM-010\*\* | System shall integrate with Instagram Shopping (catalog sync, product tagging, native checkout) | P0 | Requires Facebook Business Manager connection |

| \*\*FR-COM-011\*\* | System shall integrate with Facebook Shops (catalog sync, native checkout) | P0 | Shared catalog with Instagram |

| \*\*FR-COM-012\*\* | System shall integrate with TikTok Shop (catalog sync, product tagging, affiliate content) | P1 | TikTok Shop API v2 |

| \*\*FR-COM-013\*\* | System shall support product tagging in feed posts, stories, and reels per platform capability | P0 | Platform tag limits respected |

| \*\*FR-COM-014\*\* | System shall support both platform-native checkout and external (website) checkout options | P0 | Configurable per product |

| \*\*FR-COM-015\*\* | System shall manage product collections per platform with platform-specific display rules | P1 | Collections synced independently |

| \*\*FR-COM-016\*\* | System shall surface platform connection health status and alert on disconnection | P1 | Dashboard indicator + email alert |

| \*\*FR-COM-017\*\* | System shall respect platform-specific API rate limits using queue management and exponential backoff | P0 | No silent failures |



\### 3.3 Commerce Content



| Requirement ID | Description | Priority | Notes |

|----------------|-------------|----------|-------|

| \*\*FR-COM-018\*\* | System shall enable product tagging within the content creation and scheduling workflow | P0 | Integrated with MOD-002 |

| \*\*FR-COM-019\*\* | System shall provide a live product tag preview before publishing | P1 | Preview renders per platform spec |

| \*\*FR-COM-020\*\* | System shall support tagging up to 5 products per post (Instagram limit) | P0 | Platform limits enforced with user messaging |

| \*\*FR-COM-021\*\* | System shall support bulk product tagging across multiple posts | P2 | Batch action in content library |

| \*\*FR-COM-022\*\* | System shall surface product tag performance data within content analytics | P1 | Clicks, conversions, revenue per tag |

| \*\*FR-COM-023\*\* | System shall auto-suggest relevant products for tagging based on content copy and category | P2 | AI-powered suggestion engine |



\### 3.4 Commerce Analytics



| Requirement ID | Description | Priority | Notes |

|----------------|-------------|----------|-------|

| \*\*FR-COM-024\*\* | System shall provide a commerce dashboard with revenue, orders, units sold, and conversion rate summary | P0 | Default to last 30 days |

| \*\*FR-COM-025\*\* | System shall provide product performance analytics ranked by revenue, units sold, and conversion rate | P1 | Filterable by platform, date range |

| \*\*FR-COM-026\*\* | System shall provide content attribution linking each post to clicks, conversions, and revenue | P1 | Multi-touch attribution model |

| \*\*FR-COM-027\*\* | System shall provide audience shopping behavior insights (funnel drop-off, repeat buyers) | P2 | Aggregated, anonymized data |

| \*\*FR-COM-028\*\* | System shall provide checkout analytics including cart abandonment rate and checkout completion rate | P1 | Per platform and per product |

| \*\*FR-COM-029\*\* | Sales performance data shall refresh within 1 hour of activity | P0 | Timestamp shown on dashboard |

| \*\*FR-COM-030\*\* | System shall support data export in CSV and XLSX format for all commerce reports | P2 | Configurable date range |



\### 3.5 Order Management



| Requirement ID | Description | Priority | Notes |

|----------------|-------------|----------|-------|

| \*\*FR-COM-031\*\* | System shall display incoming orders with status, product details, and order value | P1 | Pulled from platform APIs |

| \*\*FR-COM-032\*\* | System shall provide real-time order status updates (pending, processing, shipped, delivered, cancelled) | P1 | Webhook-driven updates |

| \*\*FR-COM-033\*\* | System shall support manual order status updates for platforms without native webhook support | P2 | Admin and Manager roles only |

| \*\*FR-COM-034\*\* | System shall integrate with fulfillment systems via webhook or API for automated order handoff | P2 | Configurable per organization |



\---



\## 4. Business Rules



\### 4.1 Product Rules



| Rule ID | Rule | Rationale |

|---------|------|-----------|

| \*\*BR-COM-001\*\* | Products must have at least one image before being published to any platform | Social platforms reject imageless products; image required for approval |

| \*\*BR-COM-002\*\* | All product prices shall be denominated in Nigerian Naira (₦ NGN) as the base currency | Local market requirement; platform display currency may differ |

| \*\*BR-COM-003\*\* | Product inventory shall be tracked and updated in real time across all connected platforms | Prevents overselling and customer dissatisfaction |

| \*\*BR-COM-004\*\* | Product catalog sync shall be bidirectional where platform APIs support it; external platform data takes precedence in conflict resolution | Maintains consistency; external platform is source of truth for inventory |

| \*\*BR-COM-005\*\* | Products with zero inventory shall be automatically set to out-of-stock status and removed from shoppable tags | Prevents customers from initiating purchases that cannot be fulfilled |

| \*\*BR-COM-006\*\* | Product SKUs must be unique within an organization's catalog | Prevents duplicate listings and sync errors |



\### 4.2 Platform Rules



| Rule ID | Rule | Rationale |

|---------|------|-----------|

| \*\*BR-COM-007\*\* | Product tagging shall comply with platform-specific requirements and tag limits (e.g., max 5 tags on Instagram) | Ensures platform compatibility and prevents publishing failures |

| \*\*BR-COM-008\*\* | Checkout options (native vs. external) shall be configurable per product and per platform | Respects platform policies and user preference |

| \*\*BR-COM-009\*\* | All catalog sync operations shall implement queue management and respect platform API rate limits | Maintains reliability and prevents account suspension |

| \*\*BR-COM-010\*\* | Content containing product tags shall undergo compliance review before publishing | Protects brand safety and ensures regulatory compliance |

| \*\*BR-COM-011\*\* | Platform integration credentials shall be re-validated every 90 days and on any platform-side permission change | Prevents silent integration failures |



\### 4.3 Analytics Rules



| Rule ID | Rule | Rationale |

|---------|------|-----------|

| \*\*BR-COM-012\*\* | Sales attribution shall use a multi-touch attribution model that credits all content interactions in the customer journey | Provides accurate, fair attribution across content and campaigns |

| \*\*BR-COM-013\*\* | Revenue figures shall reflect gross sales value in NGN inclusive of any platform fees where data is available; fees displayed as a separate line item | Gives a complete and honest revenue picture |

| \*\*BR-COM-014\*\* | Conversion rates shall be calculated independently per platform and per content type for granular insight | Enables platform-specific and format-specific optimization |

| \*\*BR-COM-015\*\* | Analytics data older than 24 months shall be archived but remain accessible on request | Balances storage cost with historical reporting needs |



\### 4.4 Order Rules



| Rule ID | Rule | Rationale |

|---------|------|-----------|

| \*\*BR-COM-016\*\* | Orders containing discontinued or out-of-stock products shall be automatically flagged for manual review | Prevents unfulfillable orders from entering the fulfillment pipeline |

| \*\*BR-COM-017\*\* | Order data shall be retained for a minimum of 7 years in compliance with Nigerian financial record-keeping regulations | Regulatory compliance |



\---



\## 5. Data Model



\### 5.1 Entity: Product



| Field | Type | Description | Nullable |

|-------|------|-------------|----------|

| `id` | UUID | Primary key | No |

| `organization\_id` | UUID | Organization context (FK to organizations) | No |

| `name` | TEXT | Product name | No |

| `description` | TEXT | Full product description | Yes |

| `sku` | TEXT | Stock keeping unit — unique per organization | No |

| `price` | DECIMAL(12,2) | Product price in NGN | No |

| `currency` | TEXT | Currency code (default: NGN) | No |

| `category` | TEXT | Top-level product category | Yes |

| `subcategory` | TEXT | Product subcategory | Yes |

| `brand` | TEXT | Product brand name | Yes |

| `images` | TEXT\[] | Array of product image URLs (min 1 required for publishing) | No |

| `variants` | JSONB | Product variants with name, options, price override, and inventory per variant | Yes |

| `inventory` | INTEGER | Total available inventory units | No |

| `low\_stock\_threshold` | INTEGER | Threshold below which low-stock alert fires (default: 10) | Yes |

| `inventory\_status` | ENUM | `in\_stock`, `low\_stock`, `out\_of\_stock` | No |

| `platform\_ids` | JSONB | Platform-specific product IDs keyed by platform name | Yes |

| `collections` | TEXT\[] | Collection names this product belongs to | Yes |

| `tags` | TEXT\[] | Searchable product tags | Yes |

| `is\_active` | BOOLEAN | Whether product is active and available for tagging | No |

| `is\_archived` | BOOLEAN | Archived products hidden from catalog but preserved for analytics | No |

| `external\_platform` | TEXT | External e-commerce platform (e.g., shopify, woocommerce) | Yes |

| `external\_product\_id` | TEXT | Product ID in external e-commerce platform | Yes |

| `created\_at` | TIMESTAMPTZ | Creation timestamp | No |

| `updated\_at` | TIMESTAMPTZ | Last update timestamp | No |



\*\*Indexes:\*\* `organization\_id`, `sku`, `inventory\_status`, `is\_active`



\### 5.2 Entity: Order



| Field | Type | Description | Nullable |

|-------|------|-------------|----------|

| `id` | UUID | Primary key | No |

| `organization\_id` | UUID | Organization context (FK to organizations) | No |

| `order\_number` | TEXT | Human-readable order reference | No |

| `platform` | TEXT | Source platform (instagram, facebook, tiktok) | No |

| `platform\_order\_id` | TEXT | Platform-assigned order ID | No |

| `products` | JSONB | Array of ordered products with ID, name, variant, quantity, unit price | No |

| `subtotal` | DECIMAL(12,2) | Order subtotal before fees in NGN | No |

| `platform\_fee` | DECIMAL(12,2) | Platform transaction fee in NGN | Yes |

| `total\_amount` | DECIMAL(12,2) | Total order amount in NGN | No |

| `currency` | TEXT | Currency code (default: NGN) | No |

| `shipping\_address` | JSONB | Customer shipping address | Yes |

| `billing\_address` | JSONB | Customer billing address | Yes |

| `status` | ENUM | `pending`, `processing`, `shipped`, `delivered`, `cancelled` | No |

| `payment\_status` | ENUM | `pending`, `paid`, `failed`, `refunded` | No |

| `content\_id` | UUID | Content piece that last drove the order (FK to posts) | Yes |

| `attribution\_chain` | JSONB | Full multi-touch attribution chain with content IDs and weights | Yes |

| `influencer\_id` | UUID | Influencer who drove the order | Yes |

| `source\_url` | TEXT | Full source URL including UTM parameters | Yes |

| `utm\_source` | TEXT | UTM source parameter | Yes |

| `utm\_medium` | TEXT | UTM medium parameter | Yes |

| `utm\_campaign` | TEXT | UTM campaign parameter | Yes |

| `notes` | TEXT | Internal notes on the order | Yes |

| `created\_at` | TIMESTAMPTZ | Order creation timestamp | No |

| `updated\_at` | TIMESTAMPTZ | Last update timestamp | No |



\*\*Indexes:\*\* `organization\_id`, `platform`, `status`, `payment\_status`, `created\_at`



\### 5.3 Entity: Product Tag



| Field | Type | Description | Nullable |

|-------|------|-------------|----------|

| `id` | UUID | Primary key | No |

| `product\_id` | UUID | Associated product (FK to products) | No |

| `organization\_id` | UUID | Organization context | No |

| `platform` | TEXT | Platform where tagged (instagram, facebook, tiktok) | No |

| `platform\_tag\_id` | TEXT | Platform-assigned tag ID | Yes |

| `content\_id` | UUID | Content piece where product is tagged (FK to posts) | No |

| `content\_type` | TEXT | Content format (post, story, reel) | No |

| `position` | JSONB | Tag position in content as normalized x/y coordinates (0.0–1.0) | Yes |

| `status` | ENUM | `active`, `inactive`, `failed` | No |

| `failure\_reason` | TEXT | Reason if status is failed | Yes |

| `clicks` | INTEGER | Total clicks on this tag (updated hourly) | No |

| `conversions` | INTEGER | Total conversions attributed to this tag | No |

| `revenue` | DECIMAL(12,2) | Revenue attributed to this tag in NGN | No |

| `created\_at` | TIMESTAMPTZ | Creation timestamp | No |

| `updated\_at` | TIMESTAMPTZ | Last update timestamp | No |



\*\*Indexes:\*\* `product\_id`, `content\_id`, `organization\_id`, `platform`, `status`



\### 5.4 Entity: Commerce Analytics



| Field | Type | Description | Nullable |

|-------|------|-------------|----------|

| `id` | UUID | Primary key | No |

| `organization\_id` | UUID | Organization context | No |

| `date` | DATE | Analytics date (daily granularity) | No |

| `platform` | TEXT | Platform | Yes |

| `content\_id` | UUID | Content reference | Yes |

| `product\_id` | UUID | Product reference | Yes |

| `impressions` | INTEGER | Product impressions for the period | No |

| `clicks` | INTEGER | Product tag or link clicks | No |

| `add\_to\_cart` | INTEGER | Number of add-to-cart events | No |

| `checkout\_initiated` | INTEGER | Number of checkout initiations | No |

| `sales` | INTEGER | Completed sales count | No |

| `revenue` | DECIMAL(12,2) | Gross revenue in NGN | No |

| `platform\_fees` | DECIMAL(12,2) | Platform fees deducted in NGN | Yes |

| `net\_revenue` | DECIMAL(12,2) | Net revenue after fees in NGN | Yes |

| `conversion\_rate` | DECIMAL(6,4) | Sales / Impressions expressed as percentage | No |

| `cart\_abandonment\_rate` | DECIMAL(6,4) | (Checkout initiated − Sales) / Checkout initiated | Yes |

| `average\_order\_value` | DECIMAL(12,2) | Revenue / Sales in NGN | Yes |

| `created\_at` | TIMESTAMPTZ | Record creation timestamp | No |



\*\*Indexes:\*\* `organization\_id`, `date`, `platform`, `product\_id`, `content\_id`



\### 5.5 Entity: Product Sync Log



| Field | Type | Description | Nullable |

|-------|------|-------------|----------|

| `id` | UUID | Primary key | No |

| `organization\_id` | UUID | Organization context | No |

| `sync\_id` | TEXT | Sync operation identifier | No |

| `platform` | TEXT | Target platform | No |

| `status` | ENUM | `pending`, `in\_progress`, `completed`, `failed` | No |

| `total\_products` | INTEGER | Total products in sync batch | No |

| `products\_synced` | INTEGER | Successfully synced products | No |

| `products\_failed` | INTEGER | Failed products in sync | No |

| `error\_details` | JSONB | Per-product error details for failed items | Yes |

| `started\_at` | TIMESTAMPTZ | Sync start time | No |

| `completed\_at` | TIMESTAMPTZ | Sync completion time | Yes |

| `triggered\_by` | UUID | User ID who triggered the sync | Yes |



\---



\## 6. API Surface



\### 6.1 Endpoint: Create Product



```

POST /api/v1/commerce/products

```



\*\*Authorization:\*\* `commerce:products:create`



\*\*Request:\*\*



```json

{

&#x20; "organization\_id": "org\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20; "name": "Premium Leather Wallet",

&#x20; "description": "Handcrafted premium leather wallet with RFID protection and 8-card slot capacity",

&#x20; "sku": "WL-001",

&#x20; "price": 15000.00,

&#x20; "currency": "NGN",

&#x20; "category": "Accessories",

&#x20; "subcategory": "Wallets",

&#x20; "brand": "Luxury Leather Co",

&#x20; "images": \[

&#x20;   "https://storage.nawebeus.com/products/wl-001-front.jpg",

&#x20;   "https://storage.nawebeus.com/products/wl-001-open.jpg"

&#x20; ],

&#x20; "variants": \[

&#x20;   {

&#x20;     "name": "Color",

&#x20;     "options": \[

&#x20;       { "label": "Black", "inventory": 30, "price\_override": null },

&#x20;       { "label": "Brown", "inventory": 20, "price\_override": null }

&#x20;     ]

&#x20;   }

&#x20; ],

&#x20; "inventory": 50,

&#x20; "low\_stock\_threshold": 10,

&#x20; "collections": \["Holiday Gifts", "Best Sellers"],

&#x20; "tags": \["wallet", "leather", "premium", "gift", "rfid"]

}

```



\*\*Response — 201 Created:\*\*



```json

{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "id": "prod\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20;   "name": "Premium Leather Wallet",

&#x20;   "sku": "WL-001",

&#x20;   "price": 15000.00,

&#x20;   "currency": "NGN",

&#x20;   "inventory": 50,

&#x20;   "inventory\_status": "in\_stock",

&#x20;   "platform\_ids": {},

&#x20;   "is\_active": true,

&#x20;   "created\_at": "2026-07-21T10:00:00Z"

&#x20; },

&#x20; "meta": {

&#x20;   "sync\_scheduled": true,

&#x20;   "estimated\_sync\_completion": "2026-07-21T10:05:00Z"

&#x20; }

}

```



\*\*Error Responses:\*\*



| HTTP Status | Error Code | Scenario |

|-------------|------------|----------|

| 400 | `VALIDATION\_ERROR` | Missing required fields, invalid price, duplicate SKU |

| 403 | `PERMISSION\_DENIED` | User lacks `commerce:products:create` permission |

| 422 | `DUPLICATE\_SKU` | SKU already exists in this organization's catalog |



\---



\### 6.2 Endpoint: Get Products



```

GET /api/v1/commerce/products

```



\*\*Authorization:\*\* `commerce:products:read`



\*\*Query Parameters:\*\*



| Parameter | Type | Required | Description | Default |

|-----------|------|----------|-------------|---------|

| `organization\_id` | UUID | Yes | Organization context | — |

| `category` | STRING | No | Filter by category | — |

| `subcategory` | STRING | No | Filter by subcategory | — |

| `collection` | STRING | No | Filter by collection name | — |

| `inventory\_status` | STRING | No | `in\_stock`, `low\_stock`, `out\_of\_stock` | — |

| `platform` | STRING | No | Filter by platform connectivity | — |

| `is\_active` | BOOLEAN | No | Filter by active status | `true` |

| `search` | STRING | No | Full-text search on name, SKU, tags | — |

| `sort\_by` | STRING | No | `name`, `price`, `inventory`, `created\_at` | `created\_at` |

| `sort\_order` | STRING | No | `asc`, `desc` | `desc` |

| `page` | INTEGER | No | Page number | 1 |

| `limit` | INTEGER | No | Items per page (max: 100) | 20 |



\*\*Response — 200 OK:\*\*



```json

{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "products": \[

&#x20;     {

&#x20;       "id": "prod\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20;       "name": "Premium Leather Wallet",

&#x20;       "sku": "WL-001",

&#x20;       "price": 15000.00,

&#x20;       "currency": "NGN",

&#x20;       "category": "Accessories",

&#x20;       "subcategory": "Wallets",

&#x20;       "inventory": 50,

&#x20;       "inventory\_status": "in\_stock",

&#x20;       "images": \[

&#x20;         "https://storage.nawebeus.com/products/wl-001-front.jpg"

&#x20;       ],

&#x20;       "collections": \["Holiday Gifts", "Best Sellers"],

&#x20;       "platform\_ids": {

&#x20;         "instagram": "ig\_prod\_abc123",

&#x20;         "facebook": "fb\_prod\_abc123",

&#x20;         "tiktok": "tt\_prod\_abc123"

&#x20;       },

&#x20;       "is\_active": true,

&#x20;       "created\_at": "2026-07-21T10:00:00Z",

&#x20;       "updated\_at": "2026-07-21T10:00:00Z"

&#x20;     }

&#x20;   ],

&#x20;   "pagination": {

&#x20;     "page": 1,

&#x20;     "limit": 20,

&#x20;     "total": 45,

&#x20;     "pages": 3,

&#x20;     "has\_next": true,

&#x20;     "has\_prev": false

&#x20;   }

&#x20; }

}

```



\---



\### 6.3 Endpoint: Update Product



```

PATCH /api/v1/commerce/products/{product\_id}

```



\*\*Authorization:\*\* `commerce:products:edit`



\*\*Request:\*\*



```json

{

&#x20; "price": 17500.00,

&#x20; "inventory": 35,

&#x20; "low\_stock\_threshold": 8,

&#x20; "is\_active": true

}

```



\*\*Response — 200 OK:\*\*



```json

{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "id": "prod\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20;   "name": "Premium Leather Wallet",

&#x20;   "price": 17500.00,

&#x20;   "inventory": 35,

&#x20;   "inventory\_status": "in\_stock",

&#x20;   "updated\_at": "2026-07-21T11:30:00Z"

&#x20; },

&#x20; "meta": {

&#x20;   "sync\_scheduled": true,

&#x20;   "platforms\_to\_sync": \["instagram", "facebook", "tiktok"]

&#x20; }

}

```



\---



\### 6.4 Endpoint: Tag Product in Content



```

POST /api/v1/commerce/tags

```



\*\*Authorization:\*\* `commerce:tags:create`



\*\*Request:\*\*



```json

{

&#x20; "organization\_id": "org\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20; "product\_id": "prod\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20; "platform": "instagram",

&#x20; "content\_id": "pst\_7e3b5c2a-1f4d-4e8b-9a2c-3b4d5e6f7a8b",

&#x20; "content\_type": "post",

&#x20; "position": {

&#x20;   "x": 0.25,

&#x20;   "y": 0.50

&#x20; }

}

```



\*\*Response — 201 Created:\*\*



```json

{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "id": "tag\_8e4c6d2b-2a5f-4f9c-0b3d-4c5e6f7a8b9c",

&#x20;   "product\_id": "prod\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20;   "product\_name": "Premium Leather Wallet",

&#x20;   "product\_price": 17500.00,

&#x20;   "platform": "instagram",

&#x20;   "platform\_tag\_id": "ig\_tag\_xyz789",

&#x20;   "content\_id": "pst\_7e3b5c2a-1f4d-4e8b-9a2c-3b4d5e6f7a8b",

&#x20;   "content\_type": "post",

&#x20;   "position": { "x": 0.25, "y": 0.50 },

&#x20;   "status": "active",

&#x20;   "created\_at": "2026-07-21T10:00:00Z"

&#x20; }

}

```



\*\*Error Responses:\*\*



| HTTP Status | Error Code | Scenario |

|-------------|------------|----------|

| 400 | `TAGGING\_UNSUPPORTED` | Platform or content type does not support tagging |

| 400 | `TAG\_LIMIT\_EXCEEDED` | Platform tag limit reached (e.g., max 5 on Instagram) |

| 400 | `PRODUCT\_OUT\_OF\_STOCK` | Cannot tag an out-of-stock product |

| 409 | `DUPLICATE\_TAG` | Product already tagged in this content piece |



\---



\### 6.5 Endpoint: Get Commerce Analytics



```

GET /api/v1/commerce/analytics

```



\*\*Authorization:\*\* `commerce:analytics:read`



\*\*Query Parameters:\*\*



| Parameter | Type | Required | Description |

|-----------|------|----------|-------------|

| `organization\_id` | UUID | Yes | Organization context |

| `start\_date` | DATE | Yes | Start date for range (YYYY-MM-DD) |

| `end\_date` | DATE | Yes | End date for range (YYYY-MM-DD) |

| `platform` | STRING | No | Filter by platform |

| `product\_id` | UUID | No | Filter by specific product |

| `content\_id` | UUID | No | Filter by specific content piece |

| `group\_by` | STRING | No | `day`, `week`, `month` (default: `day`) |



\*\*Response — 200 OK:\*\*



```json

{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "summary": {

&#x20;     "total\_revenue": 1250000.00,

&#x20;     "net\_revenue": 1187500.00,

&#x20;     "platform\_fees": 62500.00,

&#x20;     "total\_orders": 85,

&#x20;     "total\_products\_sold": 120,

&#x20;     "average\_order\_value": 14706.00,

&#x20;     "conversion\_rate": 2.8,

&#x20;     "cart\_abandonment\_rate": 34.5,

&#x20;     "currency": "NGN"

&#x20;   },

&#x20;   "by\_platform": {

&#x20;     "instagram": {

&#x20;       "revenue": 750000.00,

&#x20;       "orders": 50,

&#x20;       "units\_sold": 72,

&#x20;       "conversion\_rate": 3.2,

&#x20;       "cart\_abandonment\_rate": 30.2,

&#x20;       "average\_order\_value": 15000.00

&#x20;     },

&#x20;     "facebook": {

&#x20;       "revenue": 500000.00,

&#x20;       "orders": 35,

&#x20;       "units\_sold": 48,

&#x20;       "conversion\_rate": 2.4,

&#x20;       "cart\_abandonment\_rate": 40.1,

&#x20;       "average\_order\_value": 14286.00

&#x20;     }

&#x20;   },

&#x20;   "top\_products": \[

&#x20;     {

&#x20;       "product\_id": "prod\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20;       "name": "Premium Leather Wallet",

&#x20;       "revenue": 300000.00,

&#x20;       "units\_sold": 20,

&#x20;       "conversion\_rate": 4.1

&#x20;     },

&#x20;     {

&#x20;       "product\_id": "prod\_2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",

&#x20;       "name": "Designer Sunglasses",

&#x20;       "revenue": 250000.00,

&#x20;       "units\_sold": 10,

&#x20;       "conversion\_rate": 3.8

&#x20;     }

&#x20;   ],

&#x20;   "top\_content": \[

&#x20;     {

&#x20;       "content\_id": "pst\_7e3b5c2a-1f4d-4e8b-9a2c-3b4d5e6f7a8b",

&#x20;       "title": "Holiday Gift Guide",

&#x20;       "platform": "instagram",

&#x20;       "revenue": 450000.00,

&#x20;       "conversions": 30,

&#x20;       "clicks": 1200,

&#x20;       "impressions": 45000

&#x20;     },

&#x20;     {

&#x20;       "content\_id": "pst\_3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",

&#x20;       "title": "New Arrivals — July",

&#x20;       "platform": "facebook",

&#x20;       "revenue": 350000.00,

&#x20;       "conversions": 25,

&#x20;       "clicks": 980,

&#x20;       "impressions": 32000

&#x20;     }

&#x20;   ],

&#x20;   "trend": \[

&#x20;     {

&#x20;       "date": "2026-07-14",

&#x20;       "revenue": 185000.00,

&#x20;       "orders": 12

&#x20;     },

&#x20;     {

&#x20;       "date": "2026-07-15",

&#x20;       "revenue": 210000.00,

&#x20;       "orders": 14

&#x20;     }

&#x20;   ],

&#x20;   "meta": {

&#x20;     "last\_updated": "2026-07-21T09:45:00Z",

&#x20;     "currency": "NGN"

&#x20;   }

&#x20; }

}

```



\---



\### 6.6 Endpoint: Sync Product Catalog



```

POST /api/v1/commerce/sync

```



\*\*Authorization:\*\* `commerce:sync`



\*\*Request:\*\*



```json

{

&#x20; "organization\_id": "org\_9f2a4b1c-3d5e-4f6a-8b9c-0d1e2f3a4b5c",

&#x20; "platform": "instagram",

&#x20; "product\_ids": \["prod\_9f2a4b1c-...", "prod\_2b3c4d5e-..."]

}

```



> \*\*Note:\*\* Omitting `product\_ids` triggers a full catalog sync for the specified platform.



\*\*Response — 202 Accepted:\*\*



```json

{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "sync\_id": "sync\_1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",

&#x20;   "platform": "instagram",

&#x20;   "status": "in\_progress",

&#x20;   "products\_queued": 45,

&#x20;   "products\_synced": 0,

&#x20;   "products\_failed": 0,

&#x20;   "started\_at": "2026-07-21T10:00:00Z",

&#x20;   "estimated\_completion": "2026-07-21T10:05:00Z"

&#x20; }

}

```



\---



\### 6.7 Endpoint: Get Sync Status



```

GET /api/v1/commerce/sync/{sync\_id}

```



\*\*Authorization:\*\* `commerce:sync`



\*\*Response — 200 OK:\*\*



```json

{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "sync\_id": "sync\_1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",

&#x20;   "platform": "instagram",

&#x20;   "status": "completed",

&#x20;   "products\_queued": 45,

&#x20;   "products\_synced": 43,

&#x20;   "products\_failed": 2,

&#x20;   "failed\_products": \[

&#x20;     {

&#x20;       "product\_id": "prod\_abc123",

&#x20;       "name": "Classic Belt",

&#x20;       "error": "Image resolution below platform minimum (500x500px required)"

&#x20;     }

&#x20;   ],

&#x20;   "started\_at": "2026-07-21T10:00:00Z",

&#x20;   "completed\_at": "2026-07-21T10:04:32Z"

&#x20; }

}

```



\---



\## 7. Permissions (RBAC)



\### 7.1 Permission Definitions



| Permission | Description |

|------------|-------------|

| `commerce:products:read` | View product catalog and individual product details |

| `commerce:products:create` | Create new products in the catalog |

| `commerce:products:edit` | Edit existing product details, pricing, and inventory |

| `commerce:products:delete` | Delete or archive products from the catalog |

| `commerce:orders:read` | View order list and individual order details |

| `commerce:orders:update` | Update order status and add internal notes |

| `commerce:tags:create` | Tag products in social content |

| `commerce:tags:delete` | Remove product tags from content |

| `commerce:analytics:read` | View commerce analytics and performance reports |

| `commerce:analytics:export` | Export commerce analytics data to CSV or XLSX |

| `commerce:sync` | Trigger manual product catalog sync to platforms |

| `commerce:settings:manage` | Configure platform integrations and commerce settings |



\### 7.2 Role Permission Matrix



| Permission | Admin | Manager | Analyst | Viewer |

|------------|-------|---------|---------|--------|

| `commerce:products:read` | ✅ | ✅ | ✅ | ✅ |

| `commerce:products:create` | ✅ | ✅ | ❌ | ❌ |

| `commerce:products:edit` | ✅ | ✅ | ❌ | ❌ |

| `commerce:products:delete` | ✅ | ❌ | ❌ | ❌ |

| `commerce:orders:read` | ✅ | ✅ | ✅ | ✅ |

| `commerce:orders:update` | ✅ | ✅ | ❌ | ❌ |

| `commerce:tags:create` | ✅ | ✅ | ✅ | ❌ |

| `commerce:tags:delete` | ✅ | ✅ | ❌ | ❌ |

| `commerce:analytics:read` | ✅ | ✅ | ✅ | ✅ |

| `commerce:analytics:export` | ✅ | ✅ | ✅ | ❌ |

| `commerce:sync` | ✅ | ✅ | ❌ | ❌ |

| `commerce:settings:manage` | ✅ | ❌ | ❌ | ❌ |



\### 7.3 Permission Notes



\- \*\*Analyst role\*\* can view and export analytics and tag products in content, but cannot alter the catalog or trigger syncs

\- \*\*Manager role\*\* cannot delete products or change commerce settings to prevent accidental data loss

\- \*\*Viewer role\*\* has read-only access to catalog, orders, and analytics — suitable for stakeholders and clients

\- \*\*Agency context:\*\* Agency Owners operate at the workspace level; each client workspace enforces permissions independently



\---



\## 8. User Interface



\### 8.1 Screen: Product Catalog



```

┌─────────────────────────────────────────────────────────────────────┐

│ 📦 Product Catalog                              \[Sync All] \[+ Add]  │

├─────────────────────────────────────────────────────────────────────┤

│ 🔍 \[Search products, SKU, tags...]                                  │

│ \[Category: All ▼] \[Status: All ▼] \[Platform: All ▼] \[Sort: ▼]     │

├─────────────────────────────────────────────────────────────────────┤

│ Showing 45 products                                                 │

├─────────────────────────────────────────────────────────────────────┤

│ ┌───────────────────────────────────────────────────────────────┐   │

│ │ 📷  Premium Leather Wallet                    \[Edit] \[•••]   │   │

│ │      SKU: WL-001  │  ₦17,500  │  Accessories                │   │

│ │      Inventory: 35 units  │  ✅ In Stock                     │   │

│ │      Platforms: Instagram ✅  Facebook ✅  TikTok ✅         │   │

│ │      Collections: Holiday Gifts, Best Sellers                │   │

│ │      \[Manage Tags]  \[View Analytics]                         │   │

│ ├───────────────────────────────────────────────────────────────┤   │

│ │ 📷  Designer Sunglasses                       \[Edit] \[•••]   │   │

│ │      SKU: SG-001  │  ₦25,000  │  Accessories                │   │

│ │      Inventory: 8 units  │  ⚠️ Low Stock                    │   │

│ │      Platforms: Instagram ✅  Facebook ✅                    │   │

│ │      \[Manage Tags]  \[View Analytics]                         │   │

│ ├───────────────────────────────────────────────────────────────┤   │

│ │ 📷  Luxury Watch                              \[Edit] \[•••]   │   │

│ │      SKU: WT-001  │  ₦85,000  │  Accessories                │   │

│ │      Inventory: 0 units  │  ❌ Out of Stock                  │   │

│ │      Platforms: Instagram ✅  Facebook ✅  TikTok ✅         │   │

│ │      ⚠️ Product tags auto-paused — restock to reactivate     │   │

│ │      \[Manage Tags]  \[View Analytics]                         │   │

│ └───────────────────────────────────────────────────────────────┘   │

│                                                                     │

│ Page 1 of 3  ← \[1] \[2] \[3] →                                       │

└─────────────────────────────────────────────────────────────────────┘

```



\### 8.2 Screen: Commerce Dashboard



```

┌─────────────────────────────────────────────────────────────────────┐

│ 📊 Commerce Dashboard             \[Last 30 Days ▼]  \[Export ▼]     │

├──────────────┬──────────────┬──────────────┬────────────────────────┤

│ Total Revenue│ Net Revenue  │ Total Orders │ Avg. Order Value       │

│ ₦1,250,000  │ ₦1,187,500  │ 85 orders    │ ₦14,706                │

│ ▲ +18.2%    │ ▲ +17.8%    │ ▲ +12.5%    │ ▲ +5.1%               │

├──────────────┴──────────────┴──────────────┴────────────────────────┤

│ Units Sold: 120    │   Conversion Rate: 2.8%   │   Cart Abandonment: 34.5% │

├─────────────────────────────────────────────────────────────────────┤

│ Revenue by Platform                              Last updated: 09:45 │

│ ┌───────────────────────────────────────────────────────────────┐   │

│ │  Instagram ██████████████████████████████░░ ₦750,000 (60%)  │   │

│ │  Facebook  ████████████████████░░░░░░░░░░░ ₦500,000 (40%)  │   │

│ └───────────────────────────────────────────────────────────────┘   │

│                                                                     │

│ Revenue Trend (Last 30 Days)                                        │

│ ┌───────────────────────────────────────────────────────────────┐   │

│ │  \[Line Chart — daily revenue trend with ₦ values]            │   │

│ └───────────────────────────────────────────────────────────────┘   │

├─────────────────────────────────────────────────────────────────────┤

│ Top Products                          │  Top Content                │

│ ┌────────────────────────────────┐   │  ┌────────────────────────┐ │

│ │ 1. Premium Leather Wallet      │   │  │ 1. Holiday Gift Guide  │ │

│ │    ₦300,000 │ 20 units │ 4.1% │   │  │    ₦450,000 │ 30 conv │ │

│ │ 2. Designer Sunglasses         │   │  │ 2. New Arrivals — July │ │

│ │    ₦250,000 │ 10 units │ 3.8% │   │  │    ₦350,000 │ 25 conv │ │

│ │ 3. Luxury Watch                │   │  │ 3. Customer Stories    │ │

│ │    ₦170,000 │  2 units │ 2.9% │   │  │    ₦250,000 │ 18 conv │ │

│ └────────────────────────────────┘   │  └────────────────────────┘ │

└─────────────────────────────────────────────────────────────────────┘

```



\### 8.3 Screen: Product Detail



```

┌─────────────────────────────────────────────────────────────────────┐

│ ← Back to Catalog                          \[Edit Product]  \[•••]   │

├─────────────────────────────────────────────────────────────────────┤

│ Premium Leather Wallet                    ✅ Active                 │

│ SKU: WL-001  │  Category: Accessories  │  Brand: Luxury Leather Co  │

│                                                                     │

│ Price: ₦17,500         Inventory: 35 units                         │

│ Status: ✅ In Stock    Low Stock Threshold: 10 units               │

│ Collections: Holiday Gifts, Best Sellers                            │

├─────────────────────────────────────────────────────────────────────┤

│ Description:                                                        │

│ Handcrafted premium leather wallet with RFID protection and         │

│ 8-card slot capacity. Available in Black and Brown.                 │

├─────────────────────────────────────────────────────────────────────┤

│ Images:  \[📷 Front]  \[📷 Open View]  \[+ Add Image]                 │

│                                                                     │

│ Variants:                                                           │

│   Color:  ● Black (30 units)   ● Brown (20 units) — ₦17,500 each  │

├─────────────────────────────────────────────────────────────────────┤

│ Platform Status:                             \[Sync Now]             │

│   Instagram  ✅ Active  │  Facebook  ✅ Active  │  TikTok  ✅ Active│

│   Last synced: 2026-07-21 09:58 AM                                  │

├─────────────────────────────────────────────────────────────────────┤

│ Performance — Last 30 Days                                          │

│ ┌───────────────┬─────────────┬──────────┬────────┬──────────────┐ │

│ │ Platform      │ Impressions │ Clicks   │ Sales  │ Revenue      │ │

│ ├───────────────┼─────────────┼──────────┼────────┼──────────────┤ │

│ │ Instagram     │ 12,500      │ 1,250    │ 12     │ ₦210,000    │ │

│ │ Facebook      │ 8,200       │ 820      │ 8      │ ₦140,000    │ │

│ │ TikTok        │ 4,100       │ 390      │ 0      │ ₦0          │ │

│ ├───────────────┼─────────────┼──────────┼────────┼──────────────┤ │

│ │ Total         │ 24,800      │ 2,460    │ 20     │ ₦350,000    │ │

│ └───────────────┴─────────────┴──────────┴────────┴──────────────┘ │

│                                                                     │

│ Tagged in: 4 posts  │  \[View Tagged Content]                        │

└─────────────────────────────────────────────────────────────────────┘

```



\### 8.4 Screen: Tag Products in Content



```

┌─────────────────────────────────────────────────────────────────────┐

│ 🏷️ Tag Products in Content                                         │

├─────────────────────────────────────────────────────────────────────┤

│ Content: Holiday Gift Guide                                         │

│ Platform: Instagram  │  Type: Post  │  Status: Draft               │

├───────────────────────────────┬─────────────────────────────────────┤

│ Content Preview               │ Available Products                  │

│                               │ 🔍 \[Search products...]             │

│ ┌─────────────────────────┐   │ ┌─────────────────────────────────┐ │

│ │                         │   │ │ \[✅] Premium Leather Wallet     │ │

│ │  \[Product image area]   │   │ │      SKU: WL-001 │ ₦17,500    │ │

│ │                         │   │ │      ✅ In Stock                │ │

│ │  📍 ₦17,500            │   │ │ \[✅] Designer Sunglasses        │ │

│ │  Premium Leather Wallet │   │ │      SKU: SG-001 │ ₦25,000    │ │

│ │                         │   │ │      ⚠️ Low Stock (8 left)     │ │

│ │  📍 ₦25,000            │   │ │ \[ ] Luxury Watch                │ │

│ │  Designer Sunglasses    │   │ │      SKU: WT-001 │ ₦85,000    │ │

│ │                         │   │ │      ❌ Out of Stock (disabled) │ │

│ └─────────────────────────┘   │ │ \[ ] Classic Belt                │ │

│                               │ │      SKU: BL-001 │ ₦12,000    │ │

│ ℹ️ Max 5 products per post    │ │      ✅ In Stock                │ │

│ 2 of 5 slots used             │ └─────────────────────────────────┘ │

├───────────────────────────────┴─────────────────────────────────────┤

│                                            \[Save Tags]  \[Publish]  │

└─────────────────────────────────────────────────────────────────────┘

```



\---



\## 9. Notifications



\### 9.1 Notification: Product Sync Complete



| Field | Details |

|-------|---------|

| \*\*Type\*\* | In-app, Email |

| \*\*Trigger\*\* | Product catalog sync operation completes (success or partial failure) |

| \*\*Title\*\* | 📦 Product Sync Complete: \[Platform] |

| \*\*Body\*\* | Catalog sync for \[Platform] completed. \[X] products synced successfully, \[Y] failed. |

| \*\*Action\*\* | View Sync Details |

| \*\*Recipients\*\* | Admin, Manager |



\### 9.2 Notification: Product Sync Failed



| Field | Details |

|-------|---------|

| \*\*Type\*\* | In-app, Email |

| \*\*Trigger\*\* | Product catalog sync fails entirely after retry exhaustion |

| \*\*Title\*\* | ❌ Product Sync Failed: \[Platform] |

| \*\*Body\*\* | Catalog sync for \[Platform] failed. \[Error summary]. Please reconnect your account or retry. |

| \*\*Action\*\* | View Error Details |

| \*\*Recipients\*\* | Admin |



\### 9.3 Notification: New Order Received



| Field | Details |

|-------|---------|

| \*\*Type\*\* | In-app, Email, Push |

| \*\*Trigger\*\* | New order received from any connected platform |

| \*\*Title\*\* | 🛍️ New Order: \[Order Number] |

| \*\*Body\*\* | New order of ₦\[Amount] received via \[Platform]. \[X] item(s) ordered. |

| \*\*Action\*\* | View Order |

| \*\*Recipients\*\* | Admin, Manager |



\### 9.4 Notification: Low Inventory Alert



| Field | Details |

|-------|---------|

| \*\*Type\*\* | In-app, Email |

| \*\*Trigger\*\* | Product inventory falls at or below configured `low\_stock\_threshold` |

| \*\*Title\*\* | ⚠️ Low Inventory: \[Product Name] |

| \*\*Body\*\* | \[Product Name] (SKU: \[SKU]) has only \[X] units remaining. Consider restocking to avoid missed sales. |

| \*\*Action\*\* | View Product |

| \*\*Recipients\*\* | Admin, Manager |



\### 9.5 Notification: Out of Stock — Tags Auto-Paused



| Field | Details |

|-------|---------|

| \*\*Type\*\* | In-app, Email |

| \*\*Trigger\*\* | Product inventory reaches zero; active tags auto-deactivated |

| \*\*Title\*\* | ❌ Out of Stock: \[Product Name] — Tags Paused |

| \*\*Body\*\* | \[Product Name] is now out of stock. All active product tags have been paused. Restock to reactivate. |

| \*\*Action\*\* | View Product |

| \*\*Recipients\*\* | Admin, Manager |



\### 9.6 Notification: Sales Milestone Achieved



| Field | Details |

|-------|---------|

| \*\*Type\*\* | In-app, Email |

| \*\*Trigger\*\* | Cumulative social commerce revenue crosses a milestone threshold |

| \*\*Title\*\* | 🏆 Sales Milestone: ₦\[Amount] Reached! |

| \*\*Body\*\* | Congratulations! Your social commerce revenue has reached ₦\[Amount]. Keep the momentum going. |

| \*\*Action\*\* | View Analytics |

| \*\*Recipients\*\* | Admin, Manager |



\### 9.7 Notification: Platform Disconnected



| Field | Details |

|-------|---------|

| \*\*Type\*\* | In-app, Email |

| \*\*Trigger\*\* | Platform integration token expires or is revoked |

| \*\*Title\*\* | 🔌 Platform Disconnected: \[Platform] |

| \*\*Body\*\* | Your \[Platform] commerce integration has been disconnected. Reconnect to resume product syncing and order tracking. |

| \*\*Action\*\* | Reconnect Platform |

| \*\*Recipients\*\* | Admin |



\---



\## 10. Error Handling



\### 10.1 Error Reference Table



| Error Code | HTTP Status | Description | User Message | Resolution |

|------------|-------------|-------------|--------------|------------|

| `PLATFORM\_INTEGRATION\_FAILED` | 500 | Platform API connection failed | Failed to connect to \[Platform]. Please reconnect your account. | Reconnect in Settings → Integrations |

| `PRODUCT\_SYNC\_FAILED` | 500 | Catalog sync operation failed | Product sync to \[Platform] failed. \[Error detail]. | Retry sync or check platform credentials |

| `INVENTORY\_UNAVAILABLE` | 400 | Product is out of stock | \[Product Name] is out of stock and cannot be tagged or purchased. | Update inventory or select another product |

| `TAGGING\_UNSUPPORTED` | 400 | Platform or content type does not support tagging | Product tagging is not supported for \[content type] on \[Platform]. | Use a supported content type |

| `TAG\_LIMIT\_EXCEEDED` | 400 | Platform product tag limit reached | Maximum \[X] products can be tagged per post on \[Platform]. | Remove an existing tag before adding new one |

| `DUPLICATE\_SKU` | 422 | SKU already exists in organization catalog | A product with SKU \[SKU] already exists. Use a unique SKU. | Change SKU before saving |

| `DUPLICATE\_TAG` | 409 | Product already tagged in this content | \[Product Name] is already tagged in this post. | No action needed; tag already exists |

| `IMAGE\_UPLOAD\_FAILED` | 500 | Product image failed to upload | Image upload failed. Please check file format and size (max 10MB). | Retry with a JPEG or PNG under 10MB |

| `IMAGE\_RESOLUTION\_INSUFFICIENT` | 400 | Image below platform minimum resolution | Image resolution is too low for \[Platform] (minimum 500×500px required). | Upload a higher-resolution image |

| `RATE\_LIMIT\_EXCEEDED` | 429 | Platform API rate limit hit | \[Platform] API limit reached. Your request has been queued and will retry automatically. | Wait; system retries automatically |

| `PLATFORM\_PRODUCT\_REJECTED` | 422 | Platform rejected product during sync | \[Platform] rejected \[Product Name] during sync. Reason: \[Platform error message]. | Review product content for platform policy compliance |

| `CHECKOUT\_TIMEOUT` | 408 | Checkout did not complete within time limit | Checkout session timed out. Please try again. | Retry checkout |

| `ORDER\_PRODUCT\_DISCONTINUED` | 422 | Order contains an archived or deleted product | Order contains a product that is no longer available. | Flag order for manual review |



\### 10.2 Error Handling Principles



\- \*\*Retry Logic:\*\* All platform API calls implement exponential backoff with up to 3 retries before surfacing an error.

\- \*\*Partial Success:\*\* Sync operations report per-product success and failure rather than failing the entire batch.

\- \*\*No Silent Failures:\*\* Every failed sync, disconnection, or tag error is logged and surfaced via in-app notification.

\- \*\*User-Friendly Messages:\*\* All error messages presented in the UI use plain language with a clear resolution path.



\---



\## 11. Acceptance Criteria



| ID | Criteria | Target | Test Method |

|----|----------|--------|-------------|

| \*\*AC-COM-001\*\* | Product catalog syncs to all connected platforms following any update | <5 minutes | Automated timing test on product update |

| \*\*AC-COM-002\*\* | Sales performance data refreshes after commerce activity | <1 hour latency | Analytics timestamp validation |

| \*\*AC-COM-003\*\* | Content attribution accurately links sales to specific content pieces | ≥99% attribution accuracy | Multi-touch attribution audit |

| \*\*AC-COM-004\*\* | Product tagging functions correctly on all supported platforms | Instagram, Facebook, TikTok | Manual QA on each platform |

| \*\*AC-COM-005\*\* | Checkout session completes end-to-end within time limit | <10 seconds | Load test with simulated checkout |

| \*\*AC-COM-006\*\* | Audience insights and behavior data updates after shopping activity | <24 hours | Data freshness audit |

| \*\*AC-COM-007\*\* | Product catalog scales to the required capacity | 1,000+ products without performance degradation | Load test with 1,000 product catalog |

| \*\*AC-COM-008\*\* | Product images render within acceptable time on all screens | <2 seconds on 4G connection | Lighthouse performance audit |

| \*\*AC-COM-009\*\* | Order status reflects platform updates in real time | Real-time via webhook | Webhook event test |

| \*\*AC-COM-010\*\* | Conversion rates calculate correctly across all platforms | ≥99% mathematical accuracy | Data validation against raw platform exports |

| \*\*AC-COM-011\*\* | Out-of-stock products are automatically detagged | Within 5 minutes of inventory reaching zero | Inventory depletion test |

| \*\*AC-COM-012\*\* | Data export produces complete, accurate file | Matches on-screen data, no missing rows | Manual export and comparison audit |

| \*\*AC-COM-013\*\* | Low-stock alert fires when inventory hits threshold | Within 15 minutes of threshold breach | Inventory threshold test |

| \*\*AC-COM-014\*\* | Platform disconnection triggers admin alert | Within 5 minutes of token expiry | Token revocation test |



\---



\## 12. Edge Cases



| ID | Edge Case | Description | Handling |

|----|-----------|-------------|----------|

| \*\*EC-COM-001\*\* | Product runs out of stock while tagged in active content | Inventory depletes to zero mid-campaign | Auto-pause all active tags; fire out-of-stock notification; restore tags when restocked |

| \*\*EC-COM-002\*\* | Platform API rate limits exceeded during bulk sync | Large catalog triggers rate limiting | Queue all requests with exponential backoff; surface progress in sync status endpoint |

| \*\*EC-COM-003\*\* | Product image upload fails | Network error or file format issue | Validate format and size client-side; retry upload up to 3 times; surface actionable error |

| \*\*EC-COM-004\*\* | Large catalog sync (1,000+ products) | Performance and timeout risk on full sync | Batch processing in groups of 50; async processing with progress tracking |

| \*\*EC-COM-005\*\* | Order contains a product archived after purchase | Product removed from catalog post-order | Retain product snapshot in `orders.products` JSONB at time of order; flag for review |

| \*\*EC-COM-006\*\* | Platform rejects product during sync due to policy violation | Platform-side content policy check fails | Log rejection reason; alert admin with platform-provided reason; exclude from sync until resolved |

| \*\*EC-COM-007\*\* | Duplicate order received from platform webhook retry | Platform sends same order event twice | Idempotency key on `platform\_order\_id`; deduplicate on insert |

| \*\*EC-COM-008\*\* | User tags same product twice in one post | Accidental duplicate tagging attempt | Return `DUPLICATE\_TAG` error (409); surface clear message; no duplicate created |

| \*\*EC-COM-009\*\* | Platform changes tag limit mid-campaign | Platform reduces allowed tags per post | Validate against current platform limit on every tag creation; alert manager if existing tags exceed new limit |

| \*\*EC-COM-010\*\* | Variant-level inventory depletes while parent product shows in stock | Parent inventory count does not reflect variant depletion | Inventory system tracks variant-level stock separately; in-stock status derived from variant availability |



\---



\## 13. Future Enhancements



| ID | Enhancement | Description | Priority | Target Timeline |

|----|-------------|-------------|----------|-----------------|

| \*\*FE-COM-001\*\* | Shopify \& WooCommerce Integration | Bidirectional product and inventory sync with major e-commerce platforms | High | Month 10 |

| \*\*FE-COM-002\*\* | AI Product Recommendations | Suggest products to tag based on content copy, audience, and historical performance | Medium | Year 2 Q1 |

| \*\*FE-COM-003\*\* | Multi-Currency Support | Display and transact in multiple currencies with automatic NGN conversion | Medium | Year 2 Q1 |

| \*\*FE-COM-004\*\* | Customer Journey Analytics | Full funnel visualization from first touch to repeat purchase across sessions | Medium | Year 2 Q2 |

| \*\*FE-COM-005\*\* | Automated Checkout Optimization | A/B test checkout flows and surface the highest-converting configuration | Low | Year 2 Q3 |

| \*\*FE-COM-006\*\* | Influencer Commerce Attribution | Track and report on influencer-driven sales with commission calculation support | Medium | Year 2 Q2 |

| \*\*FE-COM-007\*\* | Social Commerce Marketplace | Branded storefront embedded within the platform for direct discovery | Low | Year 3 |

| \*\*FE-COM-008\*\* | Pinterest Shopping Integration | Extend social commerce to Pinterest with catalog sync and product pins | Low | Year 2 Q4 |

| \*\*FE-COM-009\*\* | WhatsApp Commerce Integration | Enable product sharing and order initiation via WhatsApp for Nigerian market | High | Year 2 Q1 |



\---



\## 14. Glossary



| Term | Definition |

|------|------------|

| \*\*Product Catalog\*\* | The centralized repository of all products available for sale across connected platforms |

| \*\*Product Tagging\*\* | The act of linking a specific product to a social media post, story, or reel so customers can click and purchase |

| \*\*Shoppable Post\*\* | A social media post with embedded product tags that enable direct purchase without leaving the platform |

| \*\*Native Checkout\*\* | Completing a purchase within the social platform (e.g., Instagram Checkout) without visiting an external website |

| \*\*External Checkout\*\* | Completing a purchase on the brand's own website after clicking through from a social platform |

| \*\*Attribution\*\* | The process of linking a sale to the specific content, platform, or touchpoint that contributed to the purchase |

| \*\*Multi-Touch Attribution\*\* | An attribution model that distributes credit across all content interactions in the customer journey, not just the last click |

| \*\*Conversion Rate\*\* | The percentage of product impressions that result in a completed sale: (Sales ÷ Impressions) × 100 |

| \*\*Cart Abandonment Rate\*\* | The percentage of checkout initiations that do not result in a completed purchase: ((Initiated − Completed) ÷ Initiated) × 100 |

| \*\*SKU\*\* | Stock Keeping Unit — a unique alphanumeric code identifying a specific product or product variant |

| \*\*Product Sync\*\* | The process of pushing product data from the central catalog to one or more connected social platforms |

| \*\*Inventory Status\*\* | The availability state of a product: `in\_stock`, `low\_stock`, or `out\_of\_stock` |

| \*\*Collections\*\* | Curated groupings of products organized by theme, campaign, or season for platform display |

| \*\*Platform Fee\*\* | A transaction fee charged by the social platform (e.g., Instagram, TikTok) on native checkout sales |

| \*\*NGN\*\* | Nigerian Naira — the base currency for all pricing and revenue figures in this module (symbol: ₦) |



\---



\## 15. Document Version History



| Version | Date | Author | Changes |

|---------|------|--------|---------|

| 1.0.0 | 2026-07-21 | Engineering Lead | Initial Social Commerce module specification — full feature set, API surface, data model, RBAC, UI wireframes, notifications, and error handling |



\---



&#x20;

