import { Hono } from "hono";
import { adminRouter } from "./admin.route";
import { meRouter } from "./me.route";

const userRouter = new Hono();

// Both sub-routers used to mount on the same `/users` prefix, which made
// correctness depend on registration order: `meRouter` had to win the race for
// `/users/me` against `adminRouter`'s `/:userId` (F-11). It did — but only by
// accident of ordering, and the collision was not harmless. `adminRouter`'s
// list route sat at `/users`, so `GET /api/users/admin` fell through to
// `GET /:userId` with `userId = "admin"` and died in Postgres with
// `22P02 invalid input syntax for type uuid` — a 500, not a 404.
//
// The admin surface now has its own literal prefix, so no admin path can ever
// shadow (or be shadowed by) a `/users/me*` path again. This is also the surface
// the docs already describe: `GET /users/admin`, `GET|PATCH|DELETE
// /users/admin/:userId`, `POST /users/admin/:userId/data-export`
// (13-api-service.md, 05-target-architecture.md, roadmap §NWB-P0-002).
userRouter.route("/users", meRouter);
userRouter.route("/users/admin", adminRouter);

export { userRouter };
