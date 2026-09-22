# `tanstack-start.md` — Version 1.1 (Merged)

```markdown
# TanStack Start Server Functions

**Last updated:** 2026-09-22
**Document Status:** Production-ready
**Version:** 1.1
**Purpose:** Complete guide to TanStack Start server functions (actions) for the Nawebeus platform
**Audience:** Web Developers, Full-Stack Engineers
**Related Documents:** Tech Stack (v1.0.0), Architecture Overview, Authorization Model, Data Access Patterns, ADRs

---

## Table of Contents

1. [What Are Server Functions?](#1-what-are-server-functions)
2. [When to Use Server Functions](#2-when-to-use-server-functions)
3. [Basic Syntax](#3-basic-syntax)
4. [Validation with Zod](#4-validation-with-zod)
5. [Authorization in Server Functions](#5-authorization-in-server-functions)
6. [Error Handling](#6-error-handling)
7. [Best Practices](#7-best-practices)
8. [Common Patterns](#8-common-patterns)
9. [Limitations & Constraints](#9-limitations--constraints)
10. [File Organization](#10-file-organization)
11. [Testing Server Functions](#11-testing-server-functions)
12. [Platform Context (from Tech Stack)](#12-platform-context-from-tech-stack)
13. [Relationship to the Services Layer and Hono API](#13-relationship-to-the-services-layer-and-hono-api)
14. [Shared Error Contract](#14-shared-error-contract)
15. [Interaction with the Cache Layer](#15-interaction-with-the-cache-layer)
16. [Realtime Updates After Mutations](#16-realtime-updates-after-mutations)
17. [Background Jobs (real pattern)](#17-background-jobs-real-pattern)
18. [Rate Limiting](#18-rate-limiting)
19. [Observability Requirements](#19-observability-requirements)

---

## 1. What Are Server Functions?

Server functions (also called "actions" in TanStack Start) are **server-side RPC functions** that run in the same process as your web server. They allow you to write backend logic directly in your route files without creating separate API endpoints.

### 1.1 Key Characteristics

| Characteristic            | Description                                         |
| ------------------------- | --------------------------------------------------- |
| **Server-side execution** | Code runs on the server, never on the client        |
| **Same-origin**           | Runs in the same process as the web server          |
| **Session cookie auth**   | Relies on browser cookies for authentication        |
| **Web-only**              | Not reachable from mobile apps or external clients  |
| **Zero network overhead** | Direct function calls, no HTTP round-trip           |
| **Type-safe**             | Full TypeScript inference between client and server |

### 1.2 How They Compare to Hono API Routes

| Aspect               | Server Functions      | Hono API Routes                 |
| -------------------- | --------------------- | ------------------------------- |
| **Accessible from**  | Web only              | Web, Mobile, Admin, Third-party |
| **Auth method**      | Session cookies       | Session cookies, JWT, API keys  |
| **Network overhead** | None                  | HTTP round-trip                 |
| **Code location**    | `app/routes/`         | `server/api/routes/`            |
| **Best for**         | Web-specific features | Shared/mobile features          |

> **Note:** Server functions and Hono routes run in the **same Bun process** (Tech Stack §4.1, §4.2; ADR-002). They share the database pool, cache instance, and logger. They are two transports over one set of services — see §13.

---

## 2. When to Use Server Functions

### 2.1 Use Server Functions When:

| Scenario                          | Example                                            |
| --------------------------------- | -------------------------------------------------- |
| **Feature is web-only**           | Admin dashboard, web-specific UI flows             |
| **Performance is critical**       | Zero network overhead, direct execution            |
| **You need web-specific context** | Browser features, DOM access, SSR data             |
| **Mobile parity not required**    | The action doesn't need to exist in the mobile app |
| **Prototyping rapidly**           | Faster to write and iterate (no route boilerplate) |

### 2.2 Use Hono API Instead When:

| Scenario                            | Example                                       |
| ----------------------------------- | --------------------------------------------- |
| **Feature must work on mobile**     | Native apps can only call HTTP APIs           |
| **Feature needs to be shared**      | Same logic for web and mobile                 |
| **Admin functions**                 | Admin interfaces often need direct API access |
| **Third-party access**              | API keys, webhooks, external integrations     |
| **Multiple authentication methods** | Need to support API keys + sessions           |

### 2.3 Decision Flowchart

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SHOULD I USE A SERVER FUNCTION?                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Does this feature need to work on mobile?                        │   │
│  └────────────────────────┬─────────────────────────────────────────┘   │
│                           │                                             │
│                  ┌────────▼────────┐                                    │
│                  │       YES       │                                    │
│                  └────────┬────────┘                                    │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ❌ Use Hono API instead                                          │   │
│  │    (Mobile apps can only call HTTP APIs)                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                  ┌────────▼────────┐                                    │
│                  │       NO        │                                    │
│                  └────────┬────────┘                                    │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Does this need to be accessed by third-party tools?              │   │
│  └────────────────────────┬─────────────────────────────────────────┘   │
│                           │                                             │
│                  ┌────────▼────────┐                                    │
│                  │       YES       │                                    │
│                  └────────┬────────┘                                    │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ❌ Use Hono API with API keys                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                  ┌────────▼────────┐                                    │
│                  │       NO        │                                    │
│                  └────────┬────────┘                                    │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ✅ Use Server Function                                           │   │
│  │    (Web-only, session auth, no external access needed)           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Basic Syntax

### 3.1 Creating a Server Function

```typescript
// app/routes/clients/create.ts
import { createServerFn } from "@tanstack/start";

