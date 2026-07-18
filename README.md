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

All Totals and tools run client-side from your HTML export. Weights are editable in **Options**; full formula write-ups live in the in-app **Glossary**.

| Area | What it does / how it’s calculated |
|------|-------------------------------------|
| **Pitchers / Batters** | Default **stats Total** (e.g. pitchers: WAR / ERA+ / rWAR / FIP- / HLD; batters: wRC+ / OPS+ / WAR) with sample floors (IP/G → Total 0 below floor). Toggle **ratings Total** for weighted current + potential scout grades. Live filters, percentiles, player cards, StatsPlus links. |
| **Draft** | Separate Draft Class pool; ratings scoring with **potential ×1.5 / current ×0.9** emphasis. |
| **Teams** | Org aggregates of pitching / offense / defense (ratings or stats modes). Optional Team List parks & standings; Avg $/WAR = SLR ÷ WAR (context only). |
| **Compare** | 2–3 players side-by-side: 20–80 ratings **radar**, season stats + ranks, league percentiles. Optional **Neutral park** (raw rates ÷ park factors from Team List). |
| **Trade** | Sides normalized so max pitcher/batter Totals map to 100. Role-pooled **$/WAR** medians (SP / RP / batters); Contract Δ ≈ WAR × pool rate − SLR; draft picks via exponential decay from R1P1. Optional Neutral park scales Totals. |
| **Contract** | Comp similarity on OPS+/wRC+/ERA+/FIP-/WAR (not Hector Total). Suggested **AAV** from scarcity-group median $/WAR × player WAR (fallback median SLR). |
| **Archetypes** | Franchise philosophy Fit % from rating profiles (More). |
| **League Analysis** | League parity, park factors, talent WAR, divisions, YoY trends (More; needs Team List for parks/standings). |
| **Upcoming FA** | Signed players in final year with **no extension** (YL/ECV signal) — FA / deadline candidates, not Extension Watch (More). |
| **Team Salary** | Relative-year payroll (**Now / +1 / +2…**) from YL + extension AAV; per-player **$/WAR** = SLR ÷ WAR; pie charts by team / P-B / position (More). |
| **Hidden Gems** | Category finders on **20–80 current ratings only** (AAAA, Miscast, converts, Park Nerfed, **Gem%**, …). Under construction (More). |
| **Options** | Ratings + pitcher/batter **stats weights**, StatsPlus `{pid}` URL, your team — rescore without re-upload. |
| **Glossary** | Full score definitions and weight breakdowns. |

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
