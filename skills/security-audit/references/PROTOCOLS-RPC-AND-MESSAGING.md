# Protocols, RPC, and Messaging

For grpc, graphql transports, cap'n proto, thrift, protobuf, custom binary protocols, streaming rpc, webhooks, brokers/queues/pubsub/event buses. Use [MEMORY-SAFETY-AND-BINARY.md](MEMORY-SAFETY-AND-BINARY.md) for parser memory safety, [WEB-PROTOCOL-AND-AUTH.md](WEB-PROTOCOL-AND-AUTH.md) for http framing, [RESOURCE-EXHAUSTION-AND-AVAILABILITY.md](RESOURCE-EXHAUSTION-AND-AVAILABILITY.md) for availability impact.

## Core discipline

- "internal" is not auth. name peer identity per hop + how it becomes the app principal.
- schema validation proves shape, not provenance, authority, ordering, safe values.
- broker guarantees differ from app guarantees. write down retry/order/ack/dedup/tx before judging state changes.
- `confirmed` needs full lifecycle + bounded local producer/consumer test. else `needs_validation`.

## Attack classes

**Boundary / canonicalization disagreement** (subagent_type: `general`)
components disagree on length, compression, dup/unknown fields, encoding, numeric width, normalization, envelope/body precedence. compare generated vs custom parsers, gateways, bindings, version converters. confirm which principal/resource/op differs post-decode.

**Union / enum / default confusion** (subagent_type: `general`)
unknown variants, missing discriminators, zero values, default privs, compat mappings reach code assuming a validated case. review exhaustive dispatch + default branches.

**Envelope / payload mismatch** (subagent_type: `general`)
authz uses routing/envelope metadata while handler acts on conflicting tenant/account/subject/object/sender in body. identify authoritative source; clients must not override it.

**Interceptor / method-path gaps** (subagent_type: `general`)
authn/authz interceptor covers unary but not streams, reflection, health, gateway-transcoded, compat, per-message. compare every registration to same op.

**Peer-to-principal confusion** (subagent_type: `general`)
mtls/workload/bearer/forwarded/broker creds authenticate channel, but caller field selects user/tenant. channel identity + claimed principal need deterministic binding.

**Per-item / streaming authz gaps** (subagent_type: `general`)
stream/sub/batch authorized once, later items name other resources or continue post-revocation. re-check where scope changes; bind subs to original principal.

**Topic / routing-key scope gaps** (subagent_type: `general`)
publisher/subscriber selects another tenant topic/wildcard/group/partition/reply/dlq route. check broker acls where visible + app-side namespace construction. payload tenant text is not isolation.

**Untrusted producer as control plane** (subagent_type: `general`)
body declares itself admin event/provider callback/replication/migration without authenticated producer + event type. verify sig + source/account/audience binding.

**Replay / idempotency gaps** (subagent_type: `general`)
retries/redelivery repeat side effect: dedup absent, post-mutation, or colliding keys. confirm broker delivery model + non-idempotent effect.

**Stale / out-of-order acceptance** (subagent_type: `general`)
older state, revoked membership, canceled work, pre-step-up auth overwrites newer state. review seq/version, tombstones, partitions, restore/replay.

**Ack / commit ordering** (subagent_type: `general`)
ack before durable commit loses work; commit before unreliable ack duplicates mutation. eval outbox/inbox + recovery.

## GraphQL (source-side checks)

- introspection enabled in prod (`{__typename}` answers) = schema leak; field suggestions on typos leak hidden fields even when introspection is off.
- per-resolver authz, not top-level only. nested resolvers commonly forget; compare each resolver to the same op.
- batching without limits = brute force / OTP bypass / rate-limit evasion via arrayed ops in one request.
- depth/complexity: nested queries, alias fans (`a1:users a2:users ...`), circular fragments. missing depth cap + cost analysis = DoS via [RESOURCE-EXHAUSTION-AND-AVAILABILITY.md](RESOURCE-EXHAUSTION-AND-AVAILABILITY.md).
- GET-accepted queries = CSRF-shaped risk (mutations over GET are the finding).
- subscriptions: ws upgrade carrying expired/missing token, subscribing to other users' streams.
- file upload (multipart spec), resolver args reaching SQL/NoSQL/shell sinks.

## Universal moves

- draw producer → broker/transport → gateway → consumer → storage per message family. per hop: peer, tenant/resource fields, validation, side effect.
- feed same small fixture to every schema version/binding. test dup/missing/unknown/boundary/replay/reorder without load.
- compare normal/retry/dlq/replay/migration/reflection/stream/transcoded routes. policy must survive transport changes.

## Validation rules

1. name producer/peer, message, channel identity, affected principal/resource, unauthorized mutation/disclosure.
2. disagreement needs both parsers + divergent decoded value. safe rejection either side blocks `confirmed`.
3. replay/order needs actual delivery guarantees + bounded local repro.
4. verify all visible interceptor/acl/gateway/consumer layers. external attachments = `needs_validation`.
5. `confirmed` needs complete lifecycle + observed result.
