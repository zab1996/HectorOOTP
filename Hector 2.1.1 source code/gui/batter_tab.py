import tkinter as tk
from tkinter import ttk
import webbrowser
import re

from .style import on_treeview_motion, on_leave, sort_treeview
from .widgets import add_clear_button
from .tooltips import add_search_tooltip


def add_batter_tab(notebook, font):
    batter_frame = ttk.Frame(notebook)
    notebook.add(batter_frame, text="Batters")

    filter_frame = ttk.LabelFrame(batter_frame, text="Filter by Position")
    filter_frame.pack(side="left", fill="y", padx=5, pady=5)
    batter_positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]
    pos_vars = {pos: tk.BooleanVar(value=True) for pos in batter_positions}
    search_var = tk.StringVar()

    def set_all(val):
        for v in pos_vars.values(): v.set(val)
        update()

    for pos in batter_positions:
        ttk.Checkbutton(filter_frame, text=pos, variable=pos_vars[pos], command=lambda: update()).pack(anchor="w")

    ttk.Button(filter_frame, text="Select All", command=lambda: set_all(True)).pack(fill="x", pady=2)
    ttk.Button(filter_frame, text="Clear All", command=lambda: set_all(False)).pack(fill="x", pady=2)


    controls = tk.Frame(batter_frame, bg="#1e1e1e")
    controls.pack(fill="x", padx=5, pady=5)
    tk.Label(controls, text="Search Player:", bg="#1e1e1e", fg="#d4d4d4").pack(side="left")
    search_entry = ttk.Entry(controls, textvariable=search_var, width=30)
    search_entry.pack(side="left", padx=(0,2))
    add_clear_button(search_entry, search_var)
    add_search_tooltip(search_entry, tab_type="batter")

    table_frame = ttk.Frame(batter_frame)
    table_frame.pack(side="right", fill="both", expand=True)

    vsb = ttk.Scrollbar(table_frame, orient="vertical")
    vsb.pack(side="right", fill="y")

    hsb = ttk.Scrollbar(table_frame, orient="horizontal")
    hsb.pack(side="bottom", fill="x")

    cols = (
    "Name", "Team", "Age", "POS", "Batting Hand", "Prone", "Scout Accuracy", "OVR Stars", "POT Stars",
    "Offense", "Offense Pot.", "Defense", "Total Score"
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

    CURRENT_BATTERS = []

    def update():
        table.delete(*table.get_children())
        id_map.clear()

        # Gather allowed positions from checkbuttons (case-sensitive)
        allowed_positions = [pos for pos, var in pos_vars.items() if var.get()]
        raw_terms = search_var.get().strip().split()

        text_search_terms = []
        age_filters = []

        comp_re = re.compile(r'^(>=|<=|>|<|=)?(\d+)$')

        # Separate numeric age filters and text search terms
        for term in raw_terms:
            match = comp_re.match(term)
            if match:
                op = match.group(1) or '='
                num = int(match.group(2))
                age_filters.append((op, num))
            else:
                text_search_terms.append(term.lower())

        for b in add_batter_tab.CURRENT_BATTERS:
            player_id = b.get("ID", "")
            pos = b.get("POS", "")  # Keep original case (e.g., "1B", "SS")
            name = b.get("Name", "")
            team = b.get("ORG", "")
            age_raw = b.get("Age", "")
            age = int(age_raw) if age_raw.isdigit() else None

            # Filter by selected positions
            if pos not in allowed_positions:
                continue

            # Combine searchable fields in lowercase for text matching
            search_fields = f"{name} {team} {pos}".lower()

            # Text terms all must be present
            if not all(term in search_fields for term in text_search_terms):
                continue

            # If age filters exist but player has no age data, skip
            if age is None and age_filters:
                continue

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

            # Insert matched player into the table
            iid = table.insert("", "end", values=(
                name,
                team,
                age_raw,
                pos,
                b.get("B", ""),             # Batting Handedness (raw from parsed HTML, e.g. "L", "R", "S")
                b.get("Prone", ""),
                b.get("SctAcc", ""),
                b.get("OVR", "0 Stars"),
                b.get("POT", "0 Stars"),
                b["Scores"].get("offense", 0),
                b["Scores"].get("offense_potential", 0),
                b["Scores"].get("defense", 0),
                b["Scores"].get("total", 0)
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
    search_var.trace_add("write", lambda *_,**__: update())

    add_batter_tab.CURRENT_BATTERS = []

    class BatterTab:
        def refresh(self, batters):
            # Sort batters by descending total score before saving
            sorted_batters = sorted(batters, key=lambda b: b["Scores"].get("total", 0), reverse=True)
            add_batter_tab.CURRENT_BATTERS = sorted_batters
            update()



    return BatterTab()
