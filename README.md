# Hector 3.0 Web

Hector OOTP analyzer has changed to a web page! Instead of having to install a program you can now just visit the **Live site:** [https://hector.ootp-analyzer.uk](https://hector.ootp-analyzer.uk) or host your own version! On the website you will find instructions on how to setup your views in OOTP to export the proper data for the program. Scoring and tools run entirely in your browser. Player data stays in **IndexedDB** and settings in **localStorage** — nothing is uploaded to a server for analysis. Thanks to @quarterback for forking the original desktop app into PortalOOTP and giving some fresh ideas to the program! Such as Player cards, Archetypes, League analysis, and stat/rating percentiles.

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

Hosted on **Cloudflare Pages** (static files, no build step).

- Live: [https://hector.ootp-analyzer.uk](https://hector.ootp-analyzer.uk) (also [hector-edf.pages.dev](https://hector-edf.pages.dev))
- Production branch: `main`
- Push to `main` → GitHub Action deploys with Wrangler

Optional local preview: `npx wrangler pages deploy . --project-name=hector`

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
| **Upcoming FA** | Expiring deals with no extension — FA / deadline trade candidates (More) |
| **Team Salary** | Multi-year org payroll grid + pie charts (More) |
| **Hidden Gems** | Overlooked-player categories / Gem% (More; under construction) |
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
