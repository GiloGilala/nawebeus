// db/schema/commerce/index.ts
//
// Social Commerce module — v4 (consolidated + operations-hardened).
//
// Tables (5):
//   products           — product catalog with inventory, dimensions, and social tags
//   product_discounts  — discount rules with coupon codes and applicability conditions
//   orders             — orders from social and web channels with lifecycle timestamps
//   carts              — abandoned cart tracking and recovery
//   product_sync_logs  — platform sync audit trail
//
// Tables removed → shared modules:
//   commerceAnalytics  → shared/analytics.ts (analytics_aggregates)
//   productMedia       → media JSONB on products (denormalized; promote to
//                          product_media table if independent media queries emerge)
//   inventoryReservations → columns on products (denormalized count from
//                             active carts; promote to separate table when
//                             per-cart reservation tracking is needed)
//
// Design decisions:
//
//   UUID primary keys (commerce-specific):
//     - Products and orders may be synced from external platforms
//       (Shopify, WooCommerce) that use UUIDs natively
//     - Cart session IDs are externally generated
//     - Consistent with commerce platform conventions
//
//   orders.products JSONB snapshot:
//     Price at time of purchase must be preserved (price may change later).
//     Product may be discontinued after purchase. The order remains
//     immutable. NEVER join historical orders back to products.
//
//   Inventory reservation:
//     inventoryOnHand: physical count (was just `inventory`)
//     inventoryReserved: sum of items in active carts
//     available = onHand - reserved (computed at query time)
//     Prevents overselling when two customers add the same item.
//
//   Coupon codes:
//     couponCode is separate from `name`. Some discounts have codes
//     (WELCOME20); others are automatic (cart-wide discount).
//     Case-insensitive uniqueness within the org.
//
//   Discount applicability:
//     conditions JSONB replaces the (product, category, collection)
//     target columns for advanced cases (customer segment, location,
//     minimum quantity, first purchase only). Backwards-compatible
//     columns kept for simple cases.
//
//   Order lifecycle timestamps:
//     paidAt, confirmedAt, processingAt, packedAt, shippedAt,
//     deliveredAt, completedAt, cancelledAt, refundedAt.
//     Minimal CHECK constraints; status field is the primary state.
//
//   Multi-currency support:
//     exchangeRate + baseCurrency for historical conversion.
//     NGN-first; exchangeRate defaults to 1.0 for NGN orders.
//
//   Shipping dimensions as JSONB:
//     weight, dimensions, package weight, dimensional weight,
//     shipping class, HS code, country of origin — all in one
//     JSONB column. Don't normalize to 6+ flat columns.
//
//   searchVector:
//     Generated column from name + description + brand + tags.
//     GIN-indexed for full-text search.
//
//   Per-tag metrics in tagsActive:
//     clicks/conversions/revenue REMOVED from the JSONB.
//     These belong in analytics_aggregates (shared module).
//     tagsActive now stores only tag identity and lifecycle
//     (contentId, platform, position, status, addedAt, lastSynced).
//
//   No soft delete on orders/carts/sync_logs:
//     Orders are financial records. Carts are short-lived.
//     Sync logs are operational. Only products support soft delete
//     (regulatory retention requirement).

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  decimal,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  commercePlatformEnum,
  discountStatusEnum,
  discountTypeEnum,
  orderFulfillmentStatusEnum,
  orderPaymentStatusEnum,
  orderStatusEnum,
  paymentMethodEnum,
  productInventoryStatusEnum,
  productSyncStatusEnum,
  syncTriggerTypeEnum,
  syncTypeEnum,
} from "../shared/enums";

// =============================================================================
// PRODUCTS
// =============================================================================