// Basic server function
export const createClient = createServerFn({ method: "POST" })
  .validator((data: { name: string; phone: string }) => {
    // Validation logic
    if (!data.name) throw new Error("Name is required");
    return data;
  })
  .handler(async ({ data }) => {
    // Server-side logic
    const user = await getCurrentUser();
    const client = await db.clients.create({
      data: {
        ...data,
        business_profile_id: user.businessProfileId,
      },
    });
    return client;
  });
```

### 3.2 Using a Server Function in a Component

```typescript
// app/routes/clients/index.tsx
import { createClient } from "./create";

export function ClientsPage() {
  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      // Invalidate queries, show success message, etc.
    },
  });

  const handleSubmit = (data: { name: string; phone: string }) => {
    createMutation.mutate(data);
  };

  return (
    <form onSubmit={/* ... */}>
      {/* Form fields */}
      <button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creating..." : "Create Client"}
      </button>
    </form>
  );
}
```

### 3.3 Server Function with No Payload

```typescript
// app/routes/auth/logout.ts
export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getCurrentSession();
  if (session) {
    await db.sessions.delete({ id: session.id });
  }
  return { success: true };
});
```

### 3.4 Server Function with Query Parameters

```typescript
// app/routes/clients/get.ts
export const getClient = createServerFn({ method: "GET" })
  .validator((data: { clientId: string }) => {
    if (!data.clientId) throw new Error("Client ID required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    const client = await db.clients.findFirst({
      where: {
        id: data.clientId,
        business_profile_id: user.businessProfileId,
      },
    });
    if (!client) throw new NotFoundError("Client not found");
    return client;
  });
```

---

## 4. Validation with Zod

### 4.1 Basic Zod Validation

```typescript
// app/routes/clients/create.ts
import { createServerFn } from "@tanstack/start";
import { z } from "zod";

const createClientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  address: z.string().optional(),
});

export const createClient = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    return createClientSchema.parse(data);
  })
  .handler(async ({ data }) => {
    // data is now fully typed and validated
    const user = await getCurrentUser();
    return await db.clients.create({
      data: {
        ...data,
        business_profile_id: user.businessProfileId,
      },
    });
  });
```

### 4.2 Custom Validation Logic

```typescript
// app/routes/measurements/create.ts
export const createMeasurement = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = measurementSchema.parse(data);

    // Custom validation
    if (parsed.chest && parsed.chest < 20) {
      throw new Error("Chest measurement must be at least 20cm");
    }

    if (parsed.waist && parsed.waist < 15) {
      throw new Error("Waist measurement must be at least 15cm");
    }

    return parsed;
  })
  .handler(async ({ data }) => {
    // Business logic
  });
```

### 4.3 Partial Updates with Zod

```typescript
// app/routes/clients/update.ts
const updateClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

export const updateClient = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    return updateClientSchema.parse(data);
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    return await db.clients.update({
      where: {
        id: data.id,
        business_profile_id: user.businessProfileId,
      },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
      },
    });
  });
```

---

## 5. Authorization in Server Functions

### 5.1 Using `hasPermission()` (Async)

```typescript
// app/routes/clients/delete.ts
import { hasPermission } from "@/server/authorization/services/permission-check";

