-- Migration 0002: sanctioned anonymization exception to the append-only rule (NWB-P1-015).
--
-- BR-AUTH-043 requires audit rows to be anonymized (not deleted) when a subject is hard-purged,
-- and anonymization is by definition an UPDATE — of columns the hash chain deliberately does NOT
-- cover (`actor_ip`, `actor_user_agent`, and the four jsonb payloads), so the chain survives the
-- scrub untouched. `actor_id` and `resource_id` ARE hash inputs and stay untouchable; the scrub
-- leaves them as unresolvable references to the deleted row.
--
-- The exception is two gates, not one: the writer must declare itself transaction-locally
-- (`SET LOCAL audit.anonymizing = 'on'`, which `anonymizeAuditActorContext` sets around its scrub
-- and resets after) AND the change must be confined to the six PII columns. The flag without the
-- confinement still raises, and so does a combined flag flip — the two sanctioned mutations are
-- disjoint on purpose, one actor per column set. An open "anyone may UPDATE PII columns" rule
-- would let any bug rewrite `before_state` without breaking the chain (jsonb is not hashed),
-- which is the evidence-substance hole this shape exists to close.
--
-- Idempotent by construction (DROP IF EXISTS + CREATE OR REPLACE), like 0001: tests execute this
-- file in-transaction on databases the migration never ran on, so it must run anywhere, not just
-- once. Do not "simplify" it to plain CREATE.
--> statement-breakpoint
DROP TRIGGER IF EXISTS impl_trg_ual_append_only ON unified_audit_log;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION impl_ual_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  requested_valid boolean;
  requested_ip inet;
  requested_ua text;
  requested_before jsonb;
  requested_after jsonb;
  requested_changes jsonb;
  requested_metadata jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'unified_audit_log is append-only: DELETE is rejected (NWB-P1-014)';
  ELSIF TG_OP = 'UPDATE' THEN
    IF current_setting('audit.anonymizing', true) = 'on' THEN
      -- NWB-P1-015 path: the hard-purge scrub. Pin the requested PII aside, restore OLD's,
      -- and compare whole rows: any remaining difference is out of scope. (The missing_ok
      -- `true` makes an unset flag read NULL, which fails the `= 'on'` test and falls through
      -- to the flag path below — ordinary writers never see this branch.)
      requested_ip := NEW.actor_ip;
      requested_ua := NEW.actor_user_agent;
      requested_before := NEW.before_state;
      requested_after := NEW.after_state;
      requested_changes := NEW.changes;
      requested_metadata := NEW.metadata;
      NEW.actor_ip := OLD.actor_ip;
      NEW.actor_user_agent := OLD.actor_user_agent;
      NEW.before_state := OLD.before_state;
      NEW.after_state := OLD.after_state;
      NEW.changes := OLD.changes;
      NEW.metadata := OLD.metadata;
      IF OLD IS DISTINCT FROM NEW THEN
        RAISE EXCEPTION 'unified_audit_log anonymization may only touch actor PII columns (NWB-P1-015)';
      END IF;
      NEW.actor_ip := requested_ip;
      NEW.actor_user_agent := requested_ua;
      NEW.before_state := requested_before;
      NEW.after_state := requested_after;
      NEW.changes := requested_changes;
      NEW.metadata := requested_metadata;
      RETURN NEW;
    END IF;
    -- NWB-P1-014 path, unchanged: the sole mutation here is the integrity job flagging a
    -- broken link. Pin the requested value aside, restore OLD's, and compare whole rows.
    requested_valid := NEW.hash_chain_valid;
    NEW.hash_chain_valid := OLD.hash_chain_valid;
    IF OLD IS DISTINCT FROM NEW THEN
      RAISE EXCEPTION 'unified_audit_log is append-only: only hash_chain_valid may change (NWB-P1-014)';
    END IF;
    NEW.hash_chain_valid := requested_valid;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER impl_trg_ual_append_only
  BEFORE UPDATE OR DELETE ON unified_audit_log
  FOR EACH ROW EXECUTE FUNCTION impl_ual_append_only();