/**
 * Product catalog with inventory tracking and social commerce tags.
 *
 * Inventory management:
 *   inventoryOnHand: physical stock count
 *   inventoryReserved: sum of items in active (non-abandoned) carts
 *   available = onHand - reserved (computed at query time)
 *   lowStockThreshold: alert when available <= threshold
 *   inventoryStatus: derived (see CHECK constraints)
 *
 * Shipping dimensions (JSONB):
 *   {
 *     weight: { value, unit: 'kg' | 'g' | 'lb' },
 *     dimensions: { length, width, height, unit: 'cm' | 'm' | 'inch' },
 *     packageWeight?: { value, unit },
 *     dimensionalWeight?: { value, unit },
 *     shippingClass?: 'standard' | 'oversized' | 'hazmat' | 'fragile',
 *     hsCode?: string,
 *     countryOfOrigin?: string
 *   }
 *
 * Social commerce tags (tagsActive JSONB):
 *   [
 *     {
 *       contentId, platform, contentType,
 *       position: { x, y },
 *       status, addedAt, lastSynced
 *     }
 *   ]
 *   Note: clicks/conversions/revenue per tag moved to analytics_aggregates.
 *
 * searchVector:
 *   Generated column from name + description + brand + tags.
 *   GIN-indexed for full-text search.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),

    // ─── Versioning (sync conflict resolution) ────────────────────────────────
    // Increments on every update. Sync engine compares versions to
    // detect conflicts.
    version: integer("version").default(1).notNull(),

    // ─── Basic Info ───────────────────────────────────────────────────────────
    name: text("name").notNull(),
    description: text("description"),
    sku: text("sku").notNull(),
    slug: text("slug"),

    // ─── Pricing ──────────────────────────────────────────────────────────────
    // Selling price
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),

    // Original/compare-at price (for "was ₦X, now ₦Y" display)
    compareAtPrice: decimal("compare_at_price", { precision: 12, scale: 2 }),

    // Cost of Goods Sold (for profit/margin calculations)
    // Encrypted at app layer for some orgs (sensitive pricing strategy)
    costPrice: decimal("cost_price", { precision: 12, scale: 2 }),

    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Categorization ───────────────────────────────────────────────────────
    category: text("category"),
    subcategory: text("subcategory"),
    brand: text("brand"),
    tags: text("tags").array(),
    collections: text("collections").array(),

    // ─── Media ────────────────────────────────────────────────────────────────
    // Array of image URLs (first = primary) — fast-access subset
    images: text("images").array(),

    // Rich media: video, 3D, AR, 360 (typed JSONB for future flexibility)
    media: jsonb("media")
      .$type<
        Array<{
          type: "image" | "video" | "3d" | "ar" | "360";
          url: string;
          thumbnailUrl?: string;
          alt?: string;
          width?: number;
          height?: number;
          duration?: number;
        }>
      >()
      .default([]),

    videoUrl: text("video_url"),
    thumbnailUrl: text("thumbnail_url"),

    // ─── Variants ─────────────────────────────────────────────────────────────
    variants: jsonb("variants"),

    // ─── Inventory ────────────────────────────────────────────────────────────
    inventoryOnHand: integer("inventory_on_hand").notNull(),
    inventoryReserved: integer("inventory_reserved").default(0).notNull(),
    lowStockThreshold: integer("low_stock_threshold").default(10).notNull(),
    inventoryStatus: productInventoryStatusEnum("inventory_status").notNull(),
    inventoryLastUpdated: timestamp("inventory_last_updated", {
      withTimezone: true,
    }),

    // ─── Shipping ─────────────────────────────────────────────────────────────
    // See JSDoc for structure. Avoids 6+ flat columns.
    shippingDimensions: jsonb("shipping_dimensions"),

    // ─── Platform Sync ────────────────────────────────────────────────────────
    platformIds: jsonb("platform_ids"),

    // ─── Social Commerce Tags ─────────────────────────────────────────────────
    // See JSDoc for structure (analytics moved to shared module)
    tagsActive: jsonb("tags_active").default([]).notNull(),

    // ─── SEO ──────────────────────────────────────────────────────────────────
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    // ─── External Source ──────────────────────────────────────────────────────
    externalPlatform: text("external_platform"),
    externalProductId: text("external_product_id"),
    externalSourceUrl: text("external_source_url"),

    // ─── Status ───────────────────────────────────────────────────────────────
    isActive: boolean("is_active").default(true).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // ─── Soft Delete ──────────────────────────────────────────────────────────
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),

    // ─── Search ───────────────────────────────────────────────────────────────
    // Generated column from name + description + brand + tags.
    // GIN-indexed via raw SQL migration.
    searchVector: text("search_vector").generatedAlwaysAs(sql`
      to_tsvector('english',
        coalesce(name, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(brand, '') || ' ' ||
        array_to_string(coalesce(tags, ARRAY[]::text[]), ' ')
      )
    `),

    // ─── Metadata ─────────────────────────────────────────────────────────────
    createdById: uuid("created_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ── Constraints ──────────────────────────────────────────────────────────

    unique("uq_products_org_sku").on(table.organizationId, table.sku),
    unique("uq_products_org_slug").on(table.organizationId, table.slug),

    check("chk_prod_version_positive", sql`${table.version} >= 1`),
    check("chk_prod_price_non_negative", sql`${table.price}::numeric >= 0`),
    check(
      "chk_prod_compare_price_non_negative",
      sql`${table.compareAtPrice} IS NULL
        OR ${table.compareAtPrice}::numeric >= 0`,
    ),
    check(
      "chk_prod_compare_price_gte_price",
      sql`${table.compareAtPrice} IS NULL
        OR ${table.compareAtPrice}::numeric >= ${table.price}::numeric`,
    ),
    check(
      "chk_prod_cost_price_non_negative",
      sql`${table.costPrice} IS NULL
        OR ${table.costPrice}::numeric >= 0`,
    ),

    // Inventory consistency
    check("chk_prod_inventory_on_hand_non_negative", sql`${table.inventoryOnHand} >= 0`),
    check("chk_prod_inventory_reserved_non_negative", sql`${table.inventoryReserved} >= 0`),
    check(
      "chk_prod_inventory_reserved_lte_on_hand",
      sql`${table.inventoryReserved} <= ${table.inventoryOnHand}`,
    ),
    check("chk_prod_low_stock_threshold_positive", sql`${table.lowStockThreshold} > 0`),

    // Inventory status must match inventory count
    check(
      "chk_prod_inventory_status_consistency",
      sql`(${table.inventoryStatus} = 'discontinued')
        OR (${table.inventoryOnHand} = 0 AND ${table.inventoryStatus} = 'out_of_stock')
        OR (${table.inventoryOnHand} > 0
            AND ${table.inventoryOnHand} <= ${table.lowStockThreshold}
            AND ${table.inventoryStatus} = 'low_stock')
        OR (${table.inventoryOnHand} > ${table.lowStockThreshold}
            AND ${table.inventoryStatus} = 'in_stock')`,
    ),

    // Status consistency
    check(
      "chk_prod_deleted_consistency",
      sql`(${table.isDeleted} = FALSE AND ${table.deletedAt} IS NULL AND ${table.deletedBy} IS NULL)
        OR (${table.isDeleted} = TRUE AND ${table.deletedAt} IS NOT NULL AND ${table.deletedBy} IS NOT NULL)`,
    ),
    check(
      "chk_prod_published_consistency",
      sql`${table.isPublished} = FALSE OR ${table.publishedAt} IS NOT NULL`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_prod_org").on(table.organizationId).where(sql`${table.isDeleted} = FALSE`),
    index("idx_prod_sku").on(table.organizationId, table.sku),
    index("idx_prod_inventory_status")
      .on(table.inventoryStatus)
      .where(sql`${table.isDeleted} = FALSE`),
    index("idx_prod_active")
      .on(table.organizationId, table.isPublished)
      .where(
        sql`${table.isActive} = TRUE
          AND ${table.isDeleted} = FALSE
          AND ${table.isArchived} = FALSE`,
      ),
    index("idx_prod_category")
      .on(table.organizationId, table.category)
      .where(sql`${table.isDeleted} = FALSE`),
    index("idx_prod_external")
      .on(table.externalPlatform, table.externalProductId)
      .where(sql`${table.externalPlatform} IS NOT NULL`),

    // GIN (raw SQL migration):
    // CREATE INDEX idx_prod_tags ON products USING GIN(tags)
    //   WHERE is_deleted = FALSE;
    // CREATE INDEX idx_prod_tags_active ON products USING GIN(tags_active)
    //   WHERE is_deleted = FALSE;
    // CREATE INDEX idx_prod_collections ON products USING GIN(collections)
    //   WHERE is_deleted = FALSE;
    // CREATE INDEX idx_prod_media ON products USING GIN(media)
    //   WHERE is_deleted = FALSE;
    // CREATE INDEX idx_prod_shipping_dimensions ON products USING GIN(shipping_dimensions)
    //   WHERE is_deleted = FALSE;
    // CREATE INDEX idx_prod_search ON products USING GIN(search_vector)
    //   WHERE is_deleted = FALSE;
  ],
);

// =============================================================================
// PRODUCT DISCOUNTS
// =============================================================================

/**
 * Discount rules with coupon codes and applicability conditions.
 *
 * Discount types:
 *   percentage: 0–100, applied as % of subtotal
 *   fixed: amount in Naira subtracted from subtotal
 *   buy_x_get_y: complex — uses conditions JSONB for specifics
 *   free_shipping: shipping cost waived
 *
 * Targeting (simple):
 *   productId: specific product
 *   collection: named collection
 *   category: product category
 *
 * Targeting (complex, via conditions JSONB):
 *   {
 *     customerSegmentIds?: string[],
 *     membershipTiers?: string[],
 *     locations?: string[], // ISO 3166-1 alpha-2
 *     minimumQuantity?: number,
 *     firstPurchaseOnly?: boolean,
 *     customerTags?: string[]
 *   }
 *
 * couponCode:
 *   Distinct from `name`. Some discounts are automatic (cart-wide);
 *   others require an entered code (WELCOME20, BLACKFRIDAY).
 *   Case-insensitive uniqueness per org.
 */