export const deleteClient = createServerFn({ method: "POST" })
  .validator((data: { clientId: string }) => {
    if (!data.clientId) throw new Error("Client ID required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();

    // Check authorization
    if (!(await hasPermission(user.id, "fashion:clients.delete"))) {
      throw new ForbiddenError("You do not have permission to delete clients");
    }

    // Business logic
    return await db.clients.delete({
      where: {
        id: data.clientId,
        business_profile_id: user.businessProfileId,
      },
    });
  });
```

### 5.2 Using `authorizeAction()` (Comprehensive)

```typescript
// app/routes/clients/delete.ts
import { authorizeAction } from "@/server/authorization/functions/authorization-function";

export const deleteClient = createServerFn({ method: "POST" })
  .validator((data: { clientId: string }) => {
    if (!data.clientId) throw new Error("Client ID required");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();

    // Comprehensive authorization
    const result = await authorizeAction(user, {
      resource: "fashion",
      operation: "clients_delete",
      requiredPermissions: ["fashion:clients.delete"],
      resourceOwnerId: data.clientId,
      requireOwnership: true,
      requireMFA: true,
      restrictions: ["user:ban"],
    });

    if (!result.allowed) {
      throw new ForbiddenError(result.reason);
    }

    // Business logic
    return await db.clients.delete({
      where: {
        id: data.clientId,
        business_profile_id: user.businessProfileId,
      },
    });
  });
```

### 5.3 Ownership Check with `canWithOwnership`

```typescript
// app/routes/projects/update.ts
import { canWithOwnership } from "@/server/authorization/services/permission-check";

export const updateProject = createServerFn({ method: "POST" })
  .validator((data: { projectId: string; name: string }) => {
    return projectSchema.parse(data);
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();

    // Check ownership
    const project = await db.projects.findFirst({
      where: {
        id: data.projectId,
        business_profile_id: user.businessProfileId,
      },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    if (
      !canWithOwnership(
        user,
        "fashion:projects.edit_own",
        "fashion:projects.edit",
        project.ownerId,
      )
    ) {
      throw new ForbiddenError(
        "You do not have permission to edit this project",
      );
    }

    // Business logic
    return await db.projects.update({
      where: { id: data.projectId },
      data: { name: data.name },
    });
  });
```

### 5.4 MFA-Protected Action

```typescript
// app/routes/auth/disable-mfa.ts
import {
  actionNeedsMFA,
  verifyMFAStatus,
} from "@/server/authorization/services/permission-check";

export const disableMFA = createServerFn({ method: "POST" }).handler(
  async () => {
    const user = await getCurrentUser();

    // Check if MFA is required for this action
    const needsMFA = await actionNeedsMFA(user.id, ["auth:disable_mfa"]);

    if (needsMFA) {
      const mfaVerified = await verifyMFAStatus(user.id);
      if (!mfaVerified) {
        throw new UnauthorizedError("MFA verification required");
      }
    }

    // Business logic
    return await db.users.update({
      where: { id: user.id },
      data: { mfaEnabled: false },
    });
  },
);
```

> **RBAC implementation:** All permission checks above are backed by **CASL** (Tech Stack §2, ADR-006). Do not implement role checks inline — always go through the authorization service so server functions and Hono routes enforce identical rules (see §13).

---

## 6. Error Handling

### 6.1 Custom Error Classes

```typescript
// app/lib/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super(404, message, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation Error") {
    super(400, message, "VALIDATION_ERROR");
  }
}
```

### 6.2 Error Handling in Server Functions

```typescript
// app/routes/clients/create.ts
export const createClient = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    try {
      return createClientSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0].message);
      }
      throw error;
    }
  })
  .handler(async ({ data }) => {
    try {
      const user = await getCurrentUser();

      // Check plan limits
      const clientCount = await db.clients.count({
        where: { business_profile_id: user.businessProfileId },
      });

      const plan = await getCurrentPlan(user.businessProfileId);
      if (plan.maxClients !== -1 && clientCount >= plan.maxClients) {
        throw new AppError(402, "Client limit exceeded", "PLAN_LIMIT_EXCEEDED");
      }

      return await db.clients.create({
        data: {
          ...data,
          business_profile_id: user.businessProfileId,
        },
      });
    } catch (error) {
      // Log error via structured logger (see §19)
      logger.error("Failed to create client", { error });
      throw error;
    }
  });
```

### 6.3 Error Handling in Components

```typescript
// app/routes/clients/index.tsx
export function ClientsPage() {
  const createMutation = useMutation({
    mutationFn: createClient,
    onError: (error: AppError) => {
      if (error.statusCode === 402) {
        toast.error("Upgrade your plan to add more clients");
      } else if (error.statusCode === 403) {
        toast.error("You do not have permission to create clients");
      } else if (error.statusCode === 400) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred");
      }
    },
    onSuccess: () => {
      toast.success("Client created successfully");
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  // ...
}
```

---

## 7. Best Practices

### 7.1 DO's

```typescript
// ✅ DO: Validate all inputs with Zod
export const createClient = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    return createClientSchema.parse(data);
  })
  .handler(async ({ data }) => {
    // ...
  });

