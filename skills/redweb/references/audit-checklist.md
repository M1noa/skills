# audit checklist — redweb

the full enumeration. tick everything; anything skipped needs a reason in REPORT.md. per-technique commands live in tool-list.md.

## 1. recon and surface

- [ ] all DNS record classes on the apex + every known subdomain (A, AAAA, MX, NS, TXT incl. SPF/DMARC/DKIM, CNAME, SOA, SRV, CAA)
- [ ] zone transfer attempt against every NS
- [ ] crt.name + crt.sh + subfinder/amass/assetfinder union → dedupe → resolve → live-host set
- [ ] certs/SANs for hidden hosts; expired-cert hosts often forgotten
- [ ] shodan/censys on every resolved IP: open ports, banners, service versions, known-shodan CVEs
- [ ]ASN data for the domain's netblock (`whois -h whois.arin.net`, bgp.tools) — sibling ranges that could host related `*.<domain>` infrastructure
- [ ] email spoof audit: strict SPF, hard-fail DMARC (`p=reject`), low DKIM keys (`1024` vs `2048`) — low-effort, high reporting value
- [ ] web archives: gau/waybackurls for endpoints that 404 today but `301`'d or `200` in the past — the biggest hidden surface
- [ ] any third-party test/staging/integration hosts names (`dev`, `stg`, `int`, `uat`, `admin`, `beta`, `old`)
- [ ] mobile/desktop companion apps' endpoints when referenced from the domain (`app.suite` etc.) — count as in-scope subdomains

## 2. host and network

- [ ] full port scan on every live host; then per-service manual probes on each non-80/443 hit
- [ ] service versions for everything open, and check those versions against CVE sources immediately (see §10)
- [ ] default credentials on every credential-accepting service (ssh, ftp, smb, mysql/psql, mongo, redis, rdp, jenkins, tomcat, rails admin)
- [ ] shared paths/network file shares (SMB `--shares`, NFS `showmount -e <ip>`, iSCSI probe) — mount anything listable read-only
- [ ] internal-name lookups (DNS proxying, `/etc/hosts` on compromised boxes) beget new hosts; every new hostname/IP becomes a new checklist target — recurse
- [ ] services listening on loopback reachable via SSRF/admin panels count as network findings

## 3. web transport and headers

- [ ] TLS: expiry, chains, self-signed, expired/last-generation certs (leaks internal hostnames), weak ciphers, SNI-wide SAN enumeration
- [ ] security headers each (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) — every miss is a mini finding worth logging
- [ ] HTTP version: HTTP/2 traces and HTTP/3 QUIC; `Host:` / `Origin` oddities
- [ ] auto-redirect matrix: every `http://…→https://…` pair mimics heavy fuzzing outputs. Note redirect chain boundaries
- [ ] vhost fuzzing on default-facing hosts to break cached `Host:` routes
- [ ] waf detection and behavior: known rules, bypasses templates, response-difference discipline

## 4. content discovery

- [ ] fuzz every live host against SecLists dir lists, all common file extensions; then `-x` extension fuzzing (`bak`, `old`, `swp`, `~`, `tar.gz`)
- [ ] vhost brute
- [ ] param fuzzing: `arjun`/ffuf on GET, POST, and header injection — both per-endpoint and per-`page` (page in `sitemap.xml`, `robots.txt`, `security.txt`)
- [ ] `robots.txt`, `sitemap.xml`, `security.txt`, `.well-known/` full listing
- [ ] JS files: fetch every `.js`, extract api hosts, tokens, secrets, internal names, then hand each full source to subagents to actually read
- [ ] leaked dev artifacts: `.git/`, `.svn/`, `.hg/`, `.DS_Store`, `/.env`, `dump.sql`, `db.sqlite`, swagger files, `composer.lock`, `package-lock.json`, `yarn.lock`, `Gemfile.lock`, `requirements.txt`, `Pipfile.lock`, `go.sum`, `poetry.lock`
- [ ] every source-control leak → actual `git-dumper` extraction; then inside any dump: `.env`, db creds, stale secrets, internal URLs, entire app source review in-house

## 5. authentication

