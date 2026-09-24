# NWB-P1-008 — Notification engine core (rules, fan-out dispatch, delivery log, acknowledgement, escalation)

Type: task
Status: done (2026-09-22 — completed per execution plan §5 and roadmap §12)
Blocked by: none (P1-004 email service ready)
Phase: P1 (roadmap Phase 2)
Size: L

## Why this exists

Every downstream module produces events that require real-time awareness and transactional notifications:
- P5 Listening: volume spikes, sentiment crashes, brand keyword mentions.
- P6 Engagement & P7 Publishing: SLA breaches (first response / resolution), approval notices.
- P8 PR & P9 Influencers: outreach follow-ups, coverage detection, content submissions.
- P11 Campaigns & Contests: winner draws, entry approval notifications.
- P12 Analytics: metric anomalies and threshold breaches.
- Core Platform & Security: backup failures, quota exhaustion, impersonation sessions.

`db/shared/alerts.ts` specifies the unified alert foundation (`alert_rules` and `alert_events`), replacing historical fragmented tables (`engagementSlaPolicies`, `listeningAlerts`, `monitoringAlerts`, `analyticsAlerts`).

Before this ticket:
- `db/shared/alerts.ts` schema had `varchar(32)` columns for `id`, `organization_id`, `created_by_id`, `rule_id`, `source_id`, `acknowledged_by_id`, `escalated_to_id`, which conflict with 36-character hyphenated UUIDs (ground-rule-7 drift).
- No service layer existed for creating rules, evaluating rate limits (cooldown & daily caps), fanning out to recipient channels (in-app, email via P1-004 `emailService`), recording per-channel delivery logs, acknowledging alerts, or handling escalations.
- No HTTP routes, server functions, RBAC permissions, or audit actions existed.

## Measured (2026-09-22)

1. **`varchar(32)` ID column widening**:
   - `alert_rules`: `id`, `organization_id`, `created_by_id` widened to `varchar(64)`.
   - `alert_events`: `id`, `organization_id`, `rule_id`, `source_id`, `acknowledged_by_id`, `escalated_to_id` widened to `varchar(64)`.
   - Migration 0007 generated and pushed to PostgreSQL.
2. **Strict DB CHECK Constraints**:
   - `chk_ar_cooldown_positive`: `cooldownMinutes > 0`.
   - `chk_ar_max_alerts_positive`: `maxAlertsPerDay IS NULL OR maxAlertsPerDay > 0`.
   - `chk_ar_escalate_positive`: `escalateAfterMinutes IS NULL OR escalateAfterMinutes > 0`.
   - `chk_ar_trigger_count`: `triggerCount >= 0`.
   - `chk_ar_version`: `version >= 1`.
   - `chk_ar_quiet_hours_consistency`: `(quietHoursEnabled = FALSE AND start IS NULL AND end IS NULL) OR (quietHoursEnabled = TRUE AND start IS NOT NULL AND end IS NOT NULL)`.
   - `chk_ar_trigger_consistency`: `(triggerCount = 0 AND lastTriggeredAt IS NULL) OR (triggerCount > 0 AND lastTriggeredAt IS NOT NULL)`.
   - `chk_ar_threshold_only_for_threshold`: threshold populated only when conditionType='threshold'.
   - `chk_ar_engagement_no_quiet_hours`: engagement SLA rules cannot enable quiet hours.
   - `chk_ar_system_no_scope`: system rules must have NULL scopeIds.
   - `chk_ae_minutes_overdue`: `minutesOverdue >= 0`.
   - `chk_ae_naira_impact`: `estimatedNairaImpact IS NULL OR estimatedNairaImpact >= 0`.
   - `chk_ae_alert_sent_consistency`: `alertSent = TRUE → alertSentAt IS NOT NULL`.
   - `chk_ae_ack_consistency`: `isAcknowledged = TRUE → acknowledgedById IS NOT NULL AND acknowledgedAt IS NOT NULL`.
   - `chk_ae_escalation_consistency`: `escalatedAt IS NOT NULL → escalatedToId IS NOT NULL`.
   - `chk_ae_sla_breach_fields`: when breachType set, `slaStartedAt`, `breachedAt`, `minutesOverdue` required and `breachedAt >= slaStartedAt`.
3. **Optimistic Concurrency**: `version` counter on `alert_rules`.
4. **Rate Limiting & Suppression**:
   - Cooldown period enforcement (`cooldownMinutes`).
   - Daily cap enforcement (`maxAlertsPerDay`).
   - Quiet hours suppression (non-SLA).
5. **Fan-out & Multi-channel Delivery**:
   - Recipient resolution (user, team, email, role).
   - In-app notification creation.
   - Email dispatch via `emailService.send({ kind: "alert", ... })`.
   - Per-channel delivery status recorded in `notification_status` JSONB.
   - Rule denormalized counters updated (`lastTriggeredAt`, `triggerCount`, `lastSeverity`).
6. **Alert Lifecycle Operations**:
   - Read tracking (`isRead`, `markAsRead`, `markAllAsRead`, `getUnreadAlertCount`).
   - Acknowledgement triage (`isAcknowledged`, `acknowledgedById`, `acknowledgedAt`, `acknowledgmentNotes`).
   - Escalation dispatch (`escalatedAt`, `escalatedToId`, `escalationNotes`, escalation email dispatch).
