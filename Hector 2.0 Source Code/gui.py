import tkinter as tk
from tkinter import ttk
import tkinter.messagebox as messagebox
import importlib
import webbrowser
import sys

from pitchers import load_pitchers_data
from batters import load_batters_data



# --- FULL FIELD LISTS ---
REQUIRED_PITCHER_FIELDS = [
    "ID","ORG","POS","Name","Age","B","T","OVR","POT","Prone",
    "STU","MOV","CON","STU P","MOV P","CON P","FB","FBP","CH","CHP",
    "CB","CBP","SL","SLP","SI","SIP","SP","SPP","CT","CTP","FO","FOP",
    "CC","CCP","SC","SCP","KC","KCP","KN","KNP","PIT","VELO","STM",
    "G/F","HLD","SctAcc"
]

REQUIRED_BATTER_FIELDS = [
    "ID","POS","Name","ORG","Age","B","Prone","OVR","POT","CON","GAP","POW","EYE","K's",
    "CON P","GAP P","POW P","EYE P","K P","C ABI","C FRM","C ARM","IF RNG","IF ERR",
    "IF ARM","TDP","OF RNG","OF ERR","OF ARM","SPE","STE","RUN","SctAcc"
]


def validate_fields(players, required_fields):
    missing_fields = set()
    for player in players:
        for field in required_fields:
            if field not in player or player[field] in [None, ""]:
                missing_fields.add(field)
    return missing_fields


def create_tooltip(widget, text):
    tooltip = tk.Toplevel(widget)
    tooltip.withdraw()
    tooltip.overrideredirect(True)
    tooltip.configure(bg="#333", padx=5, pady=3)
    label = tk.Label(tooltip, text=text, bg="#333", fg="#fff", font=("Consolas", 10), justify="left")
    label.pack()

    def enter(event):
        x = widget.winfo_rootx() + 20
        y = widget.winfo_rooty() + widget.winfo_height() + 5
        tooltip.geometry(f"+{x}+{y}")
        tooltip.deiconify()

    def leave(event):
        tooltip.withdraw()

    widget.bind("<Enter>", enter)
    widget.bind("<Leave>", leave)


