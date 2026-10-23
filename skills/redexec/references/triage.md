# triage spine

per-format static work for a redexec engagement. every command writes raw output under `evidence/<artifact>/raw/` when useful; extracted content under its own subdir. generated code has no comments.

## §1 intake

```
sha256sum artifact* | tee evidence/<artifact>/artifact.sums
file artifact*
rabin2 -I artifact*        # any Mach-O/ELF/PE: arch, format, libs, mitigations
rabin2 -e artifact*        # entry
```

- archives/containers (zip, tar, dmg, iso, squashfs, apk, ipa, msi, .app bundles) → unpack to `unpacked/`: `7z x`, `unzip`, `tar xf`, `binwalk -e` for embedded filesystems.
- nested containers found after unpacking loop back through intake.

## §2 identity + packer

- `strings -a -n 6 artifact* | tee evidence/<artifact>/strings/strings.txt` on every artifact — even unusual ones (scripts, office, mobile).
- high entropy in a section/blob → packed. common packers: `upx -d` first. detect via UPX magic, `file`, section names (`/UPX!`), overlay analysis.
- Go binaries: `go version -m <bin>`; Rust: look for `cargo` crate version strings; .NET: ilspy; Java: jar listing. version fingerprints from §11 CVE sweep.

## §3 strings + regex battery

run over the full string dump (and over decompiled source once produced). every match in a match file:

```
rg -oN 'https?://[^"'"'"'\s<>)]+' strings.txt | sort -u
rg -oN '(wss?)://[^"'"'"'\s<>)]+' strings.txt | sort -u
rg -oN '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' strings.txt | sort -u
rg -oN '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' strings.txt | sort -u
rg -oN 'AKIA[0-9A-Z]{16}' strings.txt
rg -oN "(?i)aws(.{0,20})[\"'][0-9a-zA-Z/+]{40}[\"']" strings.txt
rg -oN '[0-9]+-[0-9a-z_]{32}\.apps\.googleusercontent\.com' strings.txt
rg -oN 'AIza[0-9A-Za-z_-]{35}' strings.txt
rg -oN 'xox[baprs]-[0-9a-zA-Z-]{10,}' strings.txt
rg -oN 'gh[pousr]_[0-9A-Za-z]{36}' strings.txt
rg -oN 'sk-[A-Za-z0-9]{20,}' strings.txt
rg -oN -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' strings.txt
rg -oN 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.?[A-Za-z0-9_-]*' strings.txt
rg -oN '(?i)(postgres(ql)?|mysql|mongodb(\+srv)?|redis|mssql)://[^"'"'"'\s]+' strings.txt
rg -oN '(?i)(bearer|authorization)[: ]\S+' strings.txt
rg -oN '(?i)(api[_-]?key|secret|passwd|password|token|credential)["'"'"']?\s*[:=]' strings.txt
rg -oN '[a-z0-9.-]+\.s3[.-]?[a-z0-9-]*\.amazonaws\.com' strings.txt
rg -oN '(?i)s3://' strings.txt
rg -oN '[A-Za-z0-9+/]{40,}={0,2}' strings.txt
```

per-match → `secrets/<index>-<slug>.txt` with the matched secret bytes, then chase where it points (which resource, which api, which server) — a key to nowhere is a finding without an impact; trace it or downgrade.

## §4 unfurl / carve / yara

- base64 blobs >200 chars: decode each — `base64 -d` — then `file` on the result and recurse through intake if it recognizes a container.
- xor/rot13 candidate blobs: pass brute force xor keys 0x00–0xff via a one-line python loop when a blob is otherwise opaque, look for printable improvements.
- `binwalk -e` on firmware or unknown blobs; carve embedded images/audio/media with `foremost` if needed.
- yara starter rules matching anything already known inside the artifact (magic strings, embedded b64, UPX, .NET), reviewed after every major extraction; any trigger explored before being trusted.

## §5 native ELF/PE/Mach-O

```
rabin2 -I -z -i -E -l <bin>
r2 -qq -A -c 'afl' <bin>            # all functions
r2 -qq -A -c 'iz~http,s3,aws,key' <bin>
r2 -qq -A -c 'pdf @ sym.main' <bin>
```

- hunt: imports of exec/system/fork/network (socket/connect/send/recv), crypto usage (AES/DES/RC4), file-write paths, private key material, update/auth endpoints, hardcoded user ids or tokens.
- Windows: `capa <bin> -q -j` for capability mapping; label and save its output as recon, not verdicts.
- Mach-O: `otool -L`, `lipo -info`, `codesign -dv` for signing state; entitlements plists read for suspicious grants (`get-task-allow`, protected data access).

## §6 .NET / Java / Python

