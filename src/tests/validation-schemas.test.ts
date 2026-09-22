import { describe, expect, test } from "bun:test";
import { ValidationError } from "@/lib/errors";
import {
  emailSchema,
  isZodError,
  parseWithValidation,
  phoneSchema,
  signupSchema,
  updateOrgSchema,
  uuidSchema,
  zodIssues,
} from "@/lib/validation";
import { signupSchema as honoSignup } from "@/lib/validation/auth.schemas";

describe("shared validation schemas", () => {
  test("Hono and Server Functions import the same signup schema object", () => {
    expect(signupSchema).toBe(honoSignup);
  });

  test("parseWithValidation throws ValidationError on Zod failure", () => {
    try {
      parseWithValidation(emailSchema, "not-an-email");
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).statusCode).toBe(422);
      expect((e as ValidationError).details?.[0]?.message).toContain("Invalid email");
    }
  });

  test("uuidSchema rejects non-uuids", () => {
    expect(() => parseWithValidation(uuidSchema, "nope")).toThrow(ValidationError);
  });

  test("Nigerian phone schema accepts 0803… and rejects junk", () => {
    expect(phoneSchema.parse("08031234567")).toBe("08031234567");
    expect(() => phoneSchema.parse("+2348031234567")).toThrow();
  });

  test("updateOrgSchema has no orgId field — tenant comes from the session", () => {
    const parsed = updateOrgSchema.parse({ name: "Acme" });
    expect(parsed.name).toBe("Acme");
    const extra = updateOrgSchema.safeParse({ name: "Acme", orgId: "should-not-land" });
    if (extra.success) {
      expect(Object.hasOwn(extra.data, "orgId")).toBe(false);
    }
  });

  test("isZodError recognises Zod failures and not plain Errors", () => {
    try {
      uuidSchema.parse("nope");
    } catch (e) {
      expect(isZodError(e)).toBe(true);
      expect(zodIssues(e as never)[0]?.field).toBe("_root");
    }
    expect(isZodError(new Error("nope"))).toBe(false);
    expect(isZodError({ issues: [{ path: ["email"], message: "bad" }] })).toBe(true);
    expect(isZodError(null)).toBe(false);
  });

  test("parseWithValidation returns the parsed value on success", () => {
    expect(parseWithValidation(emailSchema, "ada@example.com")).toBe("ada@example.com");
  });

  test("signupSchema requires terms and privacy", () => {
    expect(() =>
      signupSchema.parse({
        email: "ada@example.com",
        password: "x",
        fullName: "Ada",
        organizationName: "Org",
        termsAccepted: false,
        privacyAccepted: true,
      }),
    ).toThrow();
  });
});