def build_gui():
    root = tk.Tk()
    root.title("Hector 2.0 - Player Scores")
    root.geometry("1500x850")
    root.configure(bg="#1e1e1e")

    font = ("Consolas", 11)
    title = tk.Label(root, text="Hector 2.0 - Player Scores", font=("Consolas", 14, "bold"),
                     fg="#00ff7f", bg="#1e1e1e", anchor="w")
    title.pack(fill="x", padx=10, pady=5)

    # --- CONTROL BAR ---
    control_frame = tk.Frame(root, bg="#1e1e1e")
    control_frame.pack(fill="x", padx=10, pady=5)
    reload_btn = ttk.Button(control_frame, text="Reload Data")
    reload_btn.pack(side="left", padx=5)

    # --- NOTEBOOK ---
    notebook = ttk.Notebook(root)
    notebook.pack(fill="both", expand=True, padx=10, pady=10)

    style = ttk.Style()
    style.theme_use("default")
    style.configure("Treeview",
                    background="#1e1e1e",
                    foreground="#d4d4d4",
                    fieldbackground="#1e1e1e",
                    font=font)
    style.map("Treeview", background=[("selected", "#264f78")])

    # --- Hover highlight ---
    def on_treeview_motion(event):
        tree = event.widget
        rowid = tree.identify_row(event.y)
        if tree._prev_hover != rowid:
            if tree._prev_hover:
                tree.item(tree._prev_hover, tags=())
            if rowid:
                tree.item(rowid, tags=("hover",))
            tree._prev_hover = rowid

    def on_leave(event):
        tree = event.widget
        if tree._prev_hover:
            tree.item(tree._prev_hover, tags=())
            tree._prev_hover = None

    def sort_treeview(tree, col, reverse):
        data = [(tree.set(k, col), k) for k in tree.get_children("")]

        if col == "Prone":
            order = {
                "wrecked": 0,
                "fragile": 1,
                "normal": 2,
                "durable": 3,
                "iron man": 4,
                "ironman": 4,
            }
            def rank(value):
                return order.get(value.lower(), -1)
            data.sort(key=lambda t: rank(t[0]), reverse=reverse)

        elif col == "Velo":
            def velo_value(val):
                val = val.strip()
                if val.endswith("+"):
                    try:
                        return float(val[:-1]) + 1.1  
                    except:
                        return -1
                elif "-" in val:
                    parts = val.split("-")
                    try:
                        return float(parts[-1])
                    except:
                        return -1
                else:
                    try:
                        return float(val)
                    except:
                        return -1
            data.sort(key=lambda t: velo_value(t[0]), reverse=reverse)

        else:
            try:
                data.sort(key=lambda t: float(str(t[0]).replace("-", "0").replace("Stars", "").strip()), reverse=reverse)
            except ValueError:
                data.sort(key=lambda t: str(t[0]).lower(), reverse=reverse)

        for index, (val, k) in enumerate(data):
            tree.move(k, "", index)
        arrow = " ▲" if not reverse else " ▼"
        for c in tree["columns"]:
            tree.heading(c, text=c)
        tree.heading(col, text=col + arrow, command=lambda: sort_treeview(tree, col, not reverse))

    # --- Helper for integrated clear button ---
    def add_clear_button(entry, variable):
        clear_btn = tk.Label(entry.master, text="✕", fg="#aaa", bg="#1e1e1e", cursor="hand2")
        clear_btn.place_forget()
        def show_hide(*args):
            if variable.get():
                x = entry.winfo_x() + entry.winfo_width() - 18
                y = entry.winfo_y() + 2
                clear_btn.place(x=x, y=y)
            else:
                clear_btn.place_forget()
        def clear_text(event=None):
            variable.set("")
        clear_btn.bind("<Button-1>", clear_text)
        variable.trace_add("write", show_hide)
        return clear_btn

    # ---- Pitchers tab ----
    pitcher_frame = ttk.Frame(notebook)
    notebook.add(pitcher_frame, text="Pitchers")

    filter_frame = ttk.LabelFrame(pitcher_frame, text="Filter by Position")
    filter_frame.pack(side="left", fill="y", padx=5, pady=5)

    pitcher_positions = ["SP", "RP"]
    pos_vars_pitcher = {pos: tk.BooleanVar(value=True) for pos in pitcher_positions}

    def set_all_pitcher_filters(value):
        for var in pos_vars_pitcher.values():
            var.set(value)
        apply_pitcher_filter(pitcher_search_var.get())

    for pos in pitcher_positions:
        cb = ttk.Checkbutton(filter_frame, text=pos, variable=pos_vars_pitcher[pos],
                             command=lambda: apply_pitcher_filter(pitcher_search_var.get()))
        cb.pack(anchor="w")
    tk.Button(filter_frame, text="Select All", command=lambda: set_all_pitcher_filters(True)).pack(fill="x", pady=2)
    tk.Button(filter_frame, text="Clear All", command=lambda: set_all_pitcher_filters(False)).pack(fill="x", pady=2)

    pitcher_controls_frame = tk.Frame(pitcher_frame, bg="#1e1e1e")
    pitcher_controls_frame.pack(fill="x", padx=5, pady=5)

    pitcher_search_var = tk.StringVar()
    tk.Label(pitcher_controls_frame, text="Search Player:", bg="#1e1e1e", fg="#d4d4d4").pack(side="left")
    pitcher_search_entry = ttk.Entry(pitcher_controls_frame, textvariable=pitcher_search_var, width=30)
    pitcher_search_entry.pack(side="left", padx=(0, 2))
    add_clear_button(pitcher_search_entry, pitcher_search_var)
    create_tooltip(pitcher_search_entry, "Search tips:\n- Filter by team: CAS, ATL\n- Filter by position: SP, RP")