export const productDiscounts = pgTable(
  "product_discounts",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),

    // ─── Target (simple) ─────────────────────────────────────────────────────
    productId: uuid("product_id"),
    collection: text("collection"),
    category: text("category"),

    // ─── Discount Details ─────────────────────────────────────────────────────
    name: text("name").notNull(),
    description: text("description"),

    // Customer-facing code (distinct from internal name)
    couponCode: varchar("coupon_code", { length: 50 }),

    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: decimal("discount_value", {
      precision: 10,
      scale: 2,
    }).notNull(),

    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Applicability Conditions (complex targeting) ────────────────────────
    // See JSDoc for structure
    conditions: jsonb("conditions"),

    // ─── Rules ────────────────────────────────────────────────────────────────
    minOrderAmount: decimal("min_order_amount", { precision: 12, scale: 2 }),
    maxUses: integer("max_uses"),
    maxUsesPerCustomer: integer("max_uses_per_customer"),
    usageCount: integer("usage_count").default(0).notNull(),

    // ─── Timing ───────────────────────────────────────────────────────────────
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    timezone: varchar("timezone", { length: 100 }).default("Africa/Lagos").notNull(),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: discountStatusEnum("status").default("draft").notNull(),

    createdById: uuid("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case-insensitive unique coupon code per org
    uniqueIndex("uq_disc_org_coupon")
      .on(sql`lower(${table.couponCode})`, table.organizationId)
      .where(sql`${table.couponCode} IS NOT NULL`),

    check("chk_disc_value_positive", sql`${table.discountValue}::numeric > 0`),
    check(
      "chk_disc_percentage_max",
      sql`${table.discountType} <> 'percentage'
        OR ${table.discountValue}::numeric <= 100`,
    ),
    check(
      "chk_disc_min_order_non_negative",
      sql`${table.minOrderAmount} IS NULL
        OR ${table.minOrderAmount}::numeric >= 0`,
    ),
    check("chk_disc_max_uses_positive", sql`${table.maxUses} IS NULL OR ${table.maxUses} > 0`),
    check(
      "chk_disc_max_uses_per_customer_positive",
      sql`${table.maxUsesPerCustomer} IS NULL
        OR ${table.maxUsesPerCustomer} > 0`,
    ),
    check("chk_disc_usage_count_non_negative", sql`${table.usageCount} >= 0`),
    check(
      "chk_disc_usage_lte_max",
      sql`${table.maxUses} IS NULL
        OR ${table.usageCount} <= ${table.maxUses}`,
    ),
    check(
      "chk_disc_expires_after_starts",
      sql`${table.expiresAt} IS NULL
        OR ${table.expiresAt} > ${table.startsAt}`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_disc_org").on(table.organizationId),
    index("idx_disc_product").on(table.productId).where(sql`${table.productId} IS NOT NULL`),
    index("idx_disc_status")
      .on(table.organizationId, table.status)
      .where(sql`${table.status} = 'active'`),
    index("idx_disc_expires")
      .on(table.expiresAt)
      .where(sql`${table.status} = 'active' AND ${table.expiresAt} IS NOT NULL`),
  ],
);

