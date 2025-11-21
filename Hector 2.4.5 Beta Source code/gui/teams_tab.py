import tkinter as tk
from tkinter import ttk
from .style import on_treeview_motion, on_leave, sort_treeview
from .tooltips import attach_treeview_heading_tooltips, TEAMS_COL_TOOLTIPS

def add_teams_tab(notebook, font):
    teams_frame = ttk.Frame(notebook)
    notebook.add(teams_frame, text="Teams")

    vsb = ttk.Scrollbar(teams_frame, orient="vertical")
    vsb.pack(side="right", fill="y")

    hsb = ttk.Scrollbar(teams_frame, orient="horizontal")
    hsb.pack(side="bottom", fill="x")

    cols = (
        "Team", "Avg Age",
        "SP Curr. Score", "RP Curr. Score", "Team Pitching Curr. Score",
        "SP Pot. Score", "RP Pot. Score", "Team Pitching Pot. Score",
        "Batters Offense Curr.", "Batters Offense Pot.", "Team Defense", "Total Team Score"
    )

    table = ttk.Treeview(
        teams_frame,
        columns=cols,
        show="headings",
        yscrollcommand=vsb.set,
        xscrollcommand=hsb.set
    )

    table.pack(side="left", fill="both", expand=True, padx=10, pady=10)
    vsb.config(command=table.yview)
    hsb.config(command=table.xview)

    column_widths = {
        "Team": 25,
        "Avg Age": 20,
        "SP Curr. Score": 80,
        "RP Curr. Score": 80,
        "Team Pitching Curr. Score": 108,
        "SP Pot. Score": 80,
        "RP Pot. Score": 80,
        "Team Pitching Pot. Score": 110,
        "Batters Offense Curr.": 91,
        "Batters Offense Pot.": 100,
        "Team Defense": 80,
        "Total Team Score": 120,
    }

    for col in cols:
        table.heading(col, text=col, command=lambda c=col: sort_treeview(table, c, False))
        table.column(
            col,
            width=column_widths.get(col, 80),
            minwidth=34,
            anchor="center",
            stretch=True
        )

    table.tag_configure("hover", background="#333")
    table._prev_hover = None
    table.bind("<Motion>", on_treeview_motion)
    table.bind("<Leave>", on_leave)

    class TeamsTab:
        def refresh(self, pitchers, batters):
            table.delete(*table.get_children())
            
            team_scores = {}
            team_ages = {}
            
            # Pitchers
            for p in pitchers:
                team = p.get("ORG", "Unknown")
                pos = p.get("POS", "")
                curr_score = p["Scores"].get("curr_total", 0)
                pot_score = p["Scores"].get("core_potential", 0) + p["Scores"].get("pitches_potential", 0)
                age = p.get("Age")
                
                if team not in team_scores:
                    team_scores[team] = {
                        "SP_curr": 0, "RP_curr": 0, "SP_pot": 0, "RP_pot": 0,
                        "Batters_Offense_Curr": 0, "Batters_Offense_Pot": 0, "Team_Defense": 0,
                    }
                    team_ages[team] = []
                
                if age:
                    try:
                        team_ages[team].append(float(age))
                    except:
                        pass
                
                if pos == "SP":
                    team_scores[team]["SP_curr"] += curr_score
                    team_scores[team]["SP_pot"] += pot_score
                elif pos in ("RP", "CL"):
                    team_scores[team]["RP_curr"] += curr_score
                    team_scores[team]["RP_pot"] += pot_score
            
            # Batters
            for b in batters:
                team = b.get("ORG", "Unknown")
                offense = b["Scores"].get("offense", 0)
                offense_pot = b["Scores"].get("offense_potential", 0)
                defense = b["Scores"].get("defense", 0)
                age = b.get("Age")
                
                if team not in team_scores:
                    team_scores[team] = {
                        "SP_curr": 0, "RP_curr": 0, "SP_pot": 0, "RP_pot": 0,
                        "Batters_Offense_Curr": 0, "Batters_Offense_Pot": 0, "Team_Defense": 0,
                    }
                    team_ages[team] = []
                
                if age:
                    try:
                        team_ages[team].append(float(age))
                    except:
                        pass
                
                team_scores[team]["Batters_Offense_Curr"] += offense
                team_scores[team]["Batters_Offense_Pot"] += offense_pot
                team_scores[team]["Team_Defense"] += defense
            
            # Now insert rows
            sorted_teams = sorted(
                team_scores.items(),
                key=lambda item: (
                    round(item[1]["SP_curr"] + item[1]["RP_curr"] +
                          item[1]["Batters_Offense_Curr"] + item[1]["Team_Defense"], 2)
                ),
                reverse=True,
            )
            
            for team, scores in sorted_teams:
                sp_curr = round(scores["SP_curr"], 2)
                rp_curr = round(scores["RP_curr"], 2)
                pitching_curr = round(sp_curr + rp_curr, 2)
                
                sp_pot = round(scores["SP_pot"], 2)
                rp_pot = round(scores["RP_pot"], 2)
                pitching_pot = round(sp_pot + rp_pot, 2)
                
                bat_off_curr = round(scores["Batters_Offense_Curr"], 2)
                bat_off_pot = round(scores["Batters_Offense_Pot"], 2)
                team_def = round(scores["Team_Defense"], 2)
                total_team = round(pitching_curr + bat_off_curr + team_def, 2)
                
                ages = team_ages.get(team, [])
                avg_age = round(sum(ages) / len(ages), 2) if ages else "N/A"
                
                table.insert(
                    "", "end",
                    values=(
                        team, avg_age,
                        sp_curr, rp_curr, pitching_curr,
                        sp_pot, rp_pot, pitching_pot,
                        bat_off_curr, bat_off_pot, team_def, total_team
                    )
                )
            
            attach_treeview_heading_tooltips(table, TEAMS_COL_TOOLTIPS)

    return TeamsTab()