- .NET: `ilspycmd -p -o evidence/<artifact>/unpacked/ilspy <exe>`; treat embedded assembly resources as their own artifact.
- Java: `jar tf` + `jadx` for dex; `cfr`/procyon for decompile if jadx output is dense.
- Python: PyInstaller → `pyinstxtractor.py <exe>` then `pycdc`/`uncompyle6` on .pyc. look for inner packages that are themselves second-stage.

## §7 Electron / asar

- `npx @electron/asar extract app.asar app/` and treat `app/` as source.
- fuse inspection via the `rea` harness MCP `inspect_electron_fuses` if connected — note `enable_node_cli_inspect_arguments`, `embedded_asar_integrity_validation`, `only_load_app_from_asar` states.
- audit `main.js`/renderer heads for dangerous flags: `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`, `webSecurity: false`, `allowRunningInsecureContent`.
- `electronegativity -i . -o elng.json -x` — every finding traced to its code path and label (see §11 findings gate).

## §8 mobile apk/ipa (MASTG spine)

- apk: `apktool d`, `jadx -d jadx/`; `aapt dump badging`; manifest checks: `debuggable`, `allowBackup`, `cleartextTrafficPermitted`, custom trust agents, exported activities/providers, broadcast permissions.
- `/res/xml/network_security_config.xml` read full. certificate pinning or its absence is a finding either way.
- secrets in `/assets/` and `/res/`: the §3 battery. google-services.json gets checked against active api keys flows carefully.
- native libs (`*.so` per ABI): strings battery again for each.
- ipa: extract the ipa archive → `Payload/<app>.app`; `class-dump` on the Mach-O (`otool -ov` fallback); entitlements and embedded frameworks read the same way as §5.
- mobsfscan (or mobsf) against decompiled code, output json; label each rule hit before chasing it. cite MASTG test ids from the index (mas.owasp.org) for every confirmed mobile finding; one uncited is NEEDS-WORK until checked against the index.

## §9 scripts / office / pdf

- JS/TS: `js-beautify` first, hunt eval, `Function(` chains, charcode loops, double-encoded payloads; deobfuscation loop: decode what it decodes, rerun the parser.
- Python: note packers (pyarmor, py2exe, nuitka) then crack with the format's own tooling (pycdc for .pyc, pyd-decompile attempts for pyarmor bundles).
- Office: `olevba *.doc/xls/xlsm → macros/`; `pdfid` + `peepdf` for embedded JS; check `/ObjStm`, `/JavaScript`, `/OpenAction`.
- anything that emits shell/binary → recurse back through intake; any IO exec path recorded even if the target artifact never runs it.

## §10 secrets + SCA

- secret scan on extracted source: `gitleaks detect --source <dir>` and `trufflehog filesystem <dir>` — leads only, verify the one that looks worst by hand.
- dependency manifests (requirements.txt, go.mod, package.json, pubspec.yaml, Cargo.toml, Gemfile.lock, pom.xml):
  - `osv-scanner --lockfile=...`
  - python: `pip-audit -r requirements.txt`; node: `npm audit --json`; go: `govulncheck ./...`; rust: `cargo audit`; ruby: `bundler-audit check`
  - general SBOM: `syft dir:<dir> -o cyclonedx-json | grype`
- `cve-mcp` MCP tools if connected in this harness: `scan_dependencies` for lockfile-hoovered lists, `triage_cve` for specific versions.

## §11 CVE sweep

- every version fingerprint anywhere (strings, manifest, metadata, updater version) → CVE mapping at once:
  - `searchsploit -j "<product>" "<version>"` — verify each result against the version's own patch level; verify what actually applies.
  - OSV api: `curl "https://api.osv.dev/v1/query" -d '{"package":{"name":"<pkg>","ecosystem":"<eco>"},"version":"<ver>"}'`
  - `cve-mcp` tools: `triage_cve` (quick triage + KEV), `search_cves`, `get_vendor_advisory`.
- CISA KEV membership (via triage_cve / check_kev) leads any report entry. PoC presence (via `check_poc_exists` / `check_exploit_availability`) decides whether a version-match gets reported as exploitable or "requires testing".
- for embedded-core runtimes (electron, node, dart/flutter AOT, php/openssl/mysql versions in server binaries) fingerprint per runtime and list the runtime CVEs that version shipped before.

## §12 yara starter

```
rule artifact_interest {
  meta:
    note = "generated for a redexec engagement"
  strings:
    $upx  = "UPX!"
    $dotnet = "BSJB"
    $electron = "app.asar"
    $privkey = "-----BEGIN RSA PRIVATE KEY-----"
    $aurora  = /https?:\/\/[a-z0-9.-]{3,}/
  condition:
    any of them
}
```

adapt freely per artifact; inspected after every major extraction round.
