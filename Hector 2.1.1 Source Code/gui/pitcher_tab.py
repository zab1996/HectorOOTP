import tkinter as tk
from tkinter import ttk
import webbrowser
import re

from .style import on_treeview_motion, on_leave, sort_treeview
from .widgets import add_clear_button
from .tooltips import add_search_tooltip

def add_pitcher_tab(notebook, font):
    pitcher_frame = ttk.Frame(notebook)
    notebook.add(pitcher_frame, text="Pitchers")

    filter_frame = ttk.LabelFrame(pitcher_frame, text="Filter by Position")
    filter_frame.pack(side="left", fill="y", padx=5, pady=5)
    pitcher_positions = ["SP", "RP"]
    pos_vars = {pos: tk.BooleanVar(value=True) for pos in pitcher_positions}
    search_var = tk.StringVar()

    def set_all(val):
        for v in pos_vars.values(): v.set(val)
        update()

    for pos in pitcher_positions:
        ttk.Checkbutton(filter_frame, text=pos, variable=pos_vars[pos], command=lambda: update()).pack(anchor="w")

    ttk.Button(filter_frame, text="Select All", command=lambda: set_all(True)).pack(fill="x", pady=2)
    ttk.Button(filter_frame, text="Clear All", command=lambda: set_all(False)).pack(fill="x", pady=2)

    controls = tk.Frame(pitcher_frame, bg="#1e1e1e")
    controls.pack(fill="x", padx=5, pady=5)
    tk.Label(controls, text="Search Player:", bg="#1e1e1e", fg="#d4d4d4").pack(side="left")
    search_entry = ttk.Entry(controls, textvariable=search_var, width=30)
    search_entry.pack(side="left", padx=(0,2))
    add_clear_button(search_entry, search_var)
    add_search_tooltip(search_entry, tab_type="pitcher")

    table_frame = ttk.Frame(pitcher_frame)
    table_frame.pack(side="right", fill="both", expand=True)

    # Vertical scrollbar
    vsb = ttk.Scrollbar(table_frame, orient="vertical")
    vsb.pack(side="right", fill="y")
    # Horizontal scrollbar
    hsb = ttk.Scrollbar(table_frame, orient="horizontal")
    hsb.pack(side="bottom", fill="x")

    cols = (
    "Name", "Team", "Age", "POS", "Prone", "Scout Accuracy", "Throws", "Velo", "#Pitches", "G/F",
    "Pitch Score", "Pitch Pot. Score", "Total Score"
    )


    table = ttk.Treeview(table_frame, columns=cols, show="headings",
                         yscrollcommand=vsb.set, xscrollcommand=hsb.set)
    table.pack(side="left", fill="both", expand=True)

    vsb.config(command=table.yview)
    hsb.config(command=table.xview)

    for col in cols:
        table.heading(col, text=col, command=lambda c=col: sort_treeview(table, c, False))
        table.column(col, width=120 if col == "Name" else 80, anchor="center")

    table.tag_configure("hover", background="#333")
    table._prev_hover = None
    table.bind("<Motion>", on_treeview_motion)
    table.bind("<Leave>", on_leave)
    id_map = {}

    # Data storage for refresh
    CURRENT_PITCHERS = []

    def update():
        table.delete(*table.get_children())
        id_map.clear()

        allowed_positions = [p for p,v in pos_vars.items() if v.get()]
        raw_terms = search_var.get().strip().split()  # Raw search terms

        text_search_terms = []
        age_filters = []  # List of (operator, number), e.g. ('>', 25)

        comp_re = re.compile(r'^(>=|<=|>|<|=)?(\d+)$')

        # Separate numeric age filters from text filters
        for term in raw_terms:
            match = comp_re.match(term)
            if match:
                op = match.group(1) or '='
                num = int(match.group(2))
                age_filters.append((op, num))
            else:
                text_search_terms.append(term.lower())

        for p in add_pitcher_tab.CURRENT_PITCHERS:
            player_id = p.get("ID", "")
            pos = "RP" if p.get("POS") == "CL" else p.get("POS")
            name = p.get("Name", "")
            team = p.get("ORG", "")
            age_raw = p.get("Age", "")
            age = int(age_raw) if age_raw.isdigit() else None

            search_fields = f"{name} {team} {pos}".lower()

            if pos not in allowed_positions:
                continue

            if not all(term in search_fields for term in text_search_terms):
                continue

            if age is None and age_filters:
                continue  # No age data but age filters exist

            age_filter_failed = False
            for op, num in age_filters:
                if op == '>':
                    if not (age > num):
                        age_filter_failed = True
                        break
                elif op == '<':
                    if not (age < num):
                        age_filter_failed = True
                        break
                elif op == '>=':
                    if not (age >= num):
                        age_filter_failed = True
                        break
                elif op == '<=':
                    if not (age <= num):
                        age_filter_failed = True
                        break
                elif op == '=':
                    if not (age == num):
                        age_filter_failed = True
                        break

            if age_filter_failed:
                continue
            
            iid = table.insert("", "end", values=(
                name,                      # Name
                team,                      # Team
                age_raw,                   # Age
                pos,                       # POS
                p.get("Prone", ""),        # Prone
                p.get("SctAcc", ""),       # Scout Accuracy (raw field)
                p.get("T", ""),            # Throws (raw from data, e.g. "L" or "R")
                p.get("VELO", ""),         # Velocity
                p.get("PIT", ""),          # # Pitches
                p.get("G/F", ""),          # Ground/Fly ratio
                p["Scores"].get("pitches", 0),         # Pitch Score
                p["Scores"].get("pitches_potential", 0), # Pitch Potential Score
                p["Scores"].get("total", 0)               # Total Score
            ))

            id_map[iid] = player_id

    def on_double(event):
        region = table.identify_region(event.x, event.y)
        if region=="heading": return
        item_id = table.focus()
        pid = id_map.get(item_id)
        if pid:
            webbrowser.open(f"https://atl-01.statsplus.net/rfbl/player/{pid}?page=dash")

    table.bind("<Double-1>", on_double)

    search_var.trace_add("write", lambda *_, **__: update())

    add_pitcher_tab.CURRENT_PITCHERS = []

    class PitcherTab:
        def refresh(self, pitchers):
            # Sort pitchers by descending total score before saving
            sorted_pitchers = sorted(pitchers, key=lambda p: p["Scores"].get("total", 0), reverse=True)
            add_pitcher_tab.CURRENT_PITCHERS = sorted_pitchers
            update()


    return PitcherTab()
