# Data Isolation and Lifecycle

For multi-tenant stores, derived copies (search/cache/analytics), object links, export/restore, migrations, deletion/revocation/retention. Use [ATTACK-CLASSES.md](ATTACK-CLASSES.md) for endpoint authz, [CLOUD-AND-DEPLOYMENT.md](CLOUD-AND-DEPLOYMENT.md) for provider storage policy.

## Core discipline

- tenant field on a record is not isolation. find the query/key/path/policy enforcing it per read + write.
- trace derived copies. sanitized primary data turns unsafe in search/cache/export/preview/logs/replicas/backups.
- deletion/revocation covers current + historical + cached + indexed + exported + restored + queued copies.
- `confirmed` needs full lineage + dummy-tenant test. else `needs_validation`.

## Attack classes

**Missing tenant enforcement** (subagent_type: `general`)
read/update/delete/list/count/bulk binds object without tenant/owner, or trusts body fields for identity. compare direct, nested, background, admin, import, legacy paths.

**Composite-key collision** (subagent_type: `general`)
cache keys, object paths, uniqueness, doc ids, tmp files, dedup keys omit tenant/env. two principals overwrite/read the same logical key.

**Policy / query disagreement** (subagent_type: `general`)
row policy, orm scopes, authz filters, raw clients apply different predicates. check joins, aggregates, views, `unscoped`/service clients, error paths missing context.

**Blob / signed-ref overreach** (subagent_type: `general`)
keys, attachment/version ids, shared links, signed urls allow ops/namespaces beyond issuer access, or survive acl change. bind op, object/version, audience, expiry, tenant.

**Search / cache acl drift** (subagent_type: `general`)
acl/lifecycle change without invalidating searchable/cached/embedded/preview/index copy. validate filtering at retrieval + ingestion + invalidation.

**Analytics / logs as readers** (subagent_type: `general`)
private content/creds into broader-access, longer-retention, tenant-mixed systems. confirm data class + realistic reader; field names alone are not enough.

**Enumeration oracles** (subagent_type: `general`)
counts, filters, ordering, errors, unique constraints, timings, notifications disclose protected state. need concrete confidential predicate + observable distinction.

**Export / backup expansion** (subagent_type: `general`)
export/snapshot/report/backup includes other tenants, hidden fields, soft-deleted data, secrets, history above requester access. check per-item authz after selection + download authz.

**Import / restore expansion** (subagent_type: `general`)
restore/import bypasses owner/schema/acl/uniqueness/validation, overwrites resources, recreates into unwritable tenant. treat archive contents as untrusted.

**Migration ownership confusion** (subagent_type: `general`)
old records lack tenant/acl fields, ids collide, partial rollout splits defaults. review backfill, dual-read/write, compat, rollback, resume.

**Soft-delete / tombstone bypass** (subagent_type: `general`)
direct lookup, search, traversal, link, worker, restore ignores lifecycle predicate. check re-registration of deleted ids.

**Stale authz / derived use** (subagent_type: `general`)
member removal, acl update, consent withdrawal, revocation, downgrade leaves sessions/caches/subs/jobs/materialized data authorizing future ops.

**Restore reintroduces invalid state** (subagent_type: `general`)
backup/undo/undelete restores data/creds/memberships current policy forbids. re-authorize restored state.

## Universal moves

- pick one protected record. draw write, query, cache, index, event, export, backup, delete, restore paths. mark principal + tenant per edge.
- compare two dummy tenants through same service methods, then after acl change, delete, switch, restore.
- start at bypass clients, jobs, migrations, global uniqueness, cache keys. these drop request-scoped identity first.

## Validation rules

1. name lower-trust principal, protected data, affected owner, alt copy/op, unauthorized disclosure/mutation.
2. cite intended policy + the path omitting it. confirm no other layer enforces it.
3. prove with dummy tenants + non-sensitive fixtures. stop at minimum observable record.
4. external cache/storage/replica/retention unknowns = `needs_validation` with exact owner check.
5. `confirmed` needs complete lineage + concrete impact.
