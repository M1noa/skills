# Web Protocol and Auth

For reverse proxies, CDNs, API gateways, custom HTTP parsers, and anything implementing sessions, JWT, OAuth/OIDC, or SAML. Use these alongside the classes in [ATTACK-CLASSES.md](ATTACK-CLASSES.md).

OWASP WSTG identifiers in parentheses — tag findings with them.

## Request framing & parsing

- **Request smuggling** (WSTG-INPV-14): front-end and back-end disagree on where the request ends (CL.TE, TE.CL, TE.TE, CL.0, H2.CL, H2.TE). Hunt: any path that fronts another HTTP parser. Diff the front-end's framing from the back-end's. H2-vs-H1 fronting is the modern frontier.
- **HTTP/2 downgrade** (WSTG-INPV-15): H2-only headers (`:authority`, `:path`) survive a downgrade and reach H1 logic that doesn't expect them. CRLF injection via H2 pseudo-headers.
- **Header injection / CRLF** (WSTG-INPV-12): user input reflected into a header line. `\r\n` in user-controlled values that reach `Set-Cookie`, `Location`, `X-Forwarded-*`.
- **Method override abuse**: `X-HTTP-Method-Override: GET` on a state-changing endpoint, or `_method=DELETE` in body. Hunt any middleware that rewrites the method from a header/param.
- **Path normalization differential**: front-end normalizes one way, back-end another (`/a/../b` vs `/b`, `/a/./b`, `%2e%2e`, `..%2f`, `\` vs `/` on Windows). One parser's `/` is another parser's path separator. This is the root of most SSRF + authz bypass chains.

## Caching & CDNs

- **Cache poisoning** (WSTG-ATHN-06): unkeyed input (header, parameter) changes the cached response but isn't part of the cache key. Victim requests the same keyed URL, gets your poisoned response.
- **Cache key normalization issues**: `?utm=1` and `?UTM=1` keyed together but applied differently; trailing `;` stripped; query-param order differences.
- **Web cache deception** (WSTG-ATHN-07): path that the cache treats as static (`/account.json` cached as a static asset) but the origin treats as authed → CDN serves private content to a different user.
- **CDN origin trust**: origin trusts `X-Forwarded-For` for auth or rate-limiting without verifying the CDN is the sender. Direct-to-origin bypass.

## Authentication (WSTG-ATHN)

- **Credential stuffing / brute force**: no rate limit, no lockout, no IP throttle. But check whether rate limiting is at the app layer *or the CDN* — CDN-level rate limiting is a valid architecture; don't flag its absence at app layer if it's enforced upstream. See [SKILL.md anti-pattern 3](../SKILL.md).
- **Password reset poisoning** (WSTG-ATHN-09): reset token sent to an attacker-controlled host header, predictable tokens, tokens that don't expire, tokens that survive use.
- **MFA bypass**: MFA-enforcement middleware that can be skipped (request flow that lands on the post-MFA endpoint without the MFA step), MFA that doesn't protect the same session across re-auth, "remember this device" tokens that are guessable/over-permissive.
- **Default / test credentials** (WSTG-ATHN-04): shipped seed creds still live in prod, dev users created by migration scripts.
- **Account enumeration** via timing, error-message differences, or response-size differences between "user doesn't exist" and "wrong password" (WSTG-IDNT-04).

## Authorization (WSTG-ATHZ)

- **IDOR / BOLA** (WSTG-ATHZ-04): object references in URL/body/header not scoped to the caller. The class is "broken object-level authorization." Variant: the same object has multiple access paths with inconsistent checks (REST endpoint scopes, GraphQL field resolvers, bulk/export endpoints).
- **BFLA (Broken Function-Level Authorization)** (WSTG-ATHZ-02): endpoint exists but the auth check is missing or wrong for the *function* (not the object). Hunt: routes registered without a permission decorator, or with the wrong decorator (e.g., `@user_required` on an admin endpoint).
- **Mass assignment** (WSTG-INPV-11): user input sets fields the app didn't intend to expose (`role: admin`, `is_verified: true`). Bound vs unbound DTOs — unbound is the sink.
- **Horizontal vs vertical**: same auth check used for both, or only one enforced. Privilege escalation from user → admin is vertical; user A → user B's data is horizontal; both are BOLA/BFLA variants.
- **Bulk / batch / export / import**: do they enforce per-item authorization? Bulk endpoints are the most common BFLA surface because they were added later and bypass the per-item check.
- **IDOR bypasses**: supply an id where the endpoint doesn't ask for one; switch method (GET↔POST) or content-type; encoded/hashed ids are obfuscation, not authz — still test. cross-tenant replay of a valid id is the core test.
- **State downgrade**: `PUT /order/123 {"status":"draft"}` moving a finalized object back to editable, then mutating price/items. any client-writable state field on a finalized object is the sink.
- **GraphQL authz**: each resolver must check authorization, not just the top-level field. Nested resolvers commonly forget. Introspection enabled in prod = info disclosure.

## Session (WSTG-SESS)

- **Session fixation** (WSTG-SESS-03): session ID not rotated on login / privilege change. Logout that doesn't invalidate server-side.
- **Session prediction** (WSTG-SESS-02): sequential or low-entropy session IDs. `random.randint` instead of `secrets.token_bytes`.
- **Cookie flags**: `HttpOnly`, `Secure`, `SameSite=Lax|Strict`. Missing `Secure` on a session cookie served over HTTPS is a finding *if the cookie value is sensitive AND there's any HTTP-only path on the same origin*. Missing `HttpOnly` is a finding *only if the cookie is sensitive AND the app doesn't need JS to read it by design* (a CSRF token *needs* to be readable by JS by design).
- **JWT / JWS** (WSTG-SESS-08):
  - `alg: none` accepted — including case variants (`None`, `NONE`, `nOnE`) that naive string checks miss.
  - `alg: HS256` when the server expects `RS256` (asymmetric → symmetric confusion — re-sign with the public key).
  - Key confusion (`jwk` inline attacker key, `x5u`/`jku` fetched from attacker URL, JWKS cache poisoning via `kid` collision, lax TLS on key fetch, `crit` header ignored).
  - `kid` injection — path traversal or SQLi in the `kid` lookup.
  - Weak HMAC secrets (brute-forceable) — check secret source, not just algorithm.
  - No `exp` / lax `exp` / no clock skew tolerance → tokens that live forever or that break at exact-boundary moments.
  - Signature verified but claims (`aud`, `iss`, `sub`) not enforced (authn without authz inside the token).
  - Sensitive data (PII, session internals) in plaintext payload.
- **OAuth / OIDC** (WSTG-SESS-09 / WSTG-ATHN-10):
  - **State** missing or non-verified → CSRF on the callback, account takeover.
  - **PKCE** missing on confidential clients or any public client (mobile, SPA) → code interception. PKCE required for all clients per OAuth 2.1.
  - **Redirect URI** validation: exact match required — prefix match (`https://attacker.com.evil/` matches `https://attacker.com`), path traversal (`/callback/../attacker`), open redirect in the callback.
  - **Token leakage**: access token in URL fragment (acceptable for implicit, deprecated), in `Referer` (unacceptable), in browser history.
  - **Scope escalation**: `read` scope that returns write capability; refresh-token swap to a higher scope. Refresh rotation without reuse detection.
  - **ID token vs access token**: API accepting ID tokens as access tokens (check `token_type` + audience).
  - **PAR/JAR/JARM, DPoP/mTLS sender constraint, FAPI**: absence on high-value flows is a hardening note with the exact missing control named — not a finding alone.
- **SAML** (WSTG-ATHN-11):
  - XML signature wrapping (the signed assertion is moved to a different location, the unsigned assertion is read).
  - Comment injection in `NameID` (`admin<!-- comment -->`).
  - Replay across SPs if the same IdP token is accepted by multiple SPs without audience scoping.
  - `Recipient` / `Destination` / `Audience` not validated.

## SSRF (WSTG-INPV-19)

The class that connects web→internal. Hunt:
- Any endpoint that fetches a URL the user supplies (webhook, image proxy, PDF render, OAuth callback, import-from-URL).
- Validation that checks the *hostname* but not the resolved *IP* → DNS rebinding.
- Validation that blocks private IPs but allows `0.0.0.0`, `127.0.0.1` decimal/hex/octal forms, `[::]`, IPv6-mapped IPv4 (`::ffff:169.254.169.254`).
- Cloud metadata endpoints (`169.254.169.254`, `[fd00:ec2::254]` IPv6 AWS IMDS, `metadata.google.internal`).
- Redirect-based SSRF: the first request is to a safe host, the redirect goes internal.
- Parser differentials: the URL validator parses one way, the fetcher another (`file://`, `gopher://`, `dict://`, `ftp://`).

## Server-side request forgery to LLM (the AI bridge)

An LLM agent with a "fetch URL" tool is an SSRF amplifier. See [AI-AND-LLM.md](AI-AND-LLM.md) for the LLM-side classes.

## Outputs

Tag findings with: WSTG identifier, MITRE ATT&CK technique where applicable (e.g., `T1190` for exploit-public-facing-app, `T1556.006` for MFA bypass, `T1606.002` for forged SAML tokens), the attacker position (`EXTERNAL` for most web, `INTERNAL_NETWORK` for intra-VPC), and whether the finding requires `user_interaction: REQUIRED` (CSRF, clickjacking, open-redirect-to-token-theft chains).