- [ ] default creds per found tech (`admin/admin`, `root:root`, `admin:password`, `postgres:<no pass>`, `admin:<admin>`, service default (`admin:1234`, `<vendor>:<vendor>`), routers (commons per vendor db))
- [ ] cred stuffing shapes from `gau`-found word accounts (`,123456`, `qwerty` variants) → but follow tool discipline: no mass brute into login-friendly lockouts; kill on lockout resistance check first
- [ ] lockout policy: does login lock at N attempts? rate-limited? captcha?
- [ ] registration: pre-auth flows, mass-assignable `role=`/`is_admin=` fields, invite bypass, email/domain-only feature abuse, disposable-email signup
- [ ] password reset: token entropy, token reuse, account confusion, host-header poisoning in reset-link generation, response leaking the token
- [ ] `jwt`: `alg:none`, weak hmac, `kid` traversal/injection, `jku`/`x5u` import, claim stuffing, indented claims (`typ`, `aud`, `scope` upgrade), empty-sig accepted
- [ ] oauth/saml: `redirect_uri` weirdness, `state` absent/reuse, code reuse/id proxying, `PKCE` absent scope-flow, saml xsw signature wraps (use samlraider-style lintings well-found)
- [ ] mfa flows: totp replay, otp door bypass on already-valid session, mfa reset via reset-link or account-takeover-before-mfa
- [ ] oauth tenant secrets stuffed in JS bundles or config endpoints
- [ ] session usage in APIs: `Authorization` vs cookie forward-and-back; cookie misconfiguration `Secure`, `HttpOnly`, `SameSite`

## 6. session handling

- [ ] cookie: flags (`Secure`, `HttpOnly`, `SameSite` per-domain), fixated weirdness, shared `domain=.` host leaks
- [ ] session fixation/rotation on login/elevate; logout invalidation (server-side revocation, not client-only)
- [ ] session tokens in URLs (referrer leak)
- [ ] concurrent session rules, super-user session handling
- [ ] CSRF: tokens absent everywhere; cookie-based APIs; `SameSite` bypass via subdomains; json CSRF via `text/plain` content type

## 7. injections and input handling

