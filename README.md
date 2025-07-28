# Hector OOTP Player Analyzer 

Hector is a customizable OOTP (Out of the Park Baseball) program featuring a modern, dark-themed  GUI that analyzes player data from exported HTML files.

## Downloading the Latest Version

You can always grab the newest build of Hector from the **Releases** page:

➡️ [**Download the latest version here**](../../releases)

1. Download the ZIP for the latest release.  
2. Extract it to a folder of your choice.  
3. Run the executable (or use Python if running from source).
<details>
<summary><strong>🎬 Showcase: Click to view screenshots of Hector in action</strong></summary>

![Showcase1](screenshots/showcase1.png)
![Showcase2](screenshots/showcase2.png) 
![Showcase3](screenshots/showcase3.png) 
![Showcase4](screenshots/showcase4.png) 
![Showcase5](screenshots/showcase5.png) 
</details>


# Editing Player Weights

Hector’s scoring system is **fully customizable**.  

- Pitcher scoring weights are defined in `pitcher_weights.py`.  
- Batter scoring weights are defined in `batter_weights.py`.  

To adjust how different stats affect player scores:  
1. Open either `pitcher_weights.py` or `batter_weights.py` in a text editor(preferably Notepad++ or Visual Studio code).  
2. Modify the numeric values in the `section_weights` dictionary — higher values give more importance to that attribute.  
3. Save these files in the program folder where the `.exe` is located.  
4. Hit the Reload Data button in the program.

---

# Hector Data Export Instructions

To ensure Hector works correctly, you need to export player data from OOTP with custom views for Batters and Pitchers using the specified attributes. Follow these steps carefully:

### 1. Create the Batters View

Include all the attributes shown in the following screenshots exactly as displayed:

![Customize](screenshots/Customize.png)  
![General Batting](screenshots/generalbatting.png)  
![Batting Ratings](screenshots/battingratings.png)  
![Fielding Ratings](screenshots/fieldingratings.png)  
![Scouting Accuracy](screenshots/scoutingacc.png)  

### 2. Create the Pitchers View

Include all the attributes shown in these screenshots exactly as displayed:

![General Pitching](screenshots/generalpitching.png)  
![Pitcher Ratings](screenshots/pitcherratings.png)  
![Scouting Accuracy](screenshots/scoutingacc.png)  

### 3. Save Views as Global

- Save each view as **Global**.  
- Name them **“Hector Batting”** and **“Hector Pitching”** (you can replace "Hector" with any preferred name).

### 4. Export HTML Files
While you can have batters in the pitchers html and pitchers in the batters html it's generally better to make sure after setting your new view, to match the position to the file you're exporting.(Ex. POSITION All Batters when exporting the batters.html)
- Export the Batters view as `batters.html`  
- Export the Pitchers view as `pitchers.html`

![Export HTML DATA](screenshots/hectorexport.png)  
![Export HTML DATA](screenshots/hectorexport2.png)  
![Export HTML DATA](screenshots/hectorexport3.png)   

### 5. Replace Existing Files

- Replace the files inside the `Hector` folder with your new `batters.html` and `pitchers.html` files.

---

Make sure these steps are followed carefully to avoid missing fields or errors when running Hector.

If you encounter any warnings or issues, double-check your export views to ensure all required attributes are included.

---
# Features

## Modern Tkinter GUI
- Dark-themed interface with customized fonts and colors for readability.  
- Responsive tabbed layout with views for **Pitchers**, **Batters**, and **Teams**.
- Sidebar navigation: Position filters and report actions are now in a modern vertical sidebar with plain frames and clearly labeled section headers.
- Search bars with live filtering and integrated clear ("✕") buttons. Supports advanced syntax: `<`, `>`, `<=`, `>=`, `=` for age filtering like `1b <25` or `=20`.
- Position filters with multi-select checkboxes and quick "Select All" / "Clear All" options.
- Sortable tables with custom sort logic for special columns (e.g., velocity ranges, durability categories).  
- **Sortable “Show All” mode and grouped Top N modes for batters and pitchers, with live-updating filters by age, position, or search.**
- Sorting is disabled in Top N mode (for group/rank integrity), re-enabled in full-table mode.
- **Column widths have been optimized for important fields** (team names, ages, numeric stats) for improved readability out-of-the-box.
- Automatic sorting on startup by total score in pitchers, batters, and teams tabs.
- Double-click player rows to open detailed stats in an external web browser, with URLs configurable via a league config file (allowing compatibility with various Stats+ leagues).
- Manual "Reload Data" button to refresh HTML data and Pitcher/Batter weights without restarting the app.
- Added vertical and horizontal scrollbars to pitcher and batter tables for improved navigation, ensuring consistent dark theming.
- General visual and UI improvements, cleaner layouts, and consistent control spacing across all tabs.

