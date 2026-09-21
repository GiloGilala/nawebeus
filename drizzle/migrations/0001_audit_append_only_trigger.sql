-- Migration 0001: append-only enforcement for unified_audit_log (NWB-P1-014).
--
-- The table's contract (see db/shared/audit.ts) is append-only: no UPDATE, no DELETE, with the
-- single sanctioned exception of the integrity verification job setting hash_chain_valid = FALSE.
-- Until now that was a comment. This trigger makes it something a bug cannot walk through — which
-- is what makes the checksum columns mean anything: without it, a tamperer edits the row and
-- recomputes its own hash.
--
-- Idempotent by construction (DROP IF EXISTS + CREATE OR REPLACE): the chain tests execute this
-- file in-transaction on databases the migration never ran on (CI builds via db:push, which cannot
-- express triggers), so it must run anywhere, not just once. Do not "simplify" it to plain CREATE.
--
-- TRUNCATE is deliberately NOT covered: no trigger fires on TRUNCATE, and blocking it needs an
-- event trigger (superuser). It stays a role-permission concern, as the header comment says.
--> statement-breakpoint
DROP TRIGGER IF EXISTS impl_trg_ual_append_only ON unified_audit_log;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION impl_ual_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  requested_valid boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'unified_audit_log is append-only: DELETE is rejected (NWB-P1-014)';
  ELSIF TG_OP = 'UPDATE' THEN
    -- The sole sanctioned mutation is the integrity job flagging a broken link. Pin the requested
    -- value aside, restore OLD's, and compare whole rows: any remaining difference is a forbidden
    -- column change. (NWB-P1-015: the anonymization exception lands here, as an explicit
    -- allow-list beside this comparison.)
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