##\n- Filter by age: >25, <=30, =27
    table_frame = ttk.Frame(pitcher_frame)
    table_frame.pack(side="right", fill="both", expand=True)
    pitcher_columns = (
        "Name", "Team", "Age", "POS", "Prone", "Velo", "#Pitches", "G/F",
        "Pitch Score", "Pitch Pot. Score", "Total Score"
    )
    pitcher_table = ttk.Treeview(table_frame, columns=pitcher_columns, show="headings")
    pitcher_table.pack(fill="both", expand=True)
    for col in pitcher_columns:
        pitcher_table.heading(col, text=col, command=lambda c=col: sort_treeview(pitcher_table, c, False))
        pitcher_table.column(col, width=120 if col == "Name" else 80, anchor="center")

    pitcher_table.tag_configure("hover", background="#333")
    pitcher_table._prev_hover = None
    pitcher_table.bind("<Motion>", on_treeview_motion)
    pitcher_table.bind("<Leave>", on_leave)

    pitcher_id_map = {}

    def apply_pitcher_filter(search_text=""):
        pitcher_table.delete(*pitcher_table.get_children())
        pitcher_id_map.clear()
        allowed_positions = [pos for pos, var in pos_vars_pitcher.items() if var.get()]
        search_terms = [term.lower() for term in search_text.strip().split() if term]

        for p in pitchers:
            player_id = p.get("ID", "")
            pos = "RP" if p.get("POS") == "CL" else p.get("POS")
            name = p.get("Name", "")
            team = p.get("ORG", "")
            age = p.get("Age", "")
            prone_value = p.get("Prone", "")
            search_fields = f"{name} {team} {pos}".lower()

            if pos in allowed_positions and all(term in search_fields for term in search_terms):
                iid = pitcher_table.insert("", "end", values=(
                    name,
                    team,
                    age,
                    pos,
                    prone_value,
                    p.get("VELO", ""),
                    p.get("PIT", ""),
                    p.get("G/F", ""),
                    p["Scores"].get("pitches", 0),
                    p["Scores"].get("pitches_potential", 0),
                    p["Scores"].get("total", 0),
                ))
                pitcher_id_map[iid] = player_id

    def on_pitcher_double_click(event):
        region = pitcher_table.identify_region(event.x, event.y)
        if region == "heading":
            return  # Ignore double-clicks on headers

        item_id = pitcher_table.focus()
        if not item_id:
            return
        player_id = pitcher_id_map.get(item_id)
        if player_id:
            url = f"https://atl-01.statsplus.net/rfbl/player/{player_id}?page=dash"
            webbrowser.open(url)

    pitcher_table.bind("<Double-1>", on_pitcher_double_click)
    pitcher_search_var.trace_add("write", lambda *args: apply_pitcher_filter(pitcher_search_var.get()))

    # ---- Batters tab ----
    batter_frame = ttk.Frame(notebook)
    notebook.add(batter_frame, text="Batters")

    batter_filter_frame = ttk.LabelFrame(batter_frame, text="Filter by Position")
    batter_filter_frame.pack(side="left", fill="y", padx=5, pady=5)

    batter_positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]
    pos_vars_batter = {pos: tk.BooleanVar(value=True) for pos in batter_positions}

    def set_all_batter_filters(value):
        for var in pos_vars_batter.values():
            var.set(value)
        apply_batter_filter(batter_search_var.get())

    for pos in batter_positions:
        cb = ttk.Checkbutton(batter_filter_frame, text=pos, variable=pos_vars_batter[pos],
                             command=lambda: apply_batter_filter(batter_search_var.get()))
        cb.pack(anchor="w")
    tk.Button(batter_filter_frame, text="Select All", command=lambda: set_all_batter_filters(True)).pack(fill="x", pady=2)
    tk.Button(batter_filter_frame, text="Clear All", command=lambda: set_all_batter_filters(False)).pack(fill="x", pady=2)

    batter_controls_frame = tk.Frame(batter_frame, bg="#1e1e1e")
    batter_controls_frame.pack(fill="x", padx=5, pady=5)

    batter_search_var = tk.StringVar()
    tk.Label(batter_controls_frame, text="Search Player:", bg="#1e1e1e", fg="#d4d4d4").pack(side="left")
    batter_search_entry = ttk.Entry(batter_controls_frame, textvariable=batter_search_var, width=30)
    batter_search_entry.pack(side="left", padx=(0, 2))
    add_clear_button(batter_search_entry, batter_search_var)
    create_tooltip(batter_search_entry, "Search tips:\n- Filter by team: CAS, ATL\n- Filter by position: 2B, SS, LF")
