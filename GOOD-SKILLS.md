# skill sources

where every skill in `~/skills` came from, and how to refresh it.

**156 skills across 9 sources.** all sources identified.

regenerate with `python3 gen-sources.py` after adding or removing skills.

## sources

| source | skills | local copy | update |
|---|---:|---|---|
| [SnailSploit/claude-red](https://github.com/SnailSploit/claude-red) | 79 | `~/skills/.repos/claude-red` | `git -C ~/skills/.repos/claude-red pull` |
| [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 33 | `~/skills/.repos/scientific-agent-skills` | `git -C ~/skills/.repos/scientific-agent-skills pull` |
| [nousresearch/hermes-agent](https://github.com/nousresearch/hermes-agent) | 30 | `-` | re-clone, not tracked locally |
| [thelegendtubaguy/pi-ponytail](https://github.com/thelegendtubaguy/pi-ponytail) | 5 | `~/.pi/agent/npm/node_modules/pi-ponytail` | reinstall the pi-ponytail package |
| [M1noa/skills](https://github.com/M1noa/skills) | 4 | `~/Documents/Projects/skills` | `git -C ~/Documents/Projects/skills pull` |
| [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) | 2 | `-` | re-clone, not tracked locally |
| [Nutlope/hallmark](https://github.com/Nutlope/hallmark) | 1 | `-` | re-clone, not tracked locally |
| [Jakubantalik/Libraries.dev](https://github.com/Jakubantalik/Libraries.dev) | 1 | `-` | re-clone, not tracked locally |
| [morluto/rea](https://github.com/morluto/rea) | 1 | `-` | re-clone, not tracked locally |

## update

```bash
# cloned repos: pulling is enough, ~/skills symlinks follow automatically
git -C ~/skills/.repos/scientific-agent-skills pull
git -C ~/skills/.repos/claude-red pull
git -C ~/Documents/Projects/skills pull

# pi-ponytail (5 skills) ships as an npm package
npm --prefix ~/.pi/agent/npm update pi-ponytail

# everything else was copied in, not cloned. to refresh any of them:
#   tmp=$(mktemp -d)
#   git clone --depth 1 --filter=blob:none --sparse <repo> $tmp/r
#   git -C $tmp/r sparse-checkout set <path>
#   cp -R $tmp/r/<path> ~/skills/<skill>

# to recover a skill removed upstream, fetch it from the commit before the removal:
#   git clone --filter=blob:none --no-checkout https://github.com/nousresearch/hermes-agent $tmp/h
#   git -C $tmp/h checkout c49fa88b~1 -- skills/github/github-auth
```

## upstream drift

These 12 are hermes-agent skills whose paths no longer exist. The lock file still claims the old paths, so a naive re-install would fail. All were changed in `c49fa88b` (2026-08-30, "shipped-set slim"), reachable with `c49fa88b~1`.

| skill | current status upstream |
|---|---|
| `github-auth` | merged into `skills/software-development/github` (git history at `c49fa88b`) |
| `github-code-review` | merged into `skills/software-development/github/references/code-review.md` |
| `github-issue-to-pr` | merged into `skills/software-development/github/references/issue-to-pr.md` |
| `github-issues` | merged into `skills/software-development/github/references/issues.md` |
| `github-pr-workflow` | merged into `skills/software-development/github/references/pr-workflow.md` |
| `github-repo-management` | merged into `skills/software-development/github` (git history at `c49fa88b`) |
| `merge-reconciler` | renamed -> `optional-skills/autonomous-ai-agents/agent-merge-conflict-arbiter/` |
| `nano-pdf` | merged into `skills/productivity/pdf` as a reference + script |
| `ocr-and-documents` | merged into `skills/productivity/pdf` |
| `plan` | dropped from HEAD. git history at `c49fa88b` |
| `session-librarian` | DELETED upstream. never maintainer-intended. git history at `c49fa88b` only |
| `touchdesigner-mcp` | moved to the optional-skills hub, then dropped. git history at `c49fa88b` only |

`camoufox/` and `software-development/` are category dirs, not skills (`software-development/hermes-agent-skill-authoring` is the skill).

## full inventory

| skill | source | path in source |
|---|---|---|
| `chrome-extensions` | GoogleChrome/modern-web-guidance | `skills/chrome-extensions/SKILL.md` |
| `modern-web-guidance` | GoogleChrome/modern-web-guidance | `skills/modern-web-guidance/SKILL.md` |
| `libraries-dev` | Jakubantalik/Libraries.dev | `skills/libraries-dev/SKILL.md` |
| `aeon` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/aeon` |
| `dask` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/dask` |
| `database-lookup` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/database-lookup` |
| `exploratory-data-analysis` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/exploratory-data-analysis` |
| `generate-image` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/generate-image` |
| `geopandas` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/geopandas` |
| `get-available-resources` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/get-available-resources` |
| `infographics` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/infographics` |
| `markdown-mermaid-writing` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/markdown-mermaid-writing` |
| `markitdown` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/markitdown` |
| `matplotlib` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/matplotlib` |
| `networkx` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/networkx` |
| `open-notebook` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/open-notebook` |
| `parallel-web` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/parallel-web` |
| `pi-agent` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/pi-agent` |
| `polars` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/polars` |
| `pymc` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/pymc` |
| `pymoo` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/pymoo` |
| `pytorch-lightning` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/pytorch-lightning` |
| `scikit-learn` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/scikit-learn` |
| `seaborn` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/seaborn` |
| `shap` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/shap` |
| `simpy` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/simpy` |
| `stable-baselines3` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/stable-baselines3` |
| `statistical-analysis` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/statistical-analysis` |
| `statistical-power` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/statistical-power` |
| `statsmodels` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/statsmodels` |
| `sympy` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/sympy` |
| `torch-geometric` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/torch-geometric` |
| `transformers` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/transformers` |
| `umap-learn` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/umap-learn` |
| `uncertainty-and-units` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/uncertainty-and-units` |
| `zarr-python` | K-Dense-AI/scientific-agent-skills | `.repos/scientific-agent-skills/skills/zarr-python` |
| `anti-slop` | M1noa/skills | `/Users/minoa/Documents/Projects/skills/skills/anti-slop` |
| `osint-ultimate` | M1noa/skills | `/Users/minoa/Documents/Projects/skills/skills/osint-ultimate` |
| `project-audit` | M1noa/skills | `/Users/minoa/Documents/Projects/skills/skills/project-audit` |
| `security-audit` | M1noa/skills | `/Users/minoa/Documents/Projects/skills/skills/security-audit` |
| `hallmark` | Nutlope/hallmark | `skills/hallmark/SKILL.md` |
| `offensive-active-directory` | SnailSploit/claude-red | `.repos/claude-red/Skills/active-directory/offensive-active-directory` |
| `offensive-advanced-redteam` | SnailSploit/claude-red | `.repos/claude-red/Skills/infrastructure/offensive-advanced-redteam` |
| `offensive-ai-security` | SnailSploit/claude-red | `.repos/claude-red/Skills/ai/offensive-ai-security` |
| `offensive-anti-forensics` | SnailSploit/claude-red | `.repos/claude-red/Skills/forensics/offensive-anti-forensics` |
| `offensive-api-abuse` | SnailSploit/claude-red | `.repos/claude-red/Skills/api/offensive-api-abuse` |
| `offensive-api-security` | SnailSploit/claude-red | `.repos/claude-red/Skills/api/offensive-api-security` |
| `offensive-basic-exploitation` | SnailSploit/claude-red | `.repos/claude-red/Skills/exploit-dev/offensive-basic-exploitation` |
| `offensive-bluetooth-ble` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-bluetooth-ble` |
| `offensive-bluetooth-classic` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-bluetooth-classic` |
| `offensive-bug-identification` | SnailSploit/claude-red | `.repos/claude-red/Skills/fuzzing/offensive-bug-identification` |
| `offensive-business-logic` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-business-logic` |
| `offensive-c2-frameworks` | SnailSploit/claude-red | `.repos/claude-red/Skills/forensics/offensive-c2-frameworks` |
| `offensive-cicd-pipeline` | SnailSploit/claude-red | `.repos/claude-red/Skills/cicd/offensive-cicd-pipeline` |
| `offensive-cicd-secrets` | SnailSploit/claude-red | `.repos/claude-red/Skills/cicd/offensive-cicd-secrets` |
| `offensive-cloud` | SnailSploit/claude-red | `.repos/claude-red/Skills/cloud/offensive-cloud` |
| `offensive-container-escape` | SnailSploit/claude-red | `.repos/claude-red/Skills/container/offensive-container-escape` |
| `offensive-crash-analysis` | SnailSploit/claude-red | `.repos/claude-red/Skills/exploit-dev/offensive-crash-analysis` |
| `offensive-crypto-attacks` | SnailSploit/claude-red | `.repos/claude-red/Skills/crypto/offensive-crypto-attacks` |
| `offensive-data-exfiltration` | SnailSploit/claude-red | `.repos/claude-red/Skills/post-exploitation/offensive-data-exfiltration` |
| `offensive-deauth-disassoc` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-deauth-disassoc` |
| `offensive-dependency-confusion` | SnailSploit/claude-red | `.repos/claude-red/Skills/supply-chain/offensive-dependency-confusion` |
| `offensive-deserialization` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-deserialization` |
| `offensive-edr-evasion` | SnailSploit/claude-red | `.repos/claude-red/Skills/infrastructure/offensive-edr-evasion` |
| `offensive-evil-twin` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-evil-twin` |
| `offensive-exploit-dev-course` | SnailSploit/claude-red | `.repos/claude-red/Skills/exploit-dev/offensive-exploit-dev-course` |
| `offensive-exploit-development` | SnailSploit/claude-red | `.repos/claude-red/Skills/exploit-dev/offensive-exploit-development` |
| `offensive-fast-checking` | SnailSploit/claude-red | `.repos/claude-red/Skills/utility/offensive-fast-checking` |
| `offensive-file-upload` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-file-upload` |
| `offensive-fuzzing` | SnailSploit/claude-red | `.repos/claude-red/Skills/fuzzing/offensive-fuzzing` |
| `offensive-fuzzing-course` | SnailSploit/claude-red | `.repos/claude-red/Skills/fuzzing/offensive-fuzzing-course` |
| `offensive-graphql` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-graphql` |
| `offensive-idor` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-idor` |
| `offensive-initial-access` | SnailSploit/claude-red | `.repos/claude-red/Skills/infrastructure/offensive-initial-access` |
| `offensive-iot` | SnailSploit/claude-red | `.repos/claude-red/Skills/iot/offensive-iot` |
| `offensive-jwt` | SnailSploit/claude-red | `.repos/claude-red/Skills/auth/offensive-jwt` |
| `offensive-k8s-attacks` | SnailSploit/claude-red | `.repos/claude-red/Skills/container/offensive-k8s-attacks` |
| `offensive-keylogger-arch` | SnailSploit/claude-red | `.repos/claude-red/Skills/infrastructure/offensive-keylogger-arch` |
| `offensive-krack-fragattacks` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-krack-fragattacks` |
| `offensive-lateral-movement` | SnailSploit/claude-red | `.repos/claude-red/Skills/post-exploitation/offensive-lateral-movement` |
| `offensive-linux-privesc` | SnailSploit/claude-red | `.repos/claude-red/Skills/privesc/offensive-linux-privesc` |
| `offensive-lorawan-sub-ghz` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-lorawan-sub-ghz` |
| `offensive-mitigations` | SnailSploit/claude-red | `.repos/claude-red/Skills/exploit-dev/offensive-mitigations` |
| `offensive-mobile` | SnailSploit/claude-red | `.repos/claude-red/Skills/mobile/offensive-mobile` |
| `offensive-netexec` | SnailSploit/claude-red | `.repos/claude-red/Skills/active-directory/offensive-netexec` |
| `offensive-network-attacks` | SnailSploit/claude-red | `.repos/claude-red/Skills/network/offensive-network-attacks` |
| `offensive-oauth` | SnailSploit/claude-red | `.repos/claude-red/Skills/auth/offensive-oauth` |
| `offensive-open-redirect` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-open-redirect` |
| `offensive-osint` | SnailSploit/claude-red | `.repos/claude-red/Skills/recon/offensive-osint` |
| `offensive-osint-methodology` | SnailSploit/claude-red | `.repos/claude-red/Skills/recon/offensive-osint-methodology` |
| `offensive-parameter-pollution` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-parameter-pollution` |
| `offensive-persistence` | SnailSploit/claude-red | `.repos/claude-red/Skills/post-exploitation/offensive-persistence` |
| `offensive-phishing` | SnailSploit/claude-red | `.repos/claude-red/Skills/social-engineering/offensive-phishing` |
| `offensive-race-condition` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-race-condition` |
| `offensive-rce` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-rce` |
| `offensive-reporting` | SnailSploit/claude-red | `.repos/claude-red/Skills/utility/offensive-reporting` |
| `offensive-request-smuggling` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-request-smuggling` |
| `offensive-shellcode` | SnailSploit/claude-red | `.repos/claude-red/Skills/infrastructure/offensive-shellcode` |
| `offensive-social-engineering` | SnailSploit/claude-red | `.repos/claude-red/Skills/social-engineering/offensive-social-engineering` |
| `offensive-sqli` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-sqli` |
| `offensive-ssrf` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-ssrf` |
| `offensive-ssti` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-ssti` |
| `offensive-supply-chain` | SnailSploit/claude-red | `.repos/claude-red/Skills/supply-chain/offensive-supply-chain` |
| `offensive-tls-attacks` | SnailSploit/claude-red | `.repos/claude-red/Skills/crypto/offensive-tls-attacks` |
| `offensive-toctou` | SnailSploit/claude-red | `.repos/claude-red/Skills/exploit-dev/offensive-toctou` |
| `offensive-vuln-classes` | SnailSploit/claude-red | `.repos/claude-red/Skills/fuzzing/offensive-vuln-classes` |
| `offensive-waf-bypass` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-waf-bypass` |
| `offensive-wifi` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-wifi` |
| `offensive-wifi-recon` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-wifi-recon` |
| `offensive-windows-boundaries` | SnailSploit/claude-red | `.repos/claude-red/Skills/infrastructure/offensive-windows-boundaries` |
| `offensive-windows-mitigations` | SnailSploit/claude-red | `.repos/claude-red/Skills/infrastructure/offensive-windows-mitigations` |
| `offensive-windows-privesc` | SnailSploit/claude-red | `.repos/claude-red/Skills/privesc/offensive-windows-privesc` |
| `offensive-wpa-enterprise` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-wpa-enterprise` |
| `offensive-wpa2-psk` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-wpa2-psk` |
| `offensive-wpa3-sae` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-wpa3-sae` |
| `offensive-wps` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-wps` |
| `offensive-xss` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-xss` |
| `offensive-xxe` | SnailSploit/claude-red | `.repos/claude-red/Skills/web/offensive-xxe` |
| `offensive-z-wave` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-z-wave` |
| `offensive-zigbee-thread-matter` | SnailSploit/claude-red | `.repos/claude-red/Skills/wireless/offensive-zigbee-thread-matter` |
| `reverse-engineer-anything` | morluto/rea | `.agents/skills/reverse-engineer-anything/SKILL.md` |
| `architecture-diagram` | nousresearch/hermes-agent | `skills/creative/architecture-diagram/SKILL.md` |
| `arxiv` | nousresearch/hermes-agent | `skills/research/arxiv/SKILL.md` |
| `blocked-page-recovery` | nousresearch/hermes-agent | `skills/research/blocked-page-recovery/SKILL.md` |
| `claude-code` | nousresearch/hermes-agent | `skills/autonomous-ai-agents/claude-code/SKILL.md` |
| `codebase-inspection` | nousresearch/hermes-agent | `skills/github/codebase-inspection/SKILL.md` |
| `computer-use` | nousresearch/hermes-agent | `skills/autonomous-ai-agents/computer-use/SKILL.md` |
| `docx` | nousresearch/hermes-agent | `skills/productivity/docx/SKILL.md` |
| `dogfood` | nousresearch/hermes-agent | `skills/software-development/dogfood/SKILL.md` |
| `excalidraw` | nousresearch/hermes-agent | `skills/creative/excalidraw/SKILL.md` |
| `findmy` | nousresearch/hermes-agent | `skills/apple/findmy/SKILL.md` |
| `gif-search` | nousresearch/hermes-agent | `skills/media/gif-search/SKILL.md` |
| `grounded-citations` | nousresearch/hermes-agent | `skills/research/grounded-citations/SKILL.md` |
| `himalaya` | nousresearch/hermes-agent | `skills/email/himalaya/SKILL.md` |
| `huggingface-hub` | nousresearch/hermes-agent | `skills/mlops/huggingface-hub/SKILL.md` |
| `llama-cpp` | nousresearch/hermes-agent | `skills/mlops/inference/llama-cpp/SKILL.md` |
| `maps` | nousresearch/hermes-agent | `skills/productivity/maps/SKILL.md` |
| `node-inspect-debugger` | nousresearch/hermes-agent | `skills/software-development/node-inspect-debugger/SKILL.md` |
| `obsidian` | nousresearch/hermes-agent | `skills/note-taking/obsidian/SKILL.md` |
| `opencode` | nousresearch/hermes-agent | `skills/autonomous-ai-agents/opencode/SKILL.md` |
| `pdf` | nousresearch/hermes-agent | `skills/productivity/pdf/SKILL.md` |
| `powerpoint` | nousresearch/hermes-agent | `skills/productivity/powerpoint/SKILL.md` |
| `python-debugpy` | nousresearch/hermes-agent | `skills/software-development/python-debugpy/SKILL.md` |
| `requesting-code-review` | nousresearch/hermes-agent | `skills/software-development/requesting-code-review/SKILL.md` |
| `research-paper-writing` | nousresearch/hermes-agent | `skills/research/research-paper-writing/SKILL.md` |
| `simplify-code` | nousresearch/hermes-agent | `skills/software-development/simplify-code/SKILL.md` |
| `spike` | nousresearch/hermes-agent | `skills/software-development/spike/SKILL.md` |
| `systematic-debugging` | nousresearch/hermes-agent | `skills/software-development/systematic-debugging/SKILL.md` |
| `test-driven-development` | nousresearch/hermes-agent | `skills/software-development/test-driven-development/SKILL.md` |
| `xlsx` | nousresearch/hermes-agent | `skills/productivity/xlsx/SKILL.md` |
| `youtube-content` | nousresearch/hermes-agent | `skills/media/youtube-content/SKILL.md` |
| `ponytail` | thelegendtubaguy/pi-ponytail | `/Users/minoa/.pi/agent/npm/node_modules/pi-ponytail/skills/ponytail` |
| `ponytail-audit` | thelegendtubaguy/pi-ponytail | `/Users/minoa/.pi/agent/npm/node_modules/pi-ponytail/skills/ponytail-audit` |
| `ponytail-debt` | thelegendtubaguy/pi-ponytail | `/Users/minoa/.pi/agent/npm/node_modules/pi-ponytail/skills/ponytail-debt` |
| `ponytail-help` | thelegendtubaguy/pi-ponytail | `/Users/minoa/.pi/agent/npm/node_modules/pi-ponytail/skills/ponytail-help` |
| `ponytail-review` | thelegendtubaguy/pi-ponytail | `/Users/minoa/.pi/agent/npm/node_modules/pi-ponytail/skills/ponytail-review` |
