# Resource Exhaustion and Availability

For untrusted requests/messages/files/tenant-state/agent-work consuming cpu/mem/disk/conns/workers/paid-apis/queues, or deadlocking/crashing shared services. Distinguishes source-reviewable availability vulns from perf issues. Never validate against live/shared services. Use [MEMORY-SAFETY-AND-BINARY.md](MEMORY-SAFETY-AND-BINARY.md) for memory integrity, [PROTOCOLS-RPC-AND-MESSAGING.md](PROTOCOLS-RPC-AND-MESSAGING.md) for broker delivery.

## Core discipline

- need input-to-cost path + missing effective bound + impact on another user/shared service/safety fn/operator spend. self-limiting work in requester's own process is not a service vuln.
- missing rate limit is not enough. check body/file caps, concurrency, queues, deadlines, db constraints, upstream gateways, per-tenant quotas.
- no stress/saturation/prod tests. asymptotic analysis + small boundary fixtures + mocked paid calls + strict local limits + cancellation tests.
- state attacker cost, service work, persistence, scope, recovery.
- `confirmed` needs source-visible bound failure + safe demo. else `needs_validation`.

## Attack classes

**Superlinear parsing / matching** (subagent_type: `general`)
small input drives regex backtracking, nested parse, recursive validation, graph traversal, template expansion, hash collisions. derive accepted depth/cardinality + complexity, show bounded growth curve locally.

**Decompression / representation amplification** (subagent_type: `general`)
compressed/sparse/nested/aliased/encoded input expands far beyond checked size. verify limits after every expansion + across parser stages (archives, images, fonts, docs, protocol compression).

**Query amplification** (subagent_type: `general`)
small request causes broad scans, pathological joins, fan-out, unbounded sort/agg, downstream calls. depth/filter/pagination/expansion unbounded. confirm authz does not intentionally permit the scope.

**Unbounded buffering / cardinality** (subagent_type: `general`)
bodies, streams, uploads, sessions, cache keys, metric labels, log fields, subs, pending jobs accumulate sans per-item + aggregate limits. find cleanup/expiry on disconnect/timeout/cancel/partial-parse.

**Handle / fd / tmp leaks** (subagent_type: `general`)
malformed/canceled work skips cleanup, retains sockets/files/cursors/timers/procs/tmp/refs. confirm repeatable retention via bounded local iterations on shared pool.

**Detached work after cancel** (subagent_type: `general`)
timeout/disconnect/cancel/failed-authz returns control but db/model/net/worker work continues. trace cancel/deadline propagation per layer.

**Pre-auth work imbalance** (subagent_type: `general`)
expensive parse/lookup/crypto/decompress/external calls happen before authn + earliest size/rate gate. compare requester effort vs service cost.

**Quota scope / reset gaps** (subagent_type: `general`)
accounting uses attacker-influenced ip/route/tenant/key/task id, letting work escape budget or eat another principal's quota. review overflow, distributed races, retries, reconnects, switches.

**Worker / pool starvation** (subagent_type: `general`)
low-priority/attacker jobs hold locks/workers/pools/event-loop/scheduler needed by others. need path bypassing fairness or retaining slot past deadline.

**Reachable fatal / deadlock** (subagent_type: `general`)
untrusted input reaches panic/abort/fatal-assert/unhandled-exit/lock-cycle/infinite-loop in shared process. confirm supervisor scope: one worker vs whole service.

**Retry storm / fail-open** (subagent_type: `general`)
timeouts/dep errors/partial messages/health failures trigger sync/unbounded retries sans jitter/ceiling/breaker/dedup. one bounded failure source must create persistent aggregate work.

**Poison-record blocking** (subagent_type: `general`)
one malformed record repeatedly fails at front of shared queue/partition/scan/migration/recovery. review skip/quarantine, offsets, tenant sharing of blocked unit.

## Universal moves

- input-to-resource table: earliest accepted size, pre-auth work, fan-out, persistence, shared pool, limit owner, recovery.
- compare aggregate vs per-object limits. 10k valid 1-byte items evade per-message caps, exhaust tenant/process state.
- isolated fixture only: strict cpu/mem/time, small growth points, mocked externals. stop at missing bound.

## Validation rules

1. name input, requester work, amplification/retained resource, shared blast radius, recovery.
2. confirm no visible upstream/parser/queue/tenant/framework bound. unknown deployed controls = `needs_validation`.
3. superlinear: accepted complexity + bounded growth. leaks: repeatable retention. fatal: process/supervisor isolation.
4. prioritize low requester work, unauth reachability, cross-tenant scope, persistence, poor recovery.
5. `confirmed` needs safe local proof + meaningful shared effect.