// ✅ DO: Always check authorization
export const deleteClient = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const user = await getCurrentUser();
    if (!(await hasPermission(user.id, "fashion:clients.delete"))) {
      throw new ForbiddenError();
    }
    // ...
  },
);

// ✅ DO: Use business_profile_id for tenant filtering
const client = await db.clients.findFirst({
  where: {
    id: data.clientId,
    business_profile_id: user.businessProfileId,
  },
});

// ✅ DO: Use consistent error handling
if (!client) throw new NotFoundError("Client not found");

// ✅ DO: Use useMutation for mutations
const mutation = useMutation({
  mutationFn: createClient,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
});

// ✅ DO: Type your server functions
type CreateClientInput = z.infer<typeof createClientSchema>;
```

### 7.2 DON'Ts

```typescript
// ❌ DON'T: Skip validation
export const createClient = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    // data is unknown - unsafe!
  },
);

// ❌ DON'T: Check user.role directly
if (user.role === "admin") {
  // This is wrong! See authorization-model.md §9
}

// ❌ DON'T: Forget tenant filtering
const client = await db.clients.findFirst({
  where: { id: data.clientId },
  // Missing: business_profile_id check!
});

// ❌ DON'T: Put sensitive data in the validator error message
throw new Error(`Failed for user ${user.id}`); // ⚠️ Exposes internal ID

