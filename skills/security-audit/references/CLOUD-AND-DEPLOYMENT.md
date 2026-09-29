# Cloud and Deployment

For repos defining cloud identity, IaC, containers/k8s, service mesh, serverless/edge, ingress, object storage, or env-specific config. Use with [SUPPLY-CHAIN-AND-PROVENANCE.md](SUPPLY-CHAIN-AND-PROVENANCE.md) (build trust) and [WEB-PROTOCOL-AND-AUTH.md](WEB-PROTOCOL-AND-AUTH.md) (proxy semantics).

## Core discipline

- manifest alone is not exposure. establish which env consumes it, what overlays modify it, whether the path is active.
- map workload identity to operations + resources. broad policy is a finding only when lower-trust input reaches an unauthorized action.
- secret references are not disclosure. need a lower-trust reader, output, log, or unsafe fallback.
- `confirmed` needs active in-repo config + local render/policy check. else `needs_validation` with the exact missing fact.

## Attack classes

**Workload identity overreach** (subagent_type: `general`)
workload/pod/function identity acts beyond its role, untrusted input selects the target. check policy conditions, resource patterns, service-account attachment, fallback credentials.

**Cross-account role confusion** (subagent_type: `general`)
role assumption, external ids, token exchange, federation accept claims not bound to intended source account, audience, repo, namespace. need both trust policy + caller-controlled claim.

**Unexpected reachability** (subagent_type: `general`)
ingress/service/listener/sg annotation/bind exposes admin/debug/metrics/control-plane to lower-trust net. missing controls alone = `needs_validation`; repo-controlled public route to sensitive handler = `confirmed`.

**Trusted-proxy / mesh bypass** (subagent_type: `general`)
backend accepts forwarded identity/mtls subject from outside intended ingress/sidecar, or alt port/health path bypasses mesh. verify header stripping + fail-open when proxy absent.

**Metadata / internal-service reachability** (subagent_type: `general`)
untrusted url/destination reaches instance metadata, control-plane sockets, internal apis. trace url parsing + redirects; establish deployed net + identity boundaries.

**Host / capability exposure** (subagent_type: `general`)
lower-trust workload selects privileged mode, caps, host namespaces/paths, devices, runtime sockets, sa tokens. bare missing seccomp/ro-fs is hardening unless a reachable op crosses the boundary.

**Config precedence drift** (subagent_type: `general`)
dev values, chart defaults, env, flags, overlays disable authn/tls/tenant-scope/audit in a deployed env. render final config per maintained env, not just base file.

**Secret exposure across workloads** (subagent_type: `general`)
secrets in logs, crash reports, argv, shared env, broad volumes, build outputs, discovery. check type + authority; public key id is not a credential.

**Object / signed-url confusion** (subagent_type: `general`)
bucket policy, keys, cdn origins, signed urls fail to bind principal, op, namespace, audience, expiry. review list/version/write paths, not just reads.

**Event-source identity confusion** (subagent_type: `general`)
function trusts body fields as source identity without provider-signed envelope, sub/topic, account, region, replay check. compare push/pull/retry/dlq paths.

## Universal moves

- matrix per env: external ports, workload identity, net peers, mounted secrets, cloud resources. diffs need explanation.
- follow lower-trust request/object/label/event into cloud policy. name the workload credential doing the final op.
- diff deploy/migrate/restore/failover/emulator paths. check behavior when mesh/admission/identity/secret service is down.

## Validation rules

1. active source path + effective object, else `needs_validation`.
2. name lower-trust caller, identity, selector, resource, unauthorized op/disclosure.
3. verify provider/orchestrator defaults at pinned version. no assumed public ip/metadata/firewall.
4. local only: render templates, eval policy, isolated fixture, emulator with dummy ids. never probe live.
5. `confirmed` needs full trace + concrete result. else `needs_validation`.
