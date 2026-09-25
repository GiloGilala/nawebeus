/**
 * The ability in force during an impersonated request (NWB-P1-011, BR-ADMIN-009).
 *
 * The admin inside an impersonation session acts with the **target's** abilities, not their
 * own — "see the product as they see it" is the point of the tool, and it is also the
 * escalation guard: whatever the target could not do, the session cannot either. On top of
 * that sits a hard deny-list of what nobody may do *through someone else's account*, per the
 * module spec (BR-ADMIN-009): billing modification, organization deletion, and role
 * self-escalation — plus nested impersonation, which would otherwise let an owner-target
 * chain into a second account and blur two audit trails into one.
 *
 * Deny-listed verbs are **stripped before the ability is built**, not checked afterwards:
 * a `requireAbility` guard asks `ability.can(...)`, and an ability that never contained the
 * rule answers no. A post-hoc blocklist at every route would be a second list to keep in
 * sync with the first — exactly how a control gets lost in a refactor.
 */
import { type Ability, AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { Actions } from "../auth/ability";

/** Verbs of a subject that are removed while impersonating. */
const IMPERSONATION_DENIED_VERBS: Readonly<Record<string, readonly Actions[]>> = {
  // Money moves through someone else's account are the textbook impersonation abuse.
  billing: ["read", "create", "update", "delete", "manage", "publish", "export", "decide"],
  // Deleting the organization the target belongs to is not support; it is destruction with
  // a stolen hand. Everything else on `org` (rename, settings) stays — real support needs it.
  org: ["delete"],
  // Role self-escalation: re-writing the team's roles or its membership from inside a
  // borrowed account.
  roles: ["create", "update", "delete"],
  members: ["create", "update", "delete"],
  // No impersonation from inside an impersonation.
  users: ["impersonate"],
};

/**
 * Rebuild `base` without the denied rules. Rules are copied verbatim (conditions, fields,
 * inverted flags and all) except the denied subject/verb pairs, so the resulting ability
 * differs from the target's own in exactly the stripped set and nothing else.
 */
export function impersonationAbility(base: Ability<[Actions, string]>): Ability<[Actions, string]> {
  const { can, build } = new AbilityBuilder<Ability<[Actions, string]>>(createMongoAbility);

  for (const rule of base.rules) {
    const subjects = Array.isArray(rule.subject) ? rule.subject : [rule.subject];
    const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
    const denied = subjects.some((subject) => {
      const verbs = IMPERSONATION_DENIED_VERBS[subject];
      if (verbs === undefined) return false;
      // A `manage` rule implies every verb (CASL's wildcard), so it must go too.
      if (actions.includes("manage")) return true;
      return actions.some((action) => verbs.includes(action as Actions));
    });
    if (denied) continue;
    can(rule.action as Actions, rule.subject as string);
  }

  return build();
}