##\n- Filter by age: >25, <=30, =27
    batter_table_frame = ttk.Frame(batter_frame)
    batter_table_frame.pack(side="right", fill="both", expand=True)
    batter_columns = (
        "Name", "Team", "Age", "POS", "Prone", "OVR Stars", "POT Stars",
        "Offense", "Offense Pot.", "Defense", "Total"
    )

    batter_table = ttk.Treeview(batter_table_frame, columns=batter_columns, show="headings")
    batter_table.pack(fill="both", expand=True)
    for col in batter_columns:
        batter_table.heading(col, text=col, command=lambda c=col: sort_treeview(batter_table, c, False))
        batter_table.column(col, width=120 if col == "Name" else 80, anchor="center")

    batter_table.tag_configure("hover", background="#333")
    batter_table._prev_hover = None
    batter_table.bind("<Motion>", on_treeview_motion)
    batter_table.bind("<Leave>", on_leave)

    batter_id_map = {}

    def apply_batter_filter(search_text=""):
        batter_table.delete(*batter_table.get_children())
        batter_id_map.clear()
        allowed_positions = [pos for pos, var in pos_vars_batter.items() if var.get()]
        search_terms = [term.lower() for term in search_text.strip().split() if term]

        for b in batters:
            player_id = b.get("ID", "")
            pos = b.get("POS", "")
            name = b.get("Name", "")
            team = b.get("ORG", "")
            age = b.get("Age", "")
            prone_value = b.get("Prone", "")
            search_fields = f"{name} {team} {pos}".lower()

            if pos in allowed_positions and all(term in search_fields for term in search_terms):
                iid = batter_table.insert("", "end", values=(
                    name,
                    team,
                    age,
                    pos,
                    prone_value,
                    b["Scores"].get("overall_stars", 0),
                    b["Scores"].get("potential_stars", 0),
                    b["Scores"].get("offense", 0),
                    b["Scores"].get("offense_potential", 0),
                    b["Scores"].get("defense", 0),
                    b["Scores"].get("total", 0),
                ))
                batter_id_map[iid] = player_id


    def on_batter_double_click(event):
        region = batter_table.identify_region(event.x, event.y)
        if region == "heading":
            return  # Ignore double-clicks on headers

        item_id = batter_table.focus()
        if not item_id:
            return
        player_id = batter_id_map.get(item_id)
        if player_id:
            url = f"https://atl-01.statsplus.net/rfbl/player/{player_id}?page=dash"
            webbrowser.open(url)

    batter_table.bind("<Double-1>", on_batter_double_click)
    batter_search_var.trace_add("write", lambda *args: apply_batter_filter(batter_search_var.get()))

    # ---- Teams tab ----
    teams_frame = ttk.Frame(notebook)
    notebook.add(teams_frame, text="Teams")

    teams_columns = ("Team", "Avg Age", "SP Total", "RP Total", "Team Pitching Total", "Batters Total", "Total Team Score")
    teams_table = ttk.Treeview(teams_frame, columns=teams_columns, show="headings")
    teams_table.pack(fill="both", expand=True, padx=10, pady=10)

    for col in teams_columns:
        teams_table.heading(col, text=col, command=lambda c=col: sort_treeview(teams_table, c, False))
        teams_table.column(col, width=130, anchor="center")

    teams_table.tag_configure("hover", background="#333")
    teams_table._prev_hover = None
    teams_table.bind("<Motion>", on_treeview_motion)
    teams_table.bind("<Leave>", on_leave)

    # --- Data and reload ---
    pitchers = []
    batters = []

    def load_data():
        nonlocal pitchers, batters
        pitchers = load_pitchers_data()
        batters = load_batters_data()

        # Validate required fields
        missing_pitcher_fields = validate_fields(pitchers, REQUIRED_PITCHER_FIELDS)
        missing_batter_fields = validate_fields(batters, REQUIRED_BATTER_FIELDS)

        if missing_pitcher_fields or missing_batter_fields:
            error_message = "Your OOTP export is missing fields:\n\n"
            if missing_pitcher_fields:
                error_message += "Pitchers are missing:\n- " + "\n- ".join(sorted(missing_pitcher_fields)) + "\n\n"
            if missing_batter_fields:
                error_message += "Batters are missing:\n- " + "\n- ".join(sorted(missing_batter_fields)) + "\n\n"
            error_message += "Please update your OOTP export to include these fields."
            messagebox.showerror("Missing Fields", error_message)
            root.destroy()
            sys.exit(1)  # exit program

    def update_teams_tab():
        teams_table.delete(*teams_table.get_children())

        team_scores = {}
        team_ages = {}  # key: team, value: list of ages

        # Aggregate pitcher scores and ages by team and role
        for p in pitchers:
            team = p.get("ORG", "Unknown")
            pos = p.get("POS", "")
            total_score = p["Scores"].get("total", 0)
            age = p.get("Age")

            if team not in team_scores:
                team_scores[team] = {"SP": 0, "RP": 0, "Batters": 0}
                team_ages[team] = []

            if age is not None:
                try:
                    team_ages[team].append(float(age))
                except ValueError:
                    pass

            if pos == "SP":
                team_scores[team]["SP"] += total_score
            elif pos in ("RP", "CL"):
                team_scores[team]["RP"] += total_score

        # Aggregate batter scores and ages by team
        for b in batters:
            team = b.get("ORG", "Unknown")
            total_score = b["Scores"].get("offense", 0) + b["Scores"].get("defense", 0)
            age = b.get("Age")

            if team not in team_scores:
                team_scores[team] = {"SP": 0, "RP": 0, "Batters": 0}
                team_ages[team] = []

            if age is not None:
                try:
                    team_ages[team].append(float(age))
                except ValueError:
                    pass

            team_scores[team]["Batters"] += total_score

        for team in sorted(team_scores.keys()):
            sp_total = round(team_scores[team]["SP"], 2)
            rp_total = round(team_scores[team]["RP"], 2)
            team_pitching_total = round(sp_total + rp_total, 2)
            batters_total = round(team_scores[team]["Batters"], 2)
            total_team_score = round(team_pitching_total + batters_total, 2)

            # Calculate average age
            ages = team_ages.get(team, [])
            avg_age = round(sum(ages) / len(ages), 2) if ages else "N/A"

            teams_table.insert(
                "",
                "end",
                values=(team, avg_age, sp_total, rp_total, team_pitching_total, batters_total, total_team_score)
            )

    def reload_and_refresh():
        load_data()
        apply_pitcher_filter(pitcher_search_var.get())
        apply_batter_filter(batter_search_var.get())
        update_teams_tab()

    reload_btn.config(command=reload_and_refresh)

    


    # Initial load
    load_data()
    apply_pitcher_filter("")
    apply_batter_filter("")
    update_teams_tab()

    root.mainloop()

if __name__ == "__main__":
    build_gui()
