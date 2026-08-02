// db/schema/relations.ts
//
// Cross-module relation declarations.
//
// This file contains Drizzle ORM relation declarations that span
// module boundaries — cases where a table in one module has a
// structural relationship to a table in another module, but no
// database-level FK constraint (because modules have different
// retention profiles and lifecycle requirements).
//
// Why these exist:
//   Drizzle's relational query API (db.query.X.findMany({ with: { Y } }))
//   requires relation declarations even for cross-module joins.
//   Without these, you'd have to write raw SQL for every cross-module
//   join, which defeats the purpose of the ORM.
//
// Why they're in a separate file:
//   Each module's index.ts declares relations between its own tables.
//   Cross-module relations can't live in either module's file without
//   creating circular imports. This file imports from all modules and
//   declares the cross-cutting relationships.
//
// Important:
//   These are ORM-level relations ONLY. No FK constraints are created.
//   The database does not enforce referential integrity across modules.
//   This is by design — modules have different retention schedules
//   (e.g., audit logs survive org deletion, commerce data survives
//   user deletion, monitoring data may be purged independently).
//
// Naming convention:
//   Relation names use the pattern: sourceTable_targetTable
//   e.g., "contacts_journalist" means contacts → journalists
//
// Tables with cross-module relations:
//   shared/contacts.ts   — contacts → journalists (pr), influencers (influencer)
//   shared/approval.ts   — approval_requests → posts (publishing),
//                          press_releases (pr), engagement_responses (engagement)
//   shared/alerts.ts     — alert_rules/events → monitoring campaigns, articles
//   monitoring/index.ts  — crisis_incidents → alert_events (shared/alerts)
//   pr/index.ts          — pr_coverage_attribution → media_articles (monitoring)
//   engagement/index.ts  — engagement_responses → templates (shared/templates)

import { relations } from "drizzle-orm";

// ─── Shared modules ──────────────────────────────────────────────────────────
import { contacts, contactInteractions } from "./shared/contacts";
import { approvalRequests, approvalHistory } from "./shared/approval";
import { alertRules, alertEvents } from "./shared/alerts";
import { templates } from "./shared/templates";
import { mediaAssets } from "./shared/media";
import { auditLog } from "./shared/audit";
import {
  analyticsAggregates,
  analyticsMetrics,
  analyticsDashboards,
  analyticsReports,
  analyticsEvents,
} from "./shared/analytics";

// ─── Domain modules ──────────────────────────────────────────────────────────
import {
  journalists,
  pressReleases,
  prDistributions,
  prInitiatives,
  prCoverageAttribution,
} from "./pr/index";
import {
  influencers,
  influencerPrograms,
  influencerProgramAssignments,
  influencerContentSubmissions,
} from "./influencer/index";
import {
  monitoringCampaigns,
  mediaArticles,
  monitoringCompetitors,
  crisisIncidents,
} from "./monitoring/index";
import {
  engagementSlaPolicies,
  engagementMessages,
  engagementResponses,
  engagementRoutingRules,
  engagementSlaBreaches,
  engagementAiSuggestions,
} from "./engagement/index";
import { posts, publishingResults } from "./publishing/index";
import {
  products,
  productDiscounts,
  orders,
  carts,
  productSyncLogs,
} from "./commerce/index";
import {
  campaigns,
  campaignEntries,
  campaignEntryMethods,
} from "./campaigns/index";

// =============================================================================
// CONTACTS ↔ DETAIL TABLES
// =============================================================================

/**
 * contacts → journalists (shared-PK inheritance)
 * contacts → influencers (shared-PK inheritance)
 *
 * A contact row with kind = 'journalist' has a corresponding journalists row.
 * A contact row with kind = 'influencer' has a corresponding influencers row.
 * The detail table's PK is a FK to contacts.id.
 *
 * These relations are declared here (not in contacts.ts) because
 * contacts.ts is in shared/ and can't import from pr/ or influencer/.
 */
export const contactsCrossModuleRelations = relations(
  contacts,
  ({ one, many }) => ({
    // Detail table for journalists (pr module)
    journalist: one(journalists, {
      fields: [contacts.id],
      references: [journalists.id],
      relationName: "contact_journalist",
    }),

    // Detail table for influencers (influencer module)
    influencer: one(influencers, {
      fields: [contacts.id],
      references: [influencers.id],
      relationName: "contact_influencer",
    }),

    // All interactions for this contact (across all modules)
    interactions: many(contactInteractions, {
      relationName: "contact_interactions",
    }),
  }),
);

/**
 * contact_interactions → press_releases (pr module)
 * contact_interactions → pr_distributions (pr module)
 * contact_interactions → influencer_programs (influencer module)
 * contact_interactions → influencer_program_assignments (influencer module)
 *
 * These optional FK columns on contact_interactions point to entities
 * in domain modules. No DB-level FK — interactions must survive
 * if the referenced entity is deleted.
 */
export const contactInteractionsCrossModuleRelations = relations(
  contactInteractions,
  ({ one }) => ({
    // The press release this interaction relates to
    pressRelease: one(pressReleases, {
      fields: [contactInteractions.pressReleaseId],
      references: [pressReleases.id],
      relationName: "contactInteraction_pressRelease",
    }),

    // The influencer program this interaction relates to
    influencerProgram: one(influencerPrograms, {
      fields: [contactInteractions.campaignId],
      references: [influencerPrograms.id],
      relationName: "contactInteraction_influencerProgram",
    }),

    // The specific assignment this interaction relates to
    influencerAssignment: one(influencerProgramAssignments, {
      fields: [contactInteractions.assignmentId],
      references: [influencerProgramAssignments.id],
      relationName: "contactInteraction_influencerAssignment",
    }),
  }),
);

