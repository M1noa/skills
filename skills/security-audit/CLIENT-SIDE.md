# Client-Side

For SPAs, browser extensions, embedded webviews, anything using `postMessage`, CORS, or WebSockets, or that renders untrusted content in the DOM. Use alongside the classes in [ATTACK-CLASSES.md](ATTACK-CLASSES.md). OWASP WSTG-CLNT identifiers in parentheses.

## DOM-based XSS (WSTG-CLNT-01)

The source-sink model. **Sources** (attacker-controlled DOM input): `location.hash`, `location.search`, `document.referrer`, `window.name`, `postMessage.data`, `localStorage`/`sessionStorage` (if user-influenced), any URL parameter the SPA router reads. **Sinks** (places that execute): `innerHTML`, `outerHTML`, `document.write`, `eval`, `Function()`, `setTimeout(string)`, `setInterval(string)`, `setAttribute('onclick', …)`, `insertAdjacentHTML`, `document.createElement('script')`, jQuery `$(html)`, React's `dangerouslySetInnerHTML`, Vue's `v-html`.

For each source, trace every path to every sink. Common gaps:
- Sanitizer bypassed by encoding (the sanitizer runs, the result is decoded downstream).
- Sanitizer on `innerHTML` but the same value flows to an attribute sink unescaped.
- Framework auto-escaping bypassed by an explicit raw-binding directive (`{!! !!}` in Blade, `<%= raw %>` in ERB, `dangerouslySetInnerHTML` in React).
- Markdown rendered with HTML enabled (`marked.setOptions({ html: true })`).
- URL parameters that pass through a router and reach `dangerouslySetInnerHTML` two hops later.

## Prototype pollution (WSTG-CLNT-10)

- `Object.assign({}, userObj)` where `userObj` has `__proto__` or `constructor.prototype` keys.
- Recursive merge / deep-extend utilities (`lodash.merge`, `jQuery.extend`) on attacker-controlled input before patch (CVE-listed in older versions).
- Sink: any code path that reads a default from `obj[key]` where `key` is missing — the polluted prototype supplies it. The impact is the *gadget* that reads the polluted default, not the pollution itself. Without a gadget, pollution is a hardening note, not a finding.
- Hunt for gadgets: options objects, config defaults, flag reads like `obj.sanitize || false`.

## postMessage and cross-origin messaging (WSTG-CLNT-05)

- **Origin check missing**: handler accepts `event.data` without verifying `event.origin` against an allowlist. Any page that can get a reference to the window can send.
- **Origin check flawed**: regex-based (`/^https?:\/\/(.*\.)?example\.com/`) matching `https://attacker.com.example.com` or `https://example.com.attacker.com`. Use exact string match or a regex anchored both sides.
- **Source check flawed**: trusting `event.source` (which the sender controls) instead of `event.origin` (which the browser enforces).
- **Bidirectional trust**: page A trusts page B's messages, page B trusts page A's — but a malicious page can frame either and replay.
- **Wildcard target**: `postMessage(data, '*')` from a page holding secrets — leaks to any framing page.

## CORS (WSTG-CLNT-07)

- `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` is impossible per spec, but a server that reflects the request `Origin` header into `ACAO` *and* sets `ACAC: true` is an open credential-bearing surface.
- **Origin reflection**: server reflects `Origin` verbatim without an allowlist → any origin can make credentialed requests. Check whether the reflection includes `null` (sandboxed iframes, `data:` URLs).
- **Subdomain wildcard trust**: `Origin: https://evil.example.com` accepted because the server regex-matches `example.com` substring.
- **Pre-flight bypass**: non-simple requests that the server handles without an `OPTIONS` preflight (e.g., content-type spoofed to `text/plain` to skip preflight, but parsed as JSON on the server).

## Clickjacking / UI redress (WSTG-CLNT-09)

- State-changing endpoints without `X-Frame-Options` or `Content-Security-Policy: frame-ancestors`.
- A frameable login form is one thing; a frameable "delete account" button is another. Severity scales with what the framed action does.
- CSP `frame-ancestors` is the modern control; `X-Frame-Options` is legacy. Either is acceptable; neither is a finding if the page is meant to be framed (an embedded widget).

## WebSocket (WSTG-CLNT-06)

- **Origin check missing**: WS server accepts any `Origin` header. Cross-site WS hijacking — attacker page opens a WS to the victim server, the victim's cookie authenticates the upgrade.
- **Auth on the upgrade only**: messages after the upgrade are unauthenticated. Session fixation via WS.
- **Untrusted input → server sink**: WS messages that reach a SQL query, shell, or template are injection sinks with no CSRF-style preflight.

## Open redirect (WSTG-CLNT-04)

Not always a finding on its own — but the **chain starter** for:
- Open redirect + OAuth callback that takes `redirect_uri` from a query param → token theft.
- Open redirect + a downstream SSRF that follows redirects → SSRF bypass.
- Open redirect on a SSO logout → next-login session fixation.

Report as a finding when there's a chain to real impact; as a hardening note otherwise.

## Service Workers / Web Workers

- Service worker registration from an attacker-controllable scope (XSS in a page on the origin → permanent backdoor until the SW is unregistered).
- `importScripts()` from a cross-origin URL without SRI.
- Push notifications: registration endpoint enumeration, silent push to fingerprint active users.

## Browser extensions / embedded webviews

- **`web_accessible_resources`**: any extension resource listed here is reachable by any web page. If the resource executes privileged code, a malicious page can frame it and exploit `postMessage` or DOM clobbering.
- **Content scripts**: run in the page's context but with the extension's privileges when they call `chrome.runtime.sendMessage`. Untrusted page DOM → content script → privileged handler is the bridge.
- **Webview bridges**: `window.webkit.messageHandlers.X.postMessage()` — native side must validate every message. WebView `addJavascriptInterface` on Android exposes Java objects to JS — any method is callable.
- **Deep links / URL schemes**: custom-scheme handlers that take user-controlled URLs and load them in a privileged webview.

## Outputs

Tag findings with: WSTG-CLNT identifier, source/sink pair for DOM XSS, the gadget for prototype pollution, whether `user_interaction: REQUIRED` (almost all client-side findings require it, which triggers the 0.7 multiplier in the risk formula — see [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md)).
