# Disaster recovery

What we back up, how long it takes to come back, and the evidence for both.

A backup that has never been restored is a hypothesis. The timings in
[Rehearsal](#rehearsal-2026-09-21) are from an actual restore, not an estimate.

---

## ⚠️ Step 0: confirm where production Postgres lives

**This has to be answered before the rest of the document is true.**

`.env.example` carries a commented-out Supabase pooler connection string, and
Supabase is definitely used for object storage. Whether production Postgres is
*also* Supabase, or a Railway Postgres service, is set in Railway's environment
variables and is not visible in this repository.

The two have different backup products, different retention and different
restore mechanics, so:

```bash
railway variables | grep -i database_url
```

Record the answer here, with the date checked:

| | |
| --- | --- |
| Postgres host | **UNCONFIRMED — fill this in** |
| Plan / tier | **UNCONFIRMED** |
| Automated backup frequency | **UNCONFIRMED** |
| Retention window | **UNCONFIRMED** |
| Point-in-time recovery available | **UNCONFIRMED** |
| Last verified | — |

Neither provider takes automated backups on its free tier. If the answer is
"free tier", the honest RPO is **"everything since the last manual dump"**, and
the rest of this document describes a procedure with no automated input.

---

## What has to survive

| Store | Holds | Backed up by | Loss means |
| --- | --- | --- | --- |
| **Postgres** | Everything of record: orgs, users, engagements, invoices, contracts, payments, the document hash ledger | Provider snapshots + the manual dump below | The business is gone. This is the one that matters. |
| **Supabase Storage** — `documents` | Generated invoice/contract/quote PDFs | Supabase bucket backup (see below) | Regenerable from Postgres for most documents, **except** anything counter-signed |
| **Supabase Storage** — WORM bucket | Retained documents of record | Object Lock semantics, see [Storage](#storage) | Not regenerable. This is the compliance copy. |
| **Redis** | Session/refresh tokens, OTP codes, password-reset and verify tokens, OAuth state, rate-limit counters, BullMQ queues | **Nothing, deliberately** | See [Redis](#redis-is-deliberately-not-backed-up) |

---

## RPO and RTO

**RPO — how much data we accept losing.**

| | Target | Met today? |
| --- | --- | --- |
| Postgres | **1 hour** | Depends entirely on Step 0. Point-in-time recovery meets it; daily snapshots do not (worst case 24h). |
| Storage | 24 hours | Supabase bucket backup cadence — confirm with Step 0 |

One hour is chosen because that is roughly the window in which losing writes is
recoverable by hand: an invoice or two re-issued, a signature re-collected. A
24-hour RPO means a full working day of invoices, payments and signatures gone,
which for a business of record is not an acceptable answer to a customer.

**RTO — how long until we are serving again.**

| Phase | Measured | Notes |
| --- | --- | --- |
| Restore database | **4.4 s** at 175 KiB | Scales with data volume — see below |
| Application boot | **5.3 s** | Includes `prisma migrate deploy`, which is a no-op on a restored database |
| **Measured total** | **~11 s** | At current data volume |
| **Stated RTO** | **4 hours** | See the reasoning below |

The four-hour target is not derived from the eleven seconds. It is dominated by
the things the rehearsal could not measure: noticing the outage, deciding to
restore rather than repair, provisioning a target database, waiting on the
provider's own snapshot-restore (which is minutes to hours and outside our
control), and re-pointing DNS or environment variables.

**Do not quote the eleven seconds to a customer as the RTO.** It is the floor,
and it was measured on a 175 KiB dataset. Re-measure after any significant
growth; a dump that takes a second today takes minutes at a few GB.

---

## Rehearsal: 2026-09-21

A full backup → restore → boot cycle, run end to end.

**Dataset:** 430 rows across the tables checked, 175 KiB compressed dump.

| Step | Elapsed |
| --- | --- |
| `pg_dump -Fc` | 1,516 ms |
| `pg_restore` into a fresh database | 4,385 ms |
| API boot against the restored database, to healthy `/health` | 5,282 ms |

**Verified, not assumed:**

- Row counts identical across every table checked — `orgs` 38, `users` 49,
  `engagements` 17, `invoices` 12, `service_units` 255, `events` 51.
- `_prisma_migrations` restored with all 8 rows, and
  `prisma migrate status` against the restored database reports
  **"Database schema is up to date!"** — so a restore does not trigger a
  spurious migration run on next boot.
- Money is exact: **14,927,000 paise across 12 invoices**, identical before and
  after.
- Column types survive: `grand_total` is still `bigint` and `gst_rate` is still
  `integer`, so the money widening is carried by the dump rather than being
  re-derived.
- The application boots against the restored database and `/health` reports
  `database: true`.

**What this rehearsal did not cover**, and must before it can be called
complete:

- A restore from a *provider snapshot*, rather than from a dump we took
  ourselves. That is the path a real disaster uses, and it depends on Step 0.
- A storage bucket restore.
- A restore at production data volume.

---

## Procedure

### Who

Anyone with the Railway project owner role and database credentials. In
practice today that is one person, which is itself a risk — a second person
should hold the access, or the restore cannot happen while they are asleep.

### 1. Decide: restore or repair

A restore loses every write since the snapshot. If the damage is one table or
one bad migration, repairing forward is almost always better. Restore when
data is *gone* and cannot be re-derived.

Take a snapshot of the damaged database first, before anything:

```bash
pg_dump "$DATABASE_URL" -Fc -f "pre-restore-$(date +%Y%m%d-%H%M%S).dump"
```

This is not optional. It is the only copy of whatever is still there, and a
restore overwrites it.

### 2. Restore into a **new** database, never over the live one

```bash
createdb -h <host> -U <user> stackfox_restore
pg_restore -h <host> -U <user> -d stackfox_restore \
  --no-owner --no-privileges <snapshot>.dump
```

Restoring over the live database means that if the snapshot turns out to be
bad, there is now nothing at all.

### 3. Verify before cutting over

```bash
psql -d stackfox_restore -c "
  select 'orgs', count(*) from orgs
  union all select 'invoices', count(*) from invoices
  union all select 'engagements', count(*) from engagements
  union all select 'contracts', count(*) from contracts;"

# Money must reconcile against whatever figure you have from before the incident
psql -d stackfox_restore -c "select sum(grand_total), count(*) from invoices;"

# The document hash ledger is the audit trail — check it came back
psql -d stackfox_restore -c "select count(*) from document_ledger;"
```

Then confirm the schema is consistent with the code being deployed:

```bash
DATABASE_URL="postgresql://.../stackfox_restore" \
  pnpm --filter @stackfox/prisma exec prisma migrate status
```

"Database schema is up to date" is the answer you need. Anything else means
the snapshot predates a migration and the application will fail on a missing
column.

### 4. Cut over

Point `DATABASE_URL` and `DIRECT_DATABASE_URL` at the restored database and
redeploy. Note that `Dockerfile.server` runs `prisma migrate deploy` before
starting the server, so a restored database that is behind on migrations will
be migrated forward automatically — and a *failed* migration presents as a
container that will not boot. See [ROLLBACK.md](./ROLLBACK.md).

### 5. Afterwards

- Verify document integrity: the hash ledger lets you prove which stored PDFs
  still match their recorded hash. Anything that does not match was restored
  from a mismatched pair of Postgres and storage snapshots.
- Re-run the integration suites against the restored environment.
- Record what happened, what was lost, and how long it took — then update the
  RTO in this document with the real number.

---

## Storage

Postgres and the object store are backed up on **separate schedules**, which
means a restore can leave a row pointing at a file that does not exist, or a
file whose hash no longer matches its ledger entry.

The document hash ledger added in Phase 3 exists precisely for this: after any
restore, run the verification endpoint across the documents of record and
treat `MISMATCH` or `NO_LEDGER_ENTRY` as data loss to be reported, not as a
glitch.

**WORM / Object Lock objects have different semantics.** An object under a
retention lock cannot be deleted or overwritten until its retention expires —
which is the point — but it also means a "restore" cannot roll such an object
back to an earlier version. The locked object is the record. If the Postgres
snapshot disagrees with it, the locked object wins.

The S3 Object Lock archive tier is not stood up yet (tracked separately), so
today the WORM bucket is a Supabase bucket with application-level retention
rules rather than storage-enforced immutability. **That distinction matters on
a security questionnaire** and should be stated accurately rather than
described as Object Lock.

---

## Redis is deliberately not backed up

Everything in Redis is either reconstructible or intentionally short-lived:

| Key | On loss |
| --- | --- |
| `refresh:*` | Users log in again |
| `otp:*`, `otp-attempts:*` | In-flight codes fail; the user requests a new one |
| `reset:*`, `verify:*` | Outstanding links stop working; re-send them |
| `oauth:state:*` | In-flight sign-ins fail and restart |
| `fastify-rate-limit-*` | Counters reset — limits are briefly generous |
| `lock:*` | Advisory only; the transactional guards do the real work |
| `checkout:*` | **Nothing.** Checkout sessions are Postgres-authoritative since Phase 2; Redis is a read cache. |

The one real loss is **queued BullMQ jobs**: generated documents, notifications
and webhook deliveries that had been enqueued but not run. Those do not
reappear. After a Redis loss, expect to re-trigger document generation for
anything created shortly before the incident, and to re-send webhook
deliveries subscribers will not have received.

Backing Redis up would not change that meaningfully — a restored queue would
replay jobs whose context has moved on — so the deliberate answer is to make
the loss survivable rather than to persist it.

---

## Honest gaps

Stated here rather than discovered during an incident:

1. **Step 0 is unanswered.** Until the provider, tier and retention are
   confirmed, the RPO above is a target and not a fact.
2. **No provider-snapshot restore has been rehearsed** — only a dump/restore
   cycle we drove ourselves.
3. **No storage-bucket restore has been rehearsed.**
4. **The rehearsal ran at 175 KiB.** The measured times are a floor, not a
   prediction.
5. **One person holds the access** needed to perform a restore.
6. **Nothing schedules the manual dump.** If the provider tier turns out not to
   include automated backups, a cron job that dumps to object storage is the
   first thing to add.
