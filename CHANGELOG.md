# Changelog — Hector 3.0 Web

What changed since **Hector 2.4.5 Beta** (Python/Tkinter desktop), through the move to a browser app and ideas drawn from **PortalOOTP**.

## Acknowledgments

Thanks to **PortalOOTP** and **quarterback** for the inspiration for the improvement ideas.

## Platform rewrite

| Before (2.4.5) | After (Hector 3.0 Web) |
|----------------|-------------------------|
| Desktop Tkinter GUI | Static web pages in the browser |
| Python scoring engines | JavaScript in `static/js/hector/` |
| Local file load into the desktop app | Upload HTML in the browser |
| In-app / file-based session | **IndexedDB** (players) + **localStorage** (settings) |
| Desktop packaging | `npx serve`, Docker/nginx, or any static host |

No server-side math: all scoring and tools run client-side. Legacy FastAPI / `hector_core` / Jinja scaffolding was removed from this tree so the project is static-only.

## Carried forward from Hector 2.4.5

Core product still includes the 2.4.5 spine:

- **Pitchers / Batters** — weighted ratings scoring (2.4.5 used editable weight files; web **Options** UI is listed under New)
- **Teams** — organization aggregates
- **Trade** — two-sided trades (including draft-pick lineage)
- **Contract** — comps → suggested AAV / years
- **StatsPlus** profile links via `{pid}` URL template
- Live filters, search, and row highlights (UX evolved for the web)

## From Portal (ported or adapted)

Features inspired by PortalOOTP, reimplemented for the browser app:

| Area | In Hector 3.0 Web |
|------|-------------------|
| Stats scoring | Stats-based **Total** + sample floors (IP/G); toggle with ratings Total on Pitchers/Batters |
| League tools | **League Analysis** (parity, parks, talent WAR, YoY); **Team List** for parks/standings |
| Discovery | **Percentiles**, **player cards**, **Archetypes** (franchise philosophies + Fit %) |
| Hidden Gems | Categories such as AAAA, Miscast, Toolsy (further evolved below) |
| Contracts / market | Richer MISC columns (YL, CV/TY, ECV/ETY); role-pooled **$/WAR**; **Neutral park** on Trade & Compare |

## New in Hector 3.0 Web

Not in 2.4.5; beyond or distinct from Portal where noted:

- **Draft** tab + optional **Draft Class.html** pool (dedicated tab vs a draft *mode* on roster lists)
- **Compare** page with ratings **radar**
- **Upload** checklist, multi-file UX, and export screenshot guide — including an **import field check** that reports required / recommended columns present or missing on Player List (and related) HTML before you rely on scoring
- **Options weights UI** — in-app editor for ratings and pitcher/batter **stats weights** (not a Portal feature; 2.4.5 edited weight files on disk)
- **Customizable weights without reload** — save in Options and Totals refresh via client-side rescore; no app restart or re-upload
- **Upcoming FA** — signed players in their final year with no extension (different market signal than Portal’s Extension Watch)
- **Team Salary** — PuckPedia-style multi-year payroll grid and pie charts
- **Glossary** — score definitions with TOC / per-page jumps
- **Hidden Gems** extras (page marked **under construction**): amended AAAA (minors matched by position group to productive majors), Starter Converts / Reliever Converts, Park Nerfed (majors only), **Gem%**
- Web polish such as column filters (e.g. durability “Iron Man” / “Ironman” normalize)