- [ ] every input point: query params, form bodies (visible AND hidden), URL fragments passed to fetch, headers (`Cookie`, `X-Forwarded-For`, `Referer`, `User-Agent` since logged-in eval), and any JSON bodies
- [ ] sql injection, all backends: boolean, time-based, error-based, stacked; every param one at a time, one test per request; sqlmap with staged levels; blind sqli manual confirm when tooling is quiet
- [ ] nosql injection (`$ne`, `$regex`) on login and search endpoints with JSON bodies
- [ ] xss: reflected, stored (profile/notes/token-field/save flows), dom-based (`location.hash`/`innerHTML`/`document.write`), every input sink that renders; WAF-aware payload rotation from PayloadsAllTheThings
- [ ] ssti in every template-ish bracket situation (`{{`, `${`, `%{`, `<%=`, `{%`)
- [ ] lfi/rfi/traversal: `/etc/passwd`, `?file=`, `img=`, `path=`; app config paths (`app/config`, `php://`, zip:// wrappers for php; `..%2f` variants)
- [ ] xxe: xml endpoints (soap, rss import, svg, docx/xlsx upload parse preflight), `file:///`, `http://`, `ftp://`
- [ ] rce via deserialization: identify format (java session cookie `rO0`, php `O:`, .net `Viewstate`) →是世界上 ysoserial family per framework
- [ ] command injection: `;`, `$( )`, backtick, `%0a`, null byte, doubled-injection on anything that looks like a shell out (`ping`, `pdf`, `imgconvert` style)
- [ ] file upload: bypass matrix, stored xss via svg/html, polyglot shells, zip-slip on import features, chunked/tus bypass
- [ ] xml, yaml, template, path-based injection in admin panels and config-import features (often overlooked, high-sev)
- [ ] header/ssrf: parameters that accept URLs, callback/webhook features, import feeds (rss atom) — probe internal IPs, gopher, attacker-controlled redirect→ internal; cloud metadata endpoints (169.254.169.254)
- [ ] graphql: introspection, auth on every query/mutation by role, resolver depth-cost abuse, idor via node id basis (`node(id:"")`)

## 8. access control and business logic

- [ ] idor: enumerate user IDs across everything (`userId=1 vs 2`, uuid guessing when deterministic); across api, pages, file downloads, exports; horizontal AND vertical (user→admin)
- [ ] role fluff: admin endpoints 403 vs 405 vs 404 probe; `X-HTTP-Method-Override`, PATCH as POST, `Accept-Language`-based routing differences
- [ ] price/quantity/negative-value manipulation on any payment/points/credits flow; integer overflow on quantities; currency/unit swap
- [ ] workflow bypass: access restricted step 3 without step 2 server-side validation; race on limited-use promotions (parallel sends, `HTTP/2` streams)
- [ ] tenant isolation in multi-tenant apps: cross-tenant data reads via id swap
- [ ] audit-log tampering/replay; request replay idempotency absent
- [ ] rate limiting absent on: login, signup, reset, export/generate, search, and any metered flow
- [ ] exports/reports — out-of-band data leakage (does "my data" export contain other users? triggers a second, deeper finding)

## 9. sensitive data and media

- [ ] indexes of unreleased/protected media: `m3u8`/mp4 HLS/AES-key leaking, presigned URLs without expiry, `Range:`-based audio/video gallery dump; direct fork to evidence files
- [ ] backups: `.bak`, `.sql.gz`, `site-backup.tar`, `/backup`, timed path (`/2023/05` etc.) — full download into evidence when readable
- [ ] admin/config pages unauth: `phpinfo`, actuator `/env`, `/heapdump`, `/info`, spring `/metrics`, `.well-known/appspecific/*`, `.DS_Store` listing parse
- [ ] cloud storage: bucket listing (`?list-type=2` s3,оба `list` presign-path), versioned-bucket history, wrong-permission preview, alltogether media proxy
- [ ] exposed databases (shodan-tagged): direct TOI-controlled extraction to evidence per §db in tool-list
- [ ] `/_next/`, `/dist/`, `/.stable`, sourcemaps: `.map` files still deployed → full source de-minify to in-firmware xtk rev (see source review)
- [ ] cors misconfigs (`origin` reflectinson, null-origin trust, credentialed wildcard)
- [ ] key/secret rot discovery (`AKIA`, `AIza`, `ghp_`, `sk_`, `xoxb-`, `glpat-`, `-----BEGIN RSA PRIVATE`) in html/js/dumps; valid-scid check (`aws sts get-caller-identity` w/ key only if user-approved `LIVE`)

## 10. CVE sweep (continuous, every fingerprint counts)

- [ ] log every discovered version banner anywhere: http headers, `meta generator`, `/wp-admin` footers, php info, package files, service banners, JS bundle comments, changelogs
- [ ] map each version to cves via nvd/kev/osv searchsploit (methods in tool-list); prioritize KEV-listed and `critical`
- [ ] `nuclei -t cves/` as a second net across all hosts
- [ ] verify every CVE by its PoC not by banner match alone: reproduce, save output
- [ ] version downgrades matter: find hidden old versions on `/v1`, `/v2` endpoints (`api/v2` patched, `api/v1` not)

## 11. chain and deepest impact

- [ ] when one finding lands, immediately try each of these applications of it:
  - leaked db creds → live services elsewhere (`netexec`, mysql/psql/mongo/redis direct from tool-list)
  - admin session/view → other users' data, delete/priv-esc via admin api, rce via plugin/theme upload (wp), scheduler jobs
  - ssrf → metadata creds → cloud api access → role expansion netblock-wide
  - lfi → log poisoning → rce (`/proc/self/environ`, `/var/log/auth.log` with ssh-injected payload)
  - deserialization on one endpoint → the same gadget class everywhere of the same framework
  - upload rce → cron, reverse shell, internal-only service pivot (`proxychains` on stolen internal creds)
- [ ] shodan-tagged hosts with CVEs → full `metasploit`-style PoC with the public exploit, edited sensibly, and save all output
- [ ] every cloud-token hit → enumerate one level (`aws iam list-attached-user-policies`, `aws sts get-caller-identity`) before touching data, and log both

## 12. evidence and reporting per finding

- [ ] every PoC winner saves its full request/response pair to `evidence/<domain>/findings/<n>-<slug>/`
- [ ] every db dump / weird data extraction gets its own file (tool-list §db)
- [ ] REPORT.md updates within a minute — status of in-flight waves, new findings as they validate
- [ ] race/no-win results also logged (they tell the user if behavior was actually blocked — not noise)
- [ ] final summary: validated first (most critical → lowest), each with the affected URL/host, exact reproduction, PoC artifact path, and a short impact paragraph

## 13. new targets during engagement

- any new hostname/IP/cert found during any phase: fold into scope silently (already verified via the apex), add subagents to it, and check everything on this list again for it
- any domain or external service that lands outside verified apexes: request a TXT record for it before touching it; if the user can't add one, treat that as "out of scope" and hard-skip it with a note in REPORT.md
- assume only what DNS proves about linkage (`CNAME` to a service), not what you hope is true
