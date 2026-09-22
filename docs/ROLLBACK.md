# Rolling back a deploy

Written to be usable at 3am by someone who did not ship the change.

The API runs on Railway from `Dockerfile.server`; the client is a static Vite
build on Vercel. They deploy independently, which is what makes most rollbacks
easy and one kind of rollback hard.

---

## The one thing to decide first

**Did this release run a database migration?**

```bash
git log --oneline -20 -- packages/prisma/prisma/migrations
```

- **No migration** → roll back the service. Nothing else to think about.
- **Migration** → read [Rolling back across a migration](#rolling-back-across-a-migration)
  before touching anything. Reverting the code while the new schema is live is
  usually fine; reverting the _schema_ under live code usually is not.

---

## API rollback (Railway)

Railway keeps every previous deployment. Redeploying an old one is the fastest
path back and does not require a build.

**Dashboard:** project → the API service → **Deployments** → find the last
deployment that was healthy → **⋯** → **Redeploy**.

**CLI:**

```bash
railway status
railway redeploy --deployment <deployment-id>
```

Watch `/health` come back before declaring it over:

```bash
curl -sf https://stackfox-api-production-c639.up.railway.app/health && echo OK
```

`railway.json` sets `restartPolicyType: ON_FAILURE` with 3 retries and a 30s
health-check timeout, so a container that cannot start will flap three times
and then stay down. Three restarts in a row is the signal to roll back, not to
wait longer.

### If the rollback also fails

The previous image was fine yesterday, so a failure now is almost always
**environment**, not code: a variable that was added, changed, or rotated for
the new release and is missing or wrong for the old one.

```bash
railway variables
```

`apps/api/src/env.ts` validates configuration at boot and refuses to start in
production when a required variable is absent — the startup log names the
variable. Fix the variable, do not delete the check.

---

## Client rollback (Vercel)

**Dashboard:** project → **Deployments** → the last good one → **⋯** →
**Promote to Production**.

**CLI:**

```bash
vercel ls
vercel promote <deployment-url>
```

The client is a static bundle with no server state, so this is always safe and
always instant.

### Rolling back the client alone

Usually fine, with one exception: the client calls the API, so an old client
against a new API only works while the API's responses are still
backward-compatible. `scripts/check-api-contract.mjs` runs in CI precisely to
stop a change that breaks that, but a rollback skips CI. If the client rollback
crosses a release where an API response shape changed, roll the API back too.

---

## Rolling back across a migration

First, a property of this deployment that decides how the rest of this section
behaves. `Dockerfile.server` runs migrations as part of starting the container:

```
CMD sh -c "prisma migrate deploy && node dist/server.js"
```

Two consequences:

- **A rollback cannot undo a migration.** The old image runs `migrate deploy`
  with its own, shorter migration list; Prisma applies what is missing and
  skips what is already applied. It never removes anything. Redeploying an old
  image gives you old _code_ against the _current_ schema.
- **A failed migration means the container never starts.** `migrate deploy`
  runs before the server does, so a migration error looks like a service that
  will not boot and fails its health check — not like a database error. If a
  deploy is flapping straight after a schema change, read the migration output
  at the top of the container log before anything else.

**Prisma has no `migrate down`.** There is no command that undoes a migration.
Anyone who tells you to "just revert the migration" is describing something
that does not exist.

What that leaves:

### Case 1 — the migration was additive (new table, new nullable column, new index)

**Roll back the code and leave the schema alone.** An extra table or nullable
column is inert to the old code. This covers the great majority of migrations,
including all three of the most recent ones (`fk_indexes`,
`checkout_sessions`, `document_integrity`).

Do not try to be tidy here. Dropping the new objects buys nothing and risks
everything.

### Case 2 — the migration was destructive (dropped or renamed a column, narrowed a type, added a NOT NULL)

The old code will fail against the new schema, and the data the old code needs
may no longer exist.

1. **Do not roll back first.** Establish what the damage is while the system is
   still consistent.
2. Take a snapshot immediately, before anything else:
   ```bash
   pg_dump "$DATABASE_URL" -Fc -f "pre-rollback-$(date +%Y%m%d-%H%M%S).dump"
   ```
3. Prefer **rolling forward**: write a new migration that restores what the old
   code needs, and deploy that. A forward fix is reviewable, is tested by CI,
   and leaves the migration history honest.
4. Restore from backup only if data was actually lost. Railway's Postgres
   backups are point-in-time; restoring loses every write since the restore
   point, so it is the last option, not the first.

### Case 3 — the migration is half-applied

Prisma marks a failed migration in `_prisma_migrations` and refuses to continue
until it is resolved.

```bash
pnpm --filter @stackfox/prisma exec prisma migrate status
```

- The migration ran but was recorded as failed → mark it applied:
  ```bash
  pnpm --filter @stackfox/prisma exec prisma migrate resolve --applied <name>
  ```
- The migration genuinely did not apply → mark it rolled back, fix it, redeploy:
  ```bash
  pnpm --filter @stackfox/prisma exec prisma migrate resolve --rolled-back <name>
  ```

Confirm which by looking at the database, not by guessing from the error.

---

## Background workers

Workers run in the same container as the API (`WORKERS_INLINE`), so an API
rollback rolls them back too. Jobs already in BullMQ are **not** rolled back:
a job enqueued by the new code is still in Redis and will be picked up by the
old code.

If the release changed a job's payload shape, drain or delete the affected
queue before rolling back, or the old worker will fail on every one of them:

```bash
redis-cli -u "$REDIS_URL" KEYS 'bull:*'
```

---

## Afterwards

1. Say in the incident channel that a rollback happened, which service, and to
   which deployment. A silent rollback is how two people fix the same thing.
2. Revert the offending commit on `main` — do not leave production rolled back
   while `main` still holds the bad change, or the next unrelated deploy ships
   it again:
   ```bash
   git revert <sha>
   ```
3. Whatever CI missed, add a check for it. Every gate in `.github/workflows/`
   exists because something got through.