// =============================================================================
// ORDERS
// =============================================================================

/**
 * Orders from social and web channels with full lifecycle tracking.
 *
 * Financial fields (all in Nigerian Naira):
 *   subtotal, discountTotal, shippingCost, taxTotal, platformFee,
 *   totalAmount, refundedAmount
 *
 * Multi-currency:
 *   exchangeRate + baseCurrency for historical conversion
 *   (NGN-first; exchangeRate = 1.0 for NGN orders)
 *
 * Payment:
 *   paymentMethod: card | bank_transfer | wallet | paystack | flutterwave |
 *                  cash_on_delivery | paypal | other
 *   paymentReference: bank/transfer reference for reconciliation
 *   paymentTransactionId: gateway's transaction ID
 *   gatewayResponse: full API response JSON for debugging
 *
 * Lifecycle timestamps (all nullable, set as order progresses):
 *   paidAt, confirmedAt, processingAt, packedAt, shippedAt,
 *   deliveredAt, completedAt, cancelledAt, refundedAt
 *
 * Fulfillment status: separate from overall status (an order can be
 *   paid but unfulfilled, or shipped but not yet delivered).
 *
 * Attribution:
 *   contentId, influencerId, attributionChain JSONB (multi-touch)
 *   UTM parameters for web analytics
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),

    // ─── Order Identifiers ────────────────────────────────────────────────────
    orderNumber: text("order_number").notNull(),
    invoiceNumber: varchar("invoice_number", { length: 50 }),
    invoiceUrl: text("invoice_url"), // pointer to media_assets

    platform: commercePlatformEnum("platform").notNull(),
    platformOrderId: text("platform_order_id"),

    // ─── Customer ─────────────────────────────────────────────────────────────
    customerId: uuid("customer_id"),
    customerEmail: text("customer_email"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),

    // ─── Products (Purchase-time snapshot, immutable) ──────────────────────────
    products: jsonb("products")
      .$type<
        Array<{
          productId: string;
          name: string;
          variant?: string;
          sku: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          discountApplied?: number;
        }>
      >()
      .notNull(),

    // ─── Pricing (all in Naira) ───────────────────────────────────────────────
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
    discountTotal: decimal("discount_total", { precision: 12, scale: 2 }).default("0").notNull(),
    shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }).default("0").notNull(),
    taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).default("0").notNull(),
    platformFee: decimal("platform_fee", { precision: 12, scale: 2 }).default("0").notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    refundedAmount: decimal("refunded_amount", { precision: 12, scale: 2 }).default("0").notNull(),

    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
    exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }).default("1.0").notNull(),
    baseCurrency: varchar("base_currency", { length: 3 }).default("NGN").notNull(),

    // ─── Discounts Applied ────────────────────────────────────────────────────
    discountCodes: text("discount_codes").array(),
    discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0").notNull(),

    // ─── Addresses ────────────────────────────────────────────────────────────
    shippingAddress: jsonb("shipping_address"),
    billingAddress: jsonb("billing_address"),

    // ─── Payment ──────────────────────────────────────────────────────────────
    paymentMethod: paymentMethodEnum("payment_method"),
    paymentReference: varchar("payment_reference", { length: 255 }),
    paymentTransactionId: varchar("payment_transaction_id", { length: 255 }),
    gatewayResponse: jsonb("gateway_response"),

    // ─── Fulfillment ──────────────────────────────────────────────────────────
    fulfillmentStatus: orderFulfillmentStatusEnum("fulfillment_status")
      .default("unfulfilled")
      .notNull(),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),

    // ─── Status ───────────────────────────────────────────────────────────────
    status: orderStatusEnum("status").notNull(),
    paymentStatus: orderPaymentStatusEnum("payment_status").notNull(),

    // ─── Attribution ──────────────────────────────────────────────────────────
    contentId: uuid("content_id"),
    influencerId: uuid("influencer_id"),
    attributionChain: jsonb("attribution_chain"),

    // ─── UTM Tracking ─────────────────────────────────────────────────────────
    sourceUrl: text("source_url"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),

    // ─── Order Context (for fraud detection) ──────────────────────────────────
    orderContext: jsonb("order_context").$type<{
      ipAddress?: string;
      userAgent?: string;
      device?: {
        type: "mobile" | "tablet" | "desktop";
        os?: string;
        browser?: string;
      };
      referrer?: string;
    }>(),

    // ─── Notes ────────────────────────────────────────────────────────────────
    notes: text("notes"),
    internalNotes: text("internal_notes"),

    // ─── Lifecycle Timestamps ─────────────────────────────────────────────────
    paidAt: timestamp("paid_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    processingAt: timestamp("processing_at", { withTimezone: true }),
    packedAt: timestamp("packed_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),

    // ─── Metadata ─────────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_orders_org_number").on(table.organizationId, table.orderNumber),

    uniqueIndex("uq_orders_invoice")
      .on(table.organizationId, table.invoiceNumber)
      .where(sql`${table.invoiceNumber} IS NOT NULL`),

    check("chk_ord_version_positive", sql`true`), // placeholder; not used
    check("chk_ord_subtotal_non_negative", sql`${table.subtotal}::numeric >= 0`),
    check("chk_ord_total_non_negative", sql`${table.totalAmount}::numeric >= 0`),
    check("chk_ord_discount_total_non_negative", sql`${table.discountTotal}::numeric >= 0`),
    check("chk_ord_shipping_non_negative", sql`${table.shippingCost}::numeric >= 0`),
    check("chk_ord_tax_non_negative", sql`${table.taxTotal}::numeric >= 0`),
    check("chk_ord_platform_fee_non_negative", sql`${table.platformFee}::numeric >= 0`),
    check("chk_ord_refunded_amount_non_negative", sql`${table.refundedAmount}::numeric >= 0`),
    check(
      "chk_ord_refunded_lte_total",
      sql`${table.refundedAmount}::numeric <= ${table.totalAmount}::numeric`,
    ),
    check("chk_ord_exchange_rate_positive", sql`${table.exchangeRate}::numeric > 0`),

    // Lifecycle ordering
    check(
      "chk_ord_delivered_after_shipped",
      sql`${table.deliveredAt} IS NULL
        OR ${table.shippedAt} IS NULL
        OR ${table.deliveredAt} >= ${table.shippedAt}`,
    ),
    check(
      "chk_ord_completed_after_delivered",
      sql`${table.completedAt} IS NULL
        OR ${table.deliveredAt} IS NULL
        OR ${table.completedAt} >= ${table.deliveredAt}`,
    ),
    check(
      "chk_ord_paid_at_consistency",
      sql`${table.paidAt} IS NULL
        OR ${table.paymentStatus} NOT IN ('pending', 'failed')`,
    ),
    check(
      "chk_ord_cancelled_consistency",
      sql`${table.cancelledAt} IS NULL OR ${table.status} = 'cancelled'`,
    ),
    check(
      "chk_ord_refunded_consistency",
      sql`${table.refundedAt} IS NULL OR ${table.status} = 'refunded'`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_ord_org").on(table.organizationId, table.createdAt),
    index("idx_ord_status").on(table.organizationId, table.status),
    index("idx_ord_payment_status").on(table.organizationId, table.paymentStatus),
    index("idx_ord_fulfillment").on(table.organizationId, table.fulfillmentStatus),
    index("idx_ord_payment_method").on(table.organizationId, table.paymentMethod),
    index("idx_ord_platform").on(table.organizationId, table.platform),
    index("idx_ord_customer").on(table.customerId).where(sql`${table.customerId} IS NOT NULL`),
    index("idx_ord_content").on(table.contentId).where(sql`${table.contentId} IS NOT NULL`),
    index("idx_ord_influencer")
      .on(table.influencerId)
      .where(sql`${table.influencerId} IS NOT NULL`),
    index("idx_ord_created_at").on(table.organizationId, table.createdAt),
    index("idx_ord_platform_order_id")
      .on(table.platform, table.platformOrderId)
      .where(sql`${table.platformOrderId} IS NOT NULL`),
    index("idx_ord_invoice_number")
      .on(table.organizationId, table.invoiceNumber)
      .where(sql`${table.invoiceNumber} IS NOT NULL`),

    // GIN (raw SQL migration):
    // CREATE INDEX idx_ord_products ON orders USING GIN(products);
    // CREATE INDEX idx_ord_attribution_chain ON orders USING GIN(attribution_chain);
  ],
);

// =============================================================================
// CARTS (Abandoned Cart Tracking)
// =============================================================================

/**
 * Cart tracking for abandoned cart recovery campaigns.
 *
 * Inventory reservation:
 *   When a cart is created or items are added, the product's
 *   inventoryReserved is incremented. When the cart is recovered
 *   (converted to order) or expires/abandons, the reservation
 *   is decremented. This prevents overselling.
 *
 * Recovery automation:
 *   recoveryEmailSent/recoveryEmailSentAt
 *   recoverySmsSent/recoverySmsSentAt
 *   Additional touchpoints (WhatsApp, push) via analytics_events.
 *
 * Device context (JSONB):
 *   Single column for deviceType, browser, os, ip, userAgent
 *   (rejected the 5-flat-column approach)
 */
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),

    // ─── Customer ─────────────────────────────────────────────────────────────
    customerId: uuid("customer_id"),
    sessionId: text("session_id").notNull(),

    // ─── Cart Contents (typed) ────────────────────────────────────────────────
    items: jsonb("items")
      .$type<
        Array<{
          productId: string;
          variant?: string;
          quantity: number;
          unitPrice: number;
          addedAt: string;
        }>
      >()
      .notNull(),

    // ─── Pricing (all in Naira) ───────────────────────────────────────────────
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
    discountTotal: decimal("discount_total", { precision: 12, scale: 2 }).default("0").notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),

    // ─── Abandonment Status ───────────────────────────────────────────────────
    isAbandoned: boolean("is_abandoned").default(false).notNull(),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),

    // ─── Recovery Tracking ────────────────────────────────────────────────────
    recoveryEmailSent: boolean("recovery_email_sent").default(false).notNull(),
    recoveryEmailSentAt: timestamp("recovery_email_sent_at", {
      withTimezone: true,
    }),
    recoverySmsSent: boolean("recovery_sms_sent").default(false).notNull(),
    recoverySmsSentAt: timestamp("recovery_sms_sent_at", {
      withTimezone: true,
    }),
    isRecovered: boolean("is_recovered").default(false).notNull(),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),

    // ─── Attribution ──────────────────────────────────────────────────────────
    sourceUrl: text("source_url"),
    utmSource: text("utm_source"),
    utmCampaign: text("utm_campaign"),
    contentId: uuid("content_id"),
    influencerId: uuid("influencer_id"),

    // ─── Device Context (JSONB) ──────────────────────────────────────────────
    deviceContext: jsonb("device_context").$type<{
      device?: {
        type: "mobile" | "tablet" | "desktop";
        os?: string;
        browser?: string;
      };
      ipAddress?: string;
      userAgent?: string;
    }>(),

    // ─── Timestamps ───────────────────────────────────────────────────────────
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_cart_subtotal_non_negative", sql`${table.subtotal}::numeric >= 0`),
    check("chk_cart_total_non_negative", sql`${table.totalAmount}::numeric >= 0`),
    check(
      "chk_cart_abandoned_consistency",
      sql`(${table.isAbandoned} = FALSE AND ${table.abandonedAt} IS NULL)
        OR (${table.isAbandoned} = TRUE AND ${table.abandonedAt} IS NOT NULL)`,
    ),
    check(
      "chk_cart_recovered_consistency",
      sql`(${table.isRecovered} = FALSE AND ${table.recoveredAt} IS NULL)
        OR (${table.isRecovered} = TRUE AND ${table.recoveredAt} IS NOT NULL)`,
    ),
    check(
      "chk_cart_recovered_requires_abandoned",
      sql`${table.isRecovered} = FALSE OR ${table.isAbandoned} = TRUE`,
    ),
    check(
      "chk_cart_recovery_email_requires_abandoned",
      sql`${table.recoveryEmailSent} = FALSE OR ${table.isAbandoned} = TRUE`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_cart_org").on(table.organizationId),
    index("idx_cart_session").on(table.sessionId),
    index("idx_cart_customer").on(table.customerId).where(sql`${table.customerId} IS NOT NULL`),
    index("idx_cart_abandoned")
      .on(table.organizationId, table.abandonedAt)
      .where(sql`${table.isAbandoned} = TRUE AND ${table.isRecovered} = FALSE`),
    index("idx_cart_recovery_email")
      .on(table.organizationId, table.abandonedAt)
      .where(
        sql`${table.isAbandoned} = TRUE
          AND ${table.recoveryEmailSent} = FALSE
          AND ${table.isRecovered} = FALSE`,
      ),
    index("idx_cart_recovery_sms")
      .on(table.organizationId, table.abandonedAt)
      .where(
        sql`${table.isAbandoned} = TRUE
          AND ${table.recoverySmsSent} = FALSE
          AND ${table.recoveryEmailSent} = TRUE
          AND ${table.isRecovered} = FALSE`,
      ),
    index("idx_cart_last_activity").on(table.lastActivityAt),
  ],
);