// =============================================================================
// APPROVAL ↔ APPROVABLE ENTITIES
// =============================================================================

/**
 * approval_requests → posts (publishing module)
 * approval_requests → press_releases (pr module)
 * approval_requests → engagement_responses (engagement module)
 *
 * approval_requests.entityType + entityId form a polymorphic reference.
 * Drizzle doesn't support polymorphic relations natively, so we declare
 * each possible target as a separate optional relation. The application
 * layer uses entityType to determine which relation to follow.
 *
 * Note: These are ORM convenience relations. The approval module works
 * correctly with just entityType + entityId string matching — these
 * relations only add .with({ post: true }) query support.
 */
export const approvalRequestsCrossModuleRelations = relations(
  approvalRequests,
  ({ one }) => ({
    // When entityType = 'post'
    post: one(posts, {
      fields: [approvalRequests.entityId],
      references: [posts.id],
      relationName: "approvalRequest_post",
    }),

    // When entityType = 'press_release'
    pressRelease: one(pressReleases, {
      fields: [approvalRequests.entityId],
      references: [pressReleases.id],
      relationName: "approvalRequest_pressRelease",
    }),

    // When entityType = 'engagement_response'
    engagementResponse: one(engagementResponses, {
      fields: [approvalRequests.entityId],
      references: [engagementResponses.id],
      relationName: "approvalRequest_engagementResponse",
    }),
  }),
);

// =============================================================================
// CRISIS INCIDENTS ↔ ALERT EVENTS
// =============================================================================

/**
 * crisis_incidents → alert_events (shared/alerts.ts)
 *
 * When a crisis is triggered by an alert, originAlertEventId points
 * to the alert_event that detected the crisis. This forms the
 * traceability chain: alert_rule → alert_event → crisis_incident.
 */
export const crisisIncidentsCrossModuleRelations = relations(
  crisisIncidents,
  ({ one }) => ({
    // The alert event that triggered this crisis
    originAlertEvent: one(alertEvents, {
      fields: [crisisIncidents.originAlertEventId],
      references: [alertEvents.id],
      relationName: "crisisIncident_originAlertEvent",
    }),
  }),
);

// =============================================================================
// PR COVERAGE ↔ MONITORING ARTICLES
// =============================================================================

/**
 * pr_coverage_attribution → media_articles (monitoring module)
 *
 * Coverage attribution records link back to the media article that
 * provided the coverage. This cross-module reference enables:
 * - "Which monitoring article corresponds to this coverage record?"
 * - "What press releases does this article cover?"
 */
export const prCoverageAttributionCrossModuleRelations = relations(
  prCoverageAttribution,
  ({ one }) => ({
    // The media article this coverage was attributed from
    mediaArticle: one(mediaArticles, {
      fields: [prCoverageAttribution.articleId],
      references: [mediaArticles.id],
      relationName: "prCoverage_mediaArticle",
    }),
  }),
);

// =============================================================================
// ALERT RULES ↔ ANALYTICS METRICS
// =============================================================================

/**
 * analytics_alerts → analytics_metrics (both in shared/analytics.ts)
 *
 * This is technically intra-module, but the analytics module's
 * relations file only declared the forward direction. Adding the
 * reverse here for completeness in the relational query API.
 *
 * alert_rules can also reference analytics_metrics via metricId,
 * but alert_rules is in shared/alerts.ts — that cross-reference
 * is resolved at the application layer.
 */

// =============================================================================
// PUBLISHING ↔ SHARED MODULES
// =============================================================================

/**
 * posts → templates (shared/templates.ts)
 * posts → approval_requests (shared/approval.ts)
 *
 * posts.templateId references templates.id
 * posts.currentApprovalRequestId references approval_requests.id
 *
 * These are plain varchar fields (no DB FK) because templates and
 * approval records may be purged independently of posts.
 */
export const postsCrossModuleRelations = relations(posts, ({ one }) => ({
  // The template this post was created from
  template: one(templates, {
    fields: [posts.templateId],
    references: [templates.id],
    relationName: "post_template",
  }),

  // Current pending approval request
  currentApprovalRequest: one(approvalRequests, {
    fields: [posts.currentApprovalRequestId],
    references: [approvalRequests.id],
    relationName: "post_currentApprovalRequest",
  }),
}));

/**
 * press_releases → approval_requests (shared/approval.ts)
 */
export const pressReleasesCrossModuleRelations = relations(
  pressReleases,
  ({ one }) => ({
    // Current pending approval request
    currentApprovalRequest: one(approvalRequests, {
      fields: [pressReleases.currentApprovalRequestId],
      references: [approvalRequests.id],
      relationName: "pressRelease_currentApprovalRequest",
    }),
  }),
);

/**
 * engagement_responses → templates (shared/templates.ts)
 * engagement_responses → approval_requests (shared/approval.ts)
 */
export const engagementResponsesCrossModuleRelations = relations(
  engagementResponses,
  ({ one }) => ({
    // Template used for this response
    template: one(templates, {
      fields: [engagementResponses.templateId],
      references: [templates.id],
      relationName: "engagementResponse_template",
    }),

    // Approval request for this response
    approvalRequest: one(approvalRequests, {
      fields: [engagementResponses.approvalRequestId],
      references: [approvalRequests.id],
      relationName: "engagementResponse_approvalRequest",
    }),
  }),
);

// =============================================================================
// CAMPAIGNS ↔ SHARED MODULES
// =============================================================================

/**
 * campaigns → templates (shared/templates.ts)
 */
export const campaignsCrossModuleRelations = relations(
  campaigns,
  ({ one }) => ({
    // The template this campaign was created from
    template: one(templates, {
      fields: [campaigns.templateId],
      references: [templates.id],
      relationName: "campaign_template",
    }),
  }),
);
