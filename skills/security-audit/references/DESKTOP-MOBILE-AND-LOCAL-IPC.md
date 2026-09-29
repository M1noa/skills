# Desktop, Mobile, and Local IPC

For desktop/mobile apps, privileged helpers, updaters, daemons, webview hosts, deep-link handlers, native-messaging hosts, local ipc client/server. Untrusted actor may be a doc, remote content, another app/user, sandbox child, lower-priv account. Self-harm in same account is not a boundary violation.

## Core discipline

- paths, process names, bundle ids, claimed sender fields are not peer auth. use os peer creds, code identity, capability handles, channel state.
- bridge/helper must authorize each op + final resource after parsing. trusted ui/broker does not make attacker args trusted.
- os sandbox/signing/entitlements/keychain acls/exported-component policy are real controls when pinned + visible.
- `confirmed` needs source + bounded local/emulator test. else `needs_validation`.

## Attack classes

**Deep-link ambiguity** (subagent_type: `general`)
another app/page invokes route mutating state, importing data, completing auth, selecting account without session + one-time binding. check normalization, dup query fields, scheme/host/path match, exported policy, replayed links.

**Handoff confusion** (subagent_type: `general`)
oauth/sso/magic-link/invite/pairing/payment callback lands in wrong app/profile/tenant/transaction. bind state to initiator identity, session, account, provider, op, expiry.

**Navigation-origin to bridge confusion** (subagent_type: `general`)
remote/attacker frames reach js/native bridge meant for packaged content. validate origin at call time + after every nav/redirect/subframe/popup/error page. prefix checks are not enough.

**Over-broad bridge** (subagent_type: `general`)
web content selects files/commands/ipc/creds/actions via generic bridge. check method allowlist, normalized args, tenant authority, gesture/confirm, return disclosure.

**IPC peer-auth gaps** (subagent_type: `general`)
unix sockets, pipes, xpc, binder, dbus, native messaging, rpc, shm, loopback accept lower-trust peer without os creds/code identity/sandbox token/channel ownership. need meaningful method/disclosure behind channel.

**Claimed principal vs channel** (subagent_type: `general`)
channel belongs to app/user A but fields select user/tenant/profile B. bind each method + resource to peer cred, not caller-declared id.

**Exported component overreach** (subagent_type: `general`)
mobile component/automation endpoint externally invokable, does app-only op. review merged manifests, intent filters, permission/signature level, grants, aliases.

**Privileged helper as deputy** (subagent_type: `general`)
low-priv caller selects privileged command/file/service/user/setting without per-op authz. review sudo/polkit/uac/xpc rules; helper validates normalized args itself.

**Install / repair path trust** (subagent_type: `general`)
privileged installer reads manifests/scripts/packages/symlinks/cwd/repair state writable by lower-trust actor post-authz. bind authz to immutable content + safe dest.

**Local file toctou** (subagent_type: `general`)
check-then-follow symlink/mount/case changes during priv read/write. use descriptor-relative ops, verify final ownership.

**Account switch / restore leakage** (subagent_type: `general`)
cache, tasks, widgets, notifications, db, webview storage, biometric approvals survive logout/switch and surface under later account.

## Universal moves

- enumerate processes, components, endpoints, schemes, associations, webview origins, helpers. record os identity, priv, caller, callable ops.
- read final packaging: merged manifest, entitlements, installer rules, messaging registration, handlers, acl creation.
- validate with dummy profiles + non-sensitive fixtures on isolated machine/emulator.

## Validation rules

1. name attacker capability, crossed principal, channel, accepted arg/state, unauthorized op/disclosure.
2. confirm os/sandbox/signing/permission/consent/installer controls. unknown packaging = `needs_validation`.
3. bridges: cite origin control + priv sink. ipc: peer auth + per-resource authz. helpers: final normalized dest.
4. bounded dummy-only tests. stop at boundary result.
5. `confirmed` needs full source + local chain.
