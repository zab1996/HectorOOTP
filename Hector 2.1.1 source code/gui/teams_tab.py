from tkinter import ttk
from .style import on_treeview_motion, on_leave, sort_treeview

def add_teams_tab(notebook, font):
    teams_frame = ttk.Frame(notebook)
    notebook.add(teams_frame, text="Teams")

    vsb = ttk.Scrollbar(teams_frame, orient="vertical")
    vsb.pack(side="right", fill="y")

    hsb = ttk.Scrollbar(teams_frame, orient="horizontal")
    hsb.pack(side="bottom", fill="x")

    cols = ("Team", "Avg Age", "SP Total", "RP Total", "Team Pitching Total", "Batters Total", "Total Team Score")
    table = ttk.Treeview(teams_frame, columns=cols, show="headings",
                         yscrollcommand=vsb.set, xscrollcommand=hsb.set)
    table.pack(side="left", fill="both", expand=True, padx=10, pady=10)

    vsb.config(command=table.yview)
    hsb.config(command=table.xview)

    for col in cols:
        table.heading(col, text=col, command=lambda c=col: sort_treeview(table, c, False))
        table.column(col, width=130, anchor="center")

    table.tag_configure("hover", background="#333")
    table._prev_hover = None
    table.bind("<Motion>", on_treeview_motion)
    table.bind("<Leave>", on_leave)

    class TeamsTab:
        def refresh(self, pitchers, batters):
            table.delete(*table.get_children())
            team_scores = {}
            team_ages = {}

            for p in pitchers:
                team = p.get("ORG", "Unknown")
                pos = p.get("POS", "")
                score = p["Scores"].get("total", 0)
                age = p.get("Age")
                if team not in team_scores:
                    team_scores[team] = {"SP": 0, "RP": 0, "Batters": 0}
                    team_ages[team] = []
                if age:
                    try:
                        team_ages[team].append(float(age))
                    except:
                        pass
                if pos == "SP":
                    team_scores[team]["SP"] += score
                elif pos in ("RP", "CL"):
                    team_scores[team]["RP"] += score

            for b in batters:
                team = b.get("ORG", "Unknown")
                score = b["Scores"].get("offense", 0) + b["Scores"].get("defense", 0)
                age = b.get("Age")
                if team not in team_scores:
                    team_scores[team] = {"SP": 0, "RP": 0, "Batters": 0}
                    team_ages[team] = []
                if age:
                    try:
                        team_ages[team].append(float(age))
                    except:
                        pass
                team_scores[team]["Batters"] += score

            # Sort teams by total team score descending
            sorted_teams = sorted(
                team_scores.items(),
                key=lambda item: round(item[1]["SP"] + item[1]["RP"] + item[1]["Batters"], 2),
                reverse=True
            )

            for team, scores in sorted_teams:
                sp = round(scores["SP"], 2)
                rp = round(scores["RP"], 2)
                team_pitching = round(sp + rp, 2)
                batters_total = round(scores["Batters"], 2)
                total_team = round(team_pitching + batters_total, 2)
                ages = team_ages.get(team, [])
                avg_age = round(sum(ages) / len(ages), 2) if ages else "N/A"
                table.insert("", "end", values=(team, avg_age, sp, rp, team_pitching, batters_total, total_team))

    return TeamsTab()
