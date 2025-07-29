<a name="top"></a>

# Hector OOTP Analyzer

Hector is a powerful and fully customizable desktop analytics tool for Out of the Park Baseball (OOTP) leagues. Built for both casual GMs and competitive online leagues, Hector imports your exported HTML data and delivers clear, actionable insights with a dark-mode UI. Get in-depth, sortable breakdowns for every player and team, intelligent highlights, advanced filters, and direct Stats+ integration—helping you evaluate talent, find hidden gems, and make smart roster moves.

---

## Table of Contents

- [Downloading the Latest Version](#downloading-the-latest-version)
- [Flexible Weighting System](#flexible-weighting-system)
- [Hector Data Export Instructions](#hector-data-export-instructions)
- [Features Overview](#features-overview)
  - [Core Functionality](#core-functionality)
  - [User Interface Features](#user-interface-features)
  - [Reporting and Analysis Tools](#reporting-and-analysis-tools)
  - [Dataset Overview](#dataset-overview)
  - [User Assistance](#user-assistance)
- [Calculation Flowcharts](#calculation-flowcharts)

---

## Downloading the Latest Version
[⬆️ Back to Top](#top)

Download the newest build of Hector from the **Releases** page:

➡️ [**Download the latest version here**](../../releases)

1. Download the ZIP for the latest release.
2. Extract it to a folder of your choice.
3. Run the executable (or use Python if running from source).

<details>
<summary><strong>Showcase: Click to view screenshots of Hector in action</strong></summary>

![Showcase1](screenshots/showcase1.png)
![Showcase2](screenshots/showcase2.png)
![Showcase3](screenshots/showcase3.png)
![Showcase4](screenshots/showcase4.png)
![Showcase5](screenshots/showcase5.png)

</details>

---

## Flexible Weighting System
[⬆️ Back to Top](#top)

**Editing Player Weights**

- `pitcher_weights.py`: Set importance of pitching attributes
- `batter_weights.py`: Set importance of hitting/defense/baserunning

How to adjust the weights:

1. Open `pitcher_weights.py` or `batter_weights.py` in a text editor (e.g., Notepad++ or VS Code).
2. Modify values in the `section_weights` dictionary — higher = more influence on the score.
3. Save your changes in the program folder alongside the `.exe`.
4. In Hector, click the **Reload Data** button to apply changes immediately.

---

## Hector Data Export Instructions
[⬆️ Back to Top](#top)

Export player data from OOTP with custom views for **Batters** and **Pitchers**:

- Data Import Process
    - Create separate OOTP views for pitching and batting (see screenshots below)
    - Export each view as HTML
    - Replace the provided `pitchers.html` and `batters.html`
    - Click **Reload Data** in Hector for instant refresh

### 1. Create the View in OOTP

Include all these columns:




### 3. Save Views as Global

- Save each view as **Global**
- Name them **"Hector Batting"** and **"Hector Pitching"** (customize "Hector" if you want)

### 4. Export HTML Files

- Export the Batters view as `batters.html`
- Export the Pitchers view as `pitchers.html`

![Export HTML DATA](screenshots/hectorexport.png)
![Export HTML DATA](screenshots/hectorexport2.png)
![Export HTML DATA](screenshots/hectorexport3.png)

### 5. Replace Existing Files

- Overwrite the old `batters.html` and `pitchers.html` files in your Hector folder.

> Tip:
> If you see errors or warnings, check your export views and make sure all fields were included.

---

## Features Overview

### Core Functionality
[⬆️ Back to Top](#top)

- Advanced Calculations
    - Weighted scoring for both pitchers and batters, fully customizable
    - Current vs. potential talent projections
    - Comprehensive total value scores for comparison

- Scouting Details
    - Injury proneness (Durability/Prone)
    - Scout accuracy confidence
    - Player handedness (throw/bat)
    - Pitcher velocity, repertoire count, ground/fly ball ratio

### User Interface Features
[⬆️ Back to Top](#top)

- Filtering & Navigation
    - Easy position-based filters (SP, RP, all batting roles)
    - Infield/Outfield group toggles for mass selection
    - Double-click player names to open their Stats+ league page (configurable via config file)

- Smart Search
    - Filter by team (`ATL` etc.), position, and age (e.g., `<30`, `>25`)
    - Chain filters (e.g., `ATL 2B <30`)

- Intelligent Highlighting
    - Flags RPs with 3+ pitches and stamina ≥50 as SP candidates
    - 1B who qualify at 3B: Range ≥50, Arm ≥55, Error ≥45
    - 2B meeting criteria for SS training: Range ≥60, Arm ≥50, Error ≥50, DP ≥50
    - Tooltips explain all highlight rules

### Reporting and Analysis Tools
[⬆️ Back to Top](#top)

- Quick Reports
    - Top 10 batters at each position
    - Top 20 pitchers (per SP/RP)
    - Batters with ≥50 at secondary positions can be included with one click
    - All data columns sortable ascending/descending

- Team Evaluations
    - See each team's SP/RP current & potential scores, combined pitching, offense, defense, and total rating

### Dataset Overview
[⬆️ Back to Top](#top)

- At-a-Glance Stats
    - Total and breakdown counts by role and position
    - Average scores for SP, RP, and batters
    - Visual display of positional talent spread

### User Assistance
[⬆️ Back to Top](#top)

- Hover tooltips for every calculated metric
- Click **Reload Data** to refresh at any time
- Inline help and error warnings if data is missing

---

## Calculation Flowcharts
[⬆️ Back to Top](#top)

<details>
<summary><strong>Pitcher Score Calculation Flowchart</strong></summary>

![Pitcher Score Calculation Flowchart](pitcherflowchart.png)

</details>

<details>
<summary><strong>Batter Score Calculation Flowchart</strong></summary>

![Batter Score Calculation Flowchart](batterflowchart.png)

</details>

<details>
<summary><strong>Team Score Calculation Flowchart</strong></summary>

![Team Score Calculation Flowchart](teamsflowchart.png)

</details>

---

> For issues, guidance, or detailed explanations, explore the program's tooltips or consult the full documentation.

Thank you for using Hector!
