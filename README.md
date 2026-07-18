# Hector 3.0 Web

Browser-only OOTP / StatsPlus analyzer. Upload HTML exports; scoring and tools run entirely in your browser. Player data stays in **IndexedDB** and settings in **localStorage** — nothing is uploaded to a server for analysis.

**Live site:** [https://hector.zabbyplex.xyz](https://hector.zabbyplex.xyz)

See [CHANGELOG.md](CHANGELOG.md) for what changed since Hector 2.4.5 Beta.

## Quick start (local)

```bash
npx --yes serve -p 8000
```

Open http://localhost:8000

Optional Docker (nginx):

```bash
docker build -t hector-web .
docker run -p 8080:80 hector-web
```

## Deploy / updates

This repo is hosted on **Cloudflare Pages** (static files, no build step).

- Production branch: `main`
- After you change the site: `git commit` and `git push` — Pages redeploys automatically

## Upload

1. **Player List.html (required)** — roster for Pitchers, Batters, Teams, Trade, Contract, Compare.
2. **Draft Class.html (optional)** — amateur pool for the **Draft** tab.
3. **Team List.html (optional)** — standings + park factors on **Teams** and **League Analysis**.

StatsPlus profile links use a `{pid}` URL template under **Options → Statsplus website integration**.

## Features

| Area | What it does |
|------|----------------|
| **Pitchers / Batters** | Live filters, stats or ratings Total, sample floors, row highlights, player cards, name → StatsPlus |
| **Draft** | Separate draft-class list; potential-heavy ratings scoring |
| **Teams** | Club aggregates; optional park / standings from Team List |
| **Compare** | Side-by-side players + radar |
| **Trade** | Two-sided trade with ratings, stats, $/WAR, contract Δ, draft picks |
| **Contract** | Comp-based AAV suggestion + role-pooled $/WAR context |
| **Archetypes** | Franchise philosophy fits (under **More**) |
| **League Analysis** | Parity, parks, talent WAR, divisions, YoY trends |
| **Options** | Weights, StatsPlus URL, your team |
| **Glossary** | Score definitions |

## Desktop Hector (archived)

Older Tkinter / Python desktop sources (through 2.4.5 Beta) are preserved here:

- Branch: [`archive/desktop`](https://github.com/zab1996/HectorOOTP/tree/archive/desktop)
- Tag: [`desktop-2.4.5`](https://github.com/zab1996/HectorOOTP/tree/desktop-2.4.5)

Desktop ZIP builds remain under [Releases](https://github.com/zab1996/HectorOOTP/releases).

## Layout

```
*.html                 # App pages (site root)
static/js/hector/      # Scoring, trade, contract, parse
static/js/pages/       # Page modules
static/css/app.css
Dockerfile             # Optional local nginx:alpine host
```