## Table Tooltips & Guidance
- **Column header tooltips:** Every table column in all tabs (Batters, Pitchers, Teams) has a hover tooltip with clear, consistent explanations.
- **Stat explanation tooltips:** Special tooltips clarify the differences between *potential* and *current* ratings in team/player calculations.
- All Quick Report and Show All buttons now include centralized tooltips with explicit guidance for using text/age filters.

## Data Visualization & Highlighting
- **Automatic row highlights (classic/Show All mode only):**
  - Highlights RP (relief pitchers) with starter (SP) potential (STM ≥ 50 & ≥ 3 pitches).
  - Highlights 1B ready for 3B and 2B ready for SS, based on defensive stats.
- Highlighting is suppressed in grouped Top N by Position modes for clarity.

## Quick Reports & Top N Views
- Fast, live-updating “Top N by Position” leaderboards:
  - Batters: “Top 10 Batters by Position (Total Score)”
  - Pitchers: “Top 20 Pitchers by Position (Total Score)”
  - Results group the top N players by position (e.g., Top 10 2B, Top 20 SP) with separator rows and a **Rank** column.
  - Top N tables update instantly as you filter/search.
  - "Show All" button always restores the complete sortable list.
- Unified styling between “Filter by Position” and “Quick Reports”—no redundant headers or nested frames.
- **Top N tables feature wider columns for improved readability.**

## Data Loading, Scoring & Aggregation

### Pitchers
- Parses local `pitchers.html` files using BeautifulSoup to extract detailed stats.  
- Uses customizable `pitcher_weights.py` for fully adjustable attribute scoring.
- Calculates total pitching score by combining core skills (Stuff, Movement, Control), potential scores, individual pitch type scores, velocity, stamina, holds, ground/fly %, scout accuracy and more.
- **Pitching strength is now split into “Current” and “Potential” columns** for finer-grained team/league analysis.
- Penalties applied for starting pitchers with low pitch counts or stamina.
- Distinct counts and average total scores for SP and RP.

### Batters
- Parses local `batters.html` using BeautifulSoup for all supported OOTP exports.
- **Current offense, potential offense, and defensive scores now appear as distinct team stats**, not just summed.
- Calculates offense by position, defense by role (C, IF, OF), and weighted speed/stealing/running.
- **Separates current and potential batting offense**; both are scored for stronger player and team breakdowns.
- Star ratings (overall, potential) are extracted and shown.
- Combines offense and defense for a comprehensive total rating.

### Teams
- Enhanced calculations: Team stat and ranking computations are now strictly accurate and consistent.
- **Total Team Score uses only current pitching, current offense, and defense—reflecting actual team strength, not just projected growth.**
- Batter and pitcher contributions are computed in line with their metrics and weights.

## Usability, Architecture & Customization
- **Sidebar and report UI overhaul**: vertical layouts; clear labels using plain `ttk.Labels`, not LabelFrames.
- Reorganized code: improved lifecycle management, modularized tab/data loaders, and defined callbacks for reliability.
- **Fully customizable scoring weights**: Just edit `pitcher_weights.py` and `batter_weights.py` and reload for immediate effect.
- Improved error messages and tool organization.
- Editable double-click logic (player page URLs can be changed in the config file).
- Tooltips and improved documentation on all major functions and UI elements.
- Cleaner comments throughout for maintainers.
- **Visually cleaner layouts and unified spacing** across all tabs.

---

> For issues, guidance, or explanations, see the tooltips throughout the program or consult the updated documentation.


Thank you for using Hector!