// ❌ DON'T: Call server functions without try/catch
const result = await deleteClient({ clientId: id }); // ⚠️ Unhandled error
```

---

## 8. Common Patterns

### 8.1 CRUD Operations

```typescript
// app/routes/clients/index.ts
export const getClients = createServerFn({ method: "GET" })
  .validator((data: { page: number; limit: number; search?: string }) => {
    return z
      .object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();

    const where = {
      business_profile_id: user.businessProfileId,
      ...(data.search && {
        OR: [
          { name: { contains: data.search } },
          { phone: { contains: data.search } },
          { email: { contains: data.search } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      db.clients.findMany({
        where,
        skip: (data.page - 1) * data.limit,
        take: data.limit,
        orderBy: { createdAt: "desc" },
      }),
      db.clients.count({ where }),
    ]);

    return {
      data: clients,
      pagination: {
        page: data.page,
        limit: data.limit,
        total,
        totalPages: Math.ceil(total / data.limit),
      },
    };
  });
```

### 8.2 Bulk Operations

```typescript
// app/routes/clients/bulk-delete.ts
export const bulkDeleteClients = createServerFn({ method: "POST" })
  .validator((data: { clientIds: string[] }) => {
    return z
      .object({
        clientIds: z
          .array(z.string().uuid())
          .min(1, "At least one client required"),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();

    // Check permission once
    if (!(await hasPermission(user.id, "fashion:clients.delete"))) {
      throw new ForbiddenError();
    }

    // Use transaction for all deletes
    const result = await db.$transaction(async (tx) => {
      const results = [];
      for (const clientId of data.clientIds) {
        try {
          await tx.clients.delete({
            where: {
              id: clientId,
              business_profile_id: user.businessProfileId,
            },
          });
          results.push({ clientId, success: true });
        } catch (error) {
          results.push({ clientId, success: false, error: error.message });
        }
      }
      return results;
    });

    return {
      results,
      success: results.every((r) => r.success),
      failed: results.filter((r) => !r.success).length,
    };
  });
```

### 8.3 File Upload

```typescript
// app/routes/media/upload.ts
import { putObject } from "@/server/storage/r2-client";

export const uploadMedia = createServerFn({ method: "POST" })
  .validator((data: { file: File; folderId?: string }) => {
    // File validation
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(data.file.type)) {
      throw new ValidationError("Invalid file type");
    }
    if (data.file.size > 10 * 1024 * 1024) {
      throw new ValidationError("File too large (max 10MB)");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();

    // Upload to Cloudflare R2 (Tech Stack §5.6)
    const key = `users/${user.businessProfileId}/${crypto.randomUUID()}-${data.file.name}`;
    await putObject({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: data.file.stream(),
      ContentType: data.file.type,
    });

    // Public URL served via Bunny CDN
    const url = `${process.env.BUNNY_CDN_BASE}/${key}`;

    // Save media record
    return await db.media_items.create({
      data: {
        url,
        filename: data.file.name,
        mimeType: data.file.type,
        size: data.file.size,
        business_profile_id: user.businessProfileId,
        folder_id: data.folderId,
      },
    });
  });
```

> **Storage backend:** Object storage is **Cloudflare R2**, delivered via **Bunny CDN** (Tech Stack §5.6). Do not use Cloudinary, S3, or self-hosted MinIO — all were explicitly rejected (Tech Stack §10).

### 8.4 Background Jobs (aspirational example — see §17)

> **Status 2026-09-06:** ASPIRATIONAL EXAMPLE — `client_import_jobs`,
> `queueClientImport`, and `processClientImport` exist nowhere in code.
> The real background-job pattern is documented in §17. The code below is
> kept only to illustrate the intended shape (server function enqueues,
> worker processes), **not** as a copy-paste template.

```typescript
// app/routes/clients/import.ts
export const importClients = createServerFn({ method: "POST" })
  .validator((data: { fileId: string }) => {
    return z.object({ fileId: z.string().uuid() }).parse(data);
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();

    // Create import job
    const job = await db.client_import_jobs.create({
      data: {
        business_profile_id: user.businessProfileId,
        imported_by_user_id: user.id,
        status: "pending",
      },
    });

    // Queue background job (see §17 for the real mechanism)
    const result = await queueClientImport(job.id, data.fileId, user.id);

    // Return job ID for tracking
    return {
      jobId: job.id,
      status: "processing",
    };
  });
```

---

## 9. Limitations & Constraints

### 9.1 Web-Only

> **Important:** Server functions are **NOT accessible from mobile apps**.

```typescript
// ❌ This WILL NOT work from a mobile app
const result = await createClient({ name: "John" });

// ✅ Mobile must use Hono API
const result = await api.post("/clients", { name: "John" });
```

### 9.2 Session Dependency

Server functions rely on session cookies. They cannot use JWT tokens or API keys for authentication.

### 9.3 Request Size Limits

- Server functions have a default payload size limit (configurable)
- Large files should use Hono API with streaming support
- Media uploads that go through a server function are capped by the Nginx `client_max_body_size 50m` (Tech Stack §6.3)

### 9.4 No Direct HTTP Response Control

Server functions return data, not HTTP responses. You cannot:

- Set custom HTTP status codes
- Set response headers
- Stream responses

For these use cases, use Hono API routes instead.

---

## 10. File Organization

### 10.1 Recommended Structure

```
app/routes/
├── (auth)/
│   ├── login.tsx                # Login page
│   └── logout.ts                # Server function
├── (dashboard)/
│   ├── _layout.tsx              # Layout component
│   ├── index.tsx                # Dashboard home
│   └── clients/
│       ├── index.tsx            # Clients list page
│       ├── create.tsx           # Create client page
│       ├── [id]/
│       │   ├── index.tsx        # Client detail page
│       │   ├── edit.tsx         # Edit client page
│       │   └── delete.ts        # Server function
│       └── api/
│           ├── list.ts          # Get clients server function
│           ├── create.ts        # Create client server function
│           ├── update.ts        # Update client server function
│           └── delete.ts        # Delete client server function
├── _featuresLayout/
│   ├── invoices/
│   │   ├── index.tsx
│   │   ├── create.tsx
│   │   └── api/
│   │       ├── create.ts
│   │       └── list.ts
│   └── measurements/
│       └── ...
└── api/                         # API routes (separate from server functions)
    └── webhooks/                # External webhook endpoints
        └── stripe.ts
```

### 10.2 Server Function Naming Conventions

| File Pattern         | Purpose              |
| -------------------- | -------------------- |
| `api/create.ts`      | Create operation     |
| `api/update.ts`      | Update operation     |
| `api/delete.ts`      | Delete operation     |
| `api/list.ts`        | List/query operation |
| `api/get.ts`         | Get single item      |
| `api/bulk-create.ts` | Bulk create          |
| `api/bulk-delete.ts` | Bulk delete          |
| `api/import.ts`      | Import data          |
| `api/export.ts`      | Export data          |

### 10.3 Tenant Scoping Convention (from ADR-003)

- Every query in a server function **must** include `business_profile_id` (or the current org/tenant column). This is a **defense-in-depth** complement to PostgreSQL Row-Level Security, not a replacement.
- **Never** accept a tenant ID from the client payload — derive it from the authenticated session via `getCurrentUser()`.
- A missing tenant filter is a **security bug**, not a style issue (see §7.2).

---

## 11. Testing Server Functions

> **Test runner:** All server function tests run under **`bun test`** (Tech Stack §2, §7.1). Bun's runner is Jest-compatible but is the only supported runner in CI. Do **not** introduce Vitest, Jest, or Mocha.

### 11.1 Unit Tests

```typescript
// app/routes/clients/api/create.test.ts
import { describe, it, expect, mock } from "bun:test";
import { createClient } from "./create";

describe("createClient", () => {
  it("should create a client", async () => {
    // Mock dependencies
    mock.module("@/server/auth", () => ({
      getCurrentUser: mock().mockResolvedValue({
        id: "user-1",
        businessProfileId: "org-1",
      }),
    }));

    const result = await createClient({
      data: {
        name: "John Doe",
        phone: "+1234567890",
      },
    });

    expect(result).toMatchObject({
      name: "John Doe",
      phone: "+1234567890",
      business_profile_id: "org-1",
    });
  });

  it("should throw if name is missing", async () => {
    await expect(
      createClient({ data: { phone: "+1234567890" } }),
    ).rejects.toThrow("Name is required");
  });
});
```

### 11.2 Integration Tests

```typescript
// app/routes/clients/api/create.integration.test.ts
import { describe, it, expect } from "bun:test";
import { createClient } from "./create";

describe("createClient integration", () => {
  it("should create a client with proper authorization", async () => {
    // Setup test database, seed users, etc.
    const user = await createTestUser({ role: "staff" });
    const session = await createTestSession(user.id);

    // Mock auth context
    const result = await withAuth(session, () =>
      createClient({
        data: {
          name: "Jane Smith",
          phone: "+9876543210",
        },
      }),
    );

    expect(result).toBeDefined();
    expect(result.name).toBe("Jane Smith");

    // Cleanup
    await cleanupTestData();
  });
});
```

### 11.3 Coverage Targets

| Test category | Coverage target | Frequency |
|--------------|----------------|-----------|
| Services layer (unit) | ≥ 85% line coverage | Every PR |
| Lib utilities (unit) | ≥ 90% line coverage | Every PR |
| API endpoints (integration) | ≥ 70% of endpoints | Every PR |

Coverage is reported with `bun test --coverage` (Tech Stack §7.1).

---

## 12. Platform Context (from Tech Stack)

Server functions are one entry point into a **Bun-native, TypeScript end-to-end** stack. The following constraints from the Tech Stack document directly affect how server functions are written:

| Fact | Source | Impact on server functions |
|------|--------|----------------------------|
| Runtime is **Bun 1.4+**, not Node.js | Tech Stack §3.1, ADR-001 | Use `Bun.password`, `bun:sql`, `bun test`; do not assume Node-only native modules |
| **TypeScript strict mode** is non-negotiable | Tech Stack §3.2 | All inputs/outputs fully typed; `unknown` in validators, never `any`. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on. |
| `@tanstack/start` tracks **latest**; breaking changes via ADR | Tech Stack §4.1, ADR-002 | Follow release notes; the `createServerFn` / `.validator` / `.handler` API may change |
| Hono is **mounted inside the same TanStack Start process** at `/api/*` | Tech Stack §4.2 | Server functions and Hono share process, DB pool, and cache — no serialization between them |
| Validation is **Zod, latest** | Tech Stack §4.7 | Zod schemas are the single source of truth across form, API, and service layers |
| Server state is **TanStack Query** | Tech Stack §4.5 | Client-side calls go through `useMutation` / `useQuery` — see §3.2 |
| Forms use **TanStack Form** with the Zod adapter | Tech Stack §4.6 | A form and its server function validator share the same schema |
| ORM is **Drizzle** | Tech Stack §5.1, ADR-005 | Schema-as-TypeScript; query builder reads like SQL; no code-gen step |
| Database is **PostgreSQL 14+** with RLS | Tech Stack §5.2, ADR-003 | RLS policies back up the app-level tenant filter; both are required |

---

## 13. Relationship to the Services Layer and Hono API

Server functions are **thin transport adapters**. They must not contain business logic.

```
Web component
  └─ TanStack Start server function   ← transport (this doc)
       └─ services/*.service.ts        ← business logic, DB access, authorization
            └─ Drizzle ORM → PostgreSQL

Mobile / third-party client
  └─ Hono route at /api/*              ← transport (other doc)
       └─ services/*.service.ts        ← SAME business logic
```

**Rules:**

1. A server function may **validate** (Zod) and **delegate** — nothing else.
2. Any logic a mobile client also needs **must** live in `services/`, not in the server function.
3. Authorization checks belong in the **service layer** so Hono and server functions enforce identically (see §5; Tech Stack §2 "RBAC — CASL").
4. When a server function and a Hono route do the same thing, they call the **same service method**.
5. Cache reads/writes (§15) and realtime broadcasts (§16) happen in the service layer, never in the server function.

---

## 14. Shared Error Contract

The error classes in §6.1 are the **canonical set**. Both server functions and Hono routes throw the same classes so the client can handle them once.

| Class | HTTP equivalent | Where thrown |
|-------|-----------------|--------------|
| `ValidationError` | 400 | Zod parse failures in `.validator()` |
| `UnauthorizedError` | 401 | Session/MFA failure |
| `ForbiddenError` | 403 | Authorization failure (CASL / `hasPermission`) |
| `NotFoundError` | 404 | Resource missing or wrong tenant |
| `AppError(402, …, "PLAN_LIMIT_EXCEEDED")` | 402 | Plan/quota limits (see §6.2) |

Client-side handling of these classes is defined **once** and reused for both `useMutation` calls to server functions and `api.*` calls to Hono routes (see §6.3).

---

## 15. Interaction with the Cache Layer

Read-heavy server functions should consult `cache.service.ts` before hitting PostgreSQL. Cache keys and TTLs are defined in Tech Stack §5.3.

| Cache key pattern | TTL | Invalidate on |
|-------------------|-----|---------------|
| `permissions:usr_{id}` | 5 min | Role change, permission override |
| `org:settings:{id}` | 15 min | Org settings update |
| `mention:feed:{id}:{cursor}` | 2 min | New mention ingested |
| `sentiment:trend:{id}:{period}` | 10 min | New sentiment data processed |
| `sov:{id}:{period}` | 30 min | New competitive data processed |
| `report:data:{report_id}` | 5 min | Report configuration change |
| `crisis:active:{id}` | 30 sec | Crisis status update |
| `subscription:{org_id}` | 30 min | Paystack webhook |

**Rules:**

- **Do not** write to the cache directly from a server function. Cache population and invalidation happen in the **service layer**, so Hono and server functions stay consistent.
- MVP cache is **SQLite via `bun:sql`** (in-process, no separate service). **Redis 7+** replaces it in Year 2 **without changing calling code** — the cache layer is abstracted behind `cache.service.ts` (Tech Stack §5.3, ADR-004).
- Cache key naming and TTL are **specified in Tech Stack §5.3** — do not invent new keys in the server function layer.

---

## 16. Realtime Updates After Mutations

Server functions do not push to WebSocket subscribers directly. After a successful mutation:

1. The **service layer** writes to the database.
2. The **service layer** calls the WebSocket broadcast for the org-scoped channel.
3. The **server function** returns the mutation result to the caller.

WebSocket channels and event names are defined in Tech Stack §6.5:

| Feature | Channel |
|---------|---------|
| Live crisis alert | `crisis:alert:{org_id}` |
| Real-time mention feed | `mention:new:{org_id}` |
| Inbox new message | `inbox:message:{org_id}` |
| Publishing status | `publish:status:{post_id}` |
| Dashboard metric refresh | `metrics:update:{org_id}` |

Multi-tenant isolation is enforced at the WebSocket handshake: the JWT is validated, the client is subscribed to an org-scoped channel, and events are only delivered for the client's own organization (Tech Stack §6.5).

---

## 17. Background Jobs (real pattern)

Server functions must **not** run long work inline. The supported pattern since 2026-09 is:

```
server function
  └─ service layer: business TX + enqueueOutboxEvent(...)
       └─ dispatcher → gilo_jobs
            └─ worker handler from typed registry (src/server/jobs/)
```

**Rules:**

1. A server function that needs to kick off long work **returns a job ID immediately** after the service layer writes the business row and enqueues an outbox event.
2. The **dispatcher** picks up the outbox event and creates a row in `gilo_jobs`.
3. A **worker handler** registered in the typed registry (`src/server/jobs/`) processes the job.
4. To introduce a new job type, add a `*.process` entry to the typed registry. **Do not** create a bespoke queue table or a detached worker function (as the §8.4 snippet incorrectly implies).
5. Job status is read back through a normal server function (or Hono route) that queries the job row — not through a WebSocket channel invented for that purpose.

The §8.4 example is retained only to show the intended **shape** (server function enqueues, worker processes), not as a copy-paste template.

---

## 18. Rate Limiting

Rate limits are enforced by SQLite sliding-window counters (Tech Stack §5.4) and apply to server functions **identically to Hono routes**, keyed by user (or IP for unauthenticated public actions).

| Endpoint category | Per minute | Per hour |
|-------------------|-----------|----------|
| Authentication | 5 / IP | 20 / IP |
| API reads | 100 / user | 2,000 / user |
| API writes | 50 / user | 500 / user |
| Content publishing | 30 / user | 200 / user |
| Report generation | 10 / user | 50 / user |
| Crisis operations | 200 / user | 2,000 / user |
| Webhook endpoints | 1,000 / source | 10,000 / source |
| Public (unauthenticated) | 10 / IP | 100 / IP |

A server function expected to exceed these limits is a **design smell** — move the work to a background job (§17) or a batched service method.

---

## 19. Observability Requirements

Every server function is wrapped by the platform's logging/error middleware (Tech Stack §8). Contributors must:

- **Log** via the structured JSON logger (→ Loki), **never** `console.log` in production paths. The §6.2 example is illustrative only.
- **Never log** secrets, JWT contents, raw card data (Paystack tokenizes client-side — Tech Stack §5.7), or full PII. The §7.2 "DON'T" about internal IDs in validator errors extends to logs.
- **Let errors propagate** — Sentry captures them at the boundary. Do not swallow.
- **Do not add** custom metrics inside a server function; metrics are emitted by the service layer and middleware (Tech Stack §8.2).
- **Follow the alerting thresholds** defined in Tech Stack §8.2 when adding new critical paths (e.g., crisis alert delivery, publishing failure rate).

---

## Appendix A: Common Validation Schemas

```typescript
// app/lib/validation-schemas.ts
import { z } from "zod";

// UUID validation
export const uuidSchema = z.string().uuid();

// Phone validation (Nigerian)
export const phoneSchema = z
  .string()
  .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number");

// Email validation
export const emailSchema = z.string().email("Invalid email address");

// Pagination
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Client schema
export const clientSchema = z.object({
  name: z.string().min(1).max(100),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

// Measurement schema
export const measurementSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(["body", "garment"]),
  chest: z.number().positive().optional(),
  waist: z.number().positive().optional(),
  hips: z.number().positive().optional(),
  inseam: z.number().positive().optional(),
  // ... more measurements
});
```

---

## Appendix B: Cross-References to Tech Stack

| Topic | Tech Stack section |
|-------|--------------------|
| Runtime (Bun), TypeScript, strict mode | §3.1, §3.2, ADR-001 |
| TanStack Start, Hono, mounting | §4.1, §4.2, ADR-002 |
| React, Tailwind, shadcn/ui | §4.3, §4.4 |
| TanStack Query, Zustand | §4.5 |
| TanStack Form, Zod | §4.6, §4.7 |
| ORM (Drizzle), PostgreSQL, RLS | §5.1, §5.2, ADR-003, ADR-005 |
| Cache keys and TTLs | §5.3, ADR-004 |
| Rate limits | §5.4 |
| Search (PostgreSQL tsvector) | §5.5 |
| File storage (R2 + Bunny) | §5.6 |
| Payments (Paystack) | §5.7, ADR-007 |
| Email (Nodemailer) | §5.8 |
| Hosting (self-hosted VPS + WireGuard) | §6.1, ADR-008 |
| Deployment (Coolify + Docker) | §6.2 |
| Reverse proxy (Nginx) | §6.3 |
| CDN / edge security (Cloudflare) | §6.4 |
| Realtime (WebSockets) | §6.5 |
| Push notifications (Expo) | §6.6 |
| Testing (Bun test, Playwright, Maestro) | §7 |
| Observability (Sentry, Prometheus, Loki) | §8 |
| Code quality / CI (GitHub Actions) | §9 |
| RBAC (CASL) | §2, ADR-006 |
| Adding a dependency | §12 |
| Migrating off a dependency | §13 |

---

## Appendix C: Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | July 2026 | Initial production-ready TanStack Start server functions guide. Covers syntax, validation, authorization, error handling, best practices, and common patterns. | nawebeus Team |
| 1.1 | 2026-09-22 | Merged Tech Stack v1.0.0 into the guide. Added: platform context (§12), services-layer rule vs Hono (§13), shared error contract (§14), cache interaction (§15), realtime updates (§16), real background-job pattern (§17), rate limiting (§18), observability requirements (§19), tenant-scoping convention (§10.3), stack cross-references (Appendix B). Corrected test runner to Bun test (§11.1–11.2) and file upload to Cloudflare R2 + Bunny CDN (§8.3). Replaced `console.error` with structured logger in §6.2. Removed Cloudinary and Vitest references throughout. | nawebeus Team |
```

---
