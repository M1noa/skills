# License notes

`terminal-builder` is MIT-licensed. It synthesizes nine MIT-licensed skills by other authors. This file records what came from where.

## This skill

MIT. Use it, fork it, ship it inside a proprietary product, sell it. Keep the copyright notice.

## Upstream sources

All nine are stated by their authors to be MIT-licensed. The MIT terms require attribution and a copy of the license, not a specific format, so this table plus the notice below is the attribution.

| Author | Skill | What it contributed |
|---|---|---|
| Josiah Siegel | `tui-master` | Lifecycle discipline: setup/teardown ordering, raw-mode restoration, signal handling |
| gfargo | `tui-design` | Layout and density: hierarchy, borders, responsive bands, empty and error states |
| rsteube | `carapace-bin` (bubbletea, cobra) | Bubble Tea and Cobra integration: MVU structure, command wiring, completion |
| Stefanie Jane | `hyperskills` | Review structure: ranked findings, verification gates, checklist shape |
| Albert Lv | `designing-tuis` | Visual craft: color roles, spacing, typographic hierarchy in a cell grid |
| Jeffallan | `cli-developer` | CLI contract: streams, exit codes, flags, help text, config precedence |
| Kyle King | `tui-critique` | Failure-mode catalogue: flicker, tearing, blocked render loops, stale state |
| Sam Joyce | `ncurses` | curses-era fundamentals: windows, `endwin`, wide-character handling, resize |
| Gleb Kalinin | `agent-cli` | Prompt and agent-UI patterns: progress, spinners, structured output, cancellation |

## What was and was not copied

Nothing here is a verbatim reproduction of an upstream file. The skill is a rewrite: the standards and protocol material (ECMA-48, xterm control sequences, the Kitty protocols, Unicode UAX #9/#11/#14/#29, WCAG 2.2, NO_COLOR) is primary-source and carries no upstream obligation at all. The framework contracts are from each framework's own documentation. The rest is reorganization, synthesis, and new prose written against a single rule the upstream skills each hold a piece of:

> Use everything the terminal offers. Require nothing.

That rule is the original contribution. The nine sources disagreed with each other in places; where they did, this skill picks one and says why.

## Gap, stated rather than papered over

The repository coordinates of the nine upstream skills were not recorded when this file was written, and are not in the workspace source registry. Recovering an exact URL for each from memory would risk attributing the wrong person's work to the wrong repo, which is worse than an incomplete table. Fill them in from the sources you actually pulled from if you have them; the author names and skill names above are enough to locate each one.

If you are one of these authors and want a different attribution, a link, or your material removed, that request wins over this file. Open an issue.

## Notice

```
MIT License

Copyright (c) 2026 M1noa

Portions synthesized from MIT-licensed skills by Josiah Siegel, gfargo,
rsteube, Stefanie Jane, Albert Lv, Jeffallan, Kyle King, Sam Joyce, and
Gleb Kalinin. See LICENSE-NOTES.md.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