// =============================================================================
// PRODUCT SYNC LOGS
// =============================================================================

/**
 * Append-only audit trail for platform sync operations.
 *
 * Sync types (enum):
 *   full | incremental | price_update | inventory_update | catalog | delete
 *
 * Trigger types (enum):
 *   manual | scheduled | webhook | api
 *
 * durationMs:
 *   Generated column from (completedAt - startedAt) * 1000.
 *   Useful for "average sync time by platform" dashboards.
 */
export const productSyncLogs = pgTable(
  "product_sync_logs",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),

    syncId: text("sync_id").notNull(),
    platform: commercePlatformEnum("platform").notNull(),

    syncType: syncTypeEnum("sync_type").notNull(),
    status: productSyncStatusEnum("status").notNull(),

    // ─── Statistics ───────────────────────────────────────────────────────────
    totalProducts: integer("total_products").default(0).notNull(),
    productsSynced: integer("products_synced").default(0).notNull(),
    productsFailed: integer("products_failed").default(0).notNull(),
    productsCreated: integer("products_created").default(0).notNull(),
    productsUpdated: integer("products_updated").default(0).notNull(),

    // Per-product error details
    errorDetails: jsonb("error_details"),

    // ─── Timing ───────────────────────────────────────────────────────────────
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // Generated: extract(epoch from (completedAt - startedAt)) * 1000
    durationMs: integer("duration_ms").generatedAlwaysAs(sql`
      CASE
        WHEN completed_at IS NULL THEN NULL
        ELSE extract(epoch from (completed_at - started_at)) * 1000
      END
    `),

    // ─── Trigger ──────────────────────────────────────────────────────────────
    triggeredBy: uuid("triggered_by"),
    triggerType: syncTriggerTypeEnum("trigger_type"),

    // No updatedAt — completedAt marks completion
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("chk_psl_total_non_negative", sql`${table.totalProducts} >= 0`),
    check("chk_psl_synced_non_negative", sql`${table.productsSynced} >= 0`),
    check("chk_psl_failed_non_negative", sql`${table.productsFailed} >= 0`),
    check("chk_psl_created_non_negative", sql`${table.productsCreated} >= 0`),
    check("chk_psl_updated_non_negative", sql`${table.productsUpdated} >= 0`),
    check(
      "chk_psl_completed_after_started",
      sql`${table.completedAt} IS NULL
        OR ${table.completedAt} >= ${table.startedAt}`,
    ),

    // ── Indexes ───────────────────────────────────────────────────────────────
    index("idx_psl_org").on(table.organizationId, table.createdAt),
    index("idx_psl_sync_id").on(table.syncId),
    index("idx_psl_platform").on(table.organizationId, table.platform, table.createdAt),
    index("idx_psl_status").on(table.status, table.createdAt),
    index("idx_psl_latest")
      .on(table.organizationId, table.platform, table.startedAt)
      .where(sql`${table.status} = 'completed'`),
  ],
);

// =============================================================================
// RELATIONS
// =============================================================================

export const productsRelations = relations(products, ({ many }) => ({
  discounts: many(productDiscounts, {
    relationName: "product_discounts",
  }),
}));

export const productDiscountsRelations = relations(productDiscounts, ({ one }) => ({
  product: one(products, {
    fields: [productDiscounts.productId],
    references: [products.id],
    relationName: "product_discounts",
  }),
}));

export const ordersRelations = relations(orders, (_) => ({
  // All cross-module references resolved at application layer
}));

export const cartsRelations = relations(carts, (_) => ({
  // All cross-module references resolved at application layer
}));

export const productSyncLogsRelations = relations(productSyncLogs, (_) => ({
  // No relations — standalone operational table
}));
