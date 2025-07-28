import tkinter as tk
from tkinter import ttk
import re

from .style import on_treeview_motion, on_leave, sort_treeview
from .widgets import add_clear_button, make_treeview_open_link_handler, load_player_url_template
from .tooltips import (
    add_search_tooltip, attach_treeview_heading_tooltips, BATTER_COL_TOOLTIPS,
    attach_treeview_row_tooltips, HIGHLIGHT_EXPLANATIONS, add_button_tooltip
)

player_url_template = load_player_url_template()

def add_batter_tab(notebook, font):
    batter_frame = ttk.Frame(notebook)
    notebook.add(batter_frame, text="Batters")

    filter_frame = ttk.Frame(batter_frame)
    filter_frame.pack(side="left", fill="y", padx=5, pady=5)
    # --- Filter section header
    filter_label = ttk.Label(
        filter_frame,
        text="Filter by Position",
        font=font,
        anchor="w"
    )
    filter_label.pack(fill="x", padx=0, pady=(2, 8))

    batter_positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]
    pos_vars = {pos: tk.BooleanVar(value=True) for pos in batter_positions}
    search_var = tk.StringVar()
    table_view_mode = {"mode": "all"}

    ALL_COLS = (
        "Name", "Team", "Age", "POS", "Bats", "Prone", "Scout Accuracy",
        "OVR Stars", "POT Stars", "Offense", "Offense Pot.", "Defense", "Total Score"
    )
    TOP10_COLS = (
        "Rank", "Name", "Team", "Age", "POS", "Bats", "Prone", "Scout Accuracy",
        "Offense", "Offense Pot.", "Defense", "Total Score"
    )
    column_widths_all = {
        "Rank": 38, "Name": 150, "Team": 55, "Age": 42, "POS": 46,
        "Bats": 54, "Prone": 65, "Scout Accuracy": 85, "OVR Stars": 63,
        "POT Stars": 65, "Offense": 78, "Offense Pot.": 98,
        "Defense": 72, "Total Score": 95,
    }
    column_widths_top = {
        "Rank": 110, "Name": 180, "Team": 100, "Age": 55, "POS": 70,
        "Bats": 65, "Prone": 80, "Scout Accuracy": 105, "Offense": 108,
        "Offense Pot.": 120, "Defense": 88, "Total Score": 120,
    }

    def on_filter_or_search_change():
        if table_view_mode["mode"] == "all":
            show_all_batters()
        else:
            show_top_10_batter_total_by_pos()

    def set_all(val):
        for v in pos_vars.values():
            v.set(val)
        on_filter_or_search_change()

    for pos in batter_positions:
        ttk.Checkbutton(
            filter_frame, text=pos, variable=pos_vars[pos], command=on_filter_or_search_change
        ).pack(anchor="w")
    ttk.Button(filter_frame, text="Select All", command=lambda: set_all(True)).pack(fill="x", pady=2)
    ttk.Button(filter_frame, text="Clear All", command=lambda: set_all(False)).pack(fill="x", pady=2)

    # --- Quick Reports section header
    report_label = ttk.Label(
        filter_frame,
        text="Quick Reports",
        font=font,
        anchor="w"
    )
    report_label.pack(fill="x", padx=0, pady=(16,2))

    top10_btn_frame = tk.Frame(filter_frame, bg="#1e1e1e")
    top10_btn_frame.pack(fill="x", pady=6, anchor="n")

    btn_top10 = ttk.Button(
        top10_btn_frame,
        text="Top 10 Batters by Position",
        command=lambda: show_top_10_batter_total_by_pos()
    )
    btn_top10.pack(fill="x", pady=2)
    add_button_tooltip(btn_top10, "top_batters_by_pos")

    btn_showall = ttk.Button(
        top10_btn_frame,
        text="Show All Batters",
        command=lambda: show_all_batters()
    )
    btn_showall.pack(fill="x", pady=2)
    add_button_tooltip(btn_showall, "show_all_batters")

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
    table = ttk.Treeview(table_frame, show="headings", yscrollcommand=vsb.set, xscrollcommand=hsb.set)
    table.pack(side="left", fill="both", expand=True)
    vsb.config(command=table.yview)
    hsb.config(command=table.xview)
    id_map = {}

    table.tag_configure("hover", background="#333")
    table.tag_configure("1b_to_3b", background="#384574")
    table.tag_configure("2b_to_ss", background="#384574")
    table.tag_configure("pos_sep", background="#384574", font=(font[0], font[1], "bold"))
    table._prev_hover = None
    table.bind("<Motion>", on_treeview_motion)
    table.bind("<Leave>", on_leave)
    attach_treeview_heading_tooltips(table, BATTER_COL_TOOLTIPS)
    attach_treeview_row_tooltips(table, HIGHLIGHT_EXPLANATIONS)
    CURRENT_BATTERS = []

    def get_batter_highlight_tags(b):
        tags = []
        if b.get("POS", "") == "1B":
            range_ = int(b.get("IF RNG", 0)) if str(b.get("IF RNG", "0")).isdigit() else 0
            arm   = int(b.get("IF ARM", 0)) if str(b.get("IF ARM", "0")).isdigit() else 0
            error = int(b.get("IF ERR", 0)) if str(b.get("IF ERR", "0")).isdigit() else 0
            if range_ >= 50 and arm >= 55 and error >= 45:
                tags.append("1b_to_3b")
        if b.get("POS", "") == "2B":
            range_ = int(b.get("IF RNG", 0)) if str(b.get("IF RNG", "0")).isdigit() else 0
            arm   = int(b.get("IF ARM", 0)) if str(b.get("IF ARM", "0")).isdigit() else 0
            error = int(b.get("IF ERR", 0)) if str(b.get("IF ERR", "0")).isdigit() else 0
            dp    = int(b.get("TDP", 0))     if str(b.get("TDP", "0")).isdigit() else 0
            if range_ >= 60 and arm >= 50 and error >= 50 and dp >= 50:
                tags.append("2b_to_ss")
        return tags

    def get_filtered_batters():
        allowed_positions = [pos for pos, var in pos_vars.items() if var.get()]
        raw_terms = search_var.get().strip().split()
        text_search_terms = []
        age_filters = []
        comp_re = re.compile(r'^([<>]=?|=)?(\d+)$')
        for term in raw_terms:
            match = comp_re.match(term)
            if match:
                op = match.group(1) or '='
                num = int(match.group(2))
                age_filters.append((op, num))
            else:
                text_search_terms.append(term.lower())
        filtered = []
        for b in add_batter_tab.CURRENT_BATTERS:
            pos = b.get("POS", "")
            name = b.get("Name", "")
            team = b.get("ORG", "")
            age_raw = b.get("Age", "")
            age = int(age_raw) if age_raw.isdigit() else None
            if pos not in allowed_positions:
                continue
            search_fields = f"{name} {team} {pos}".lower()
            if not all(term in search_fields for term in text_search_terms):
                continue
            if age is None and age_filters:
                continue
            age_filter_failed = False
            for op, num in age_filters:
                if op == '>':
                    if not (age > num): age_filter_failed = True; break
                elif op == '<':
                    if not (age < num): age_filter_failed = True; break
                elif op == '>=':
                    if not (age >= num): age_filter_failed = True; break
                elif op == '<=':
                    if not (age <= num): age_filter_failed = True; break
                elif op == '=':
                    if not (age == num): age_filter_failed = True; break
            if age_filter_failed:
                continue
            filtered.append(b)
        return filtered

    def set_table_columns(mode):
        if mode.startswith("top10"):
            width_lookup = column_widths_top
            cols = TOP10_COLS
        else:
            width_lookup = column_widths_all
            cols = ALL_COLS
        table["columns"] = cols
        for col in cols:
            if mode == "all":
                table.heading(col, text=col, command=lambda c=col: sort_treeview(table, c, False))
            else:
                table.heading(col, text=col)
            table.column(
                col,
                width=width_lookup.get(col, 80),
                minwidth=28,
                anchor="center",
                stretch=True
            )

    def update():
        mode = table_view_mode.get("mode", "all")
        set_table_columns(mode)
        if mode != "all":
            return
        table.delete(*table.get_children())
        id_map.clear()
        for b in get_filtered_batters():
            player_id = b.get("ID", "")
            pos = b.get("POS", "")
            age_raw = b.get("Age", "")
            row_tags = get_batter_highlight_tags(b)
            values = (
                b.get("Name", ""), b.get("ORG", ""), age_raw, pos, b.get("B", ""), b.get("Prone", ""),
                b.get("SctAcc", ""), b.get("OVR", "0 Stars"), b.get("POT", "0 Stars"),
                b["Scores"].get("offense", 0), b["Scores"].get("offense_potential", 0),
                b["Scores"].get("defense", 0), b["Scores"].get("total", 0)
            )
            iid = table.insert("", "end", values=values, tags=row_tags)
            id_map[iid] = player_id
        make_treeview_open_link_handler(table, id_map, lambda pid: player_url_template.format(pid=pid))

    def show_top_10_batter_total_by_pos():
        table_view_mode["mode"] = "top10_total_by_pos"
        set_table_columns("top10_total_by_pos")
        table.delete(*table.get_children())
        id_map.clear()
        by_pos = {}
        for b in get_filtered_batters():
            pos = b.get("POS", "")
            total = b["Scores"].get("total", 0)
            by_pos.setdefault(pos, []).append((total, b))
        for pos in sorted(by_pos):
            sep_text = f"— Top 10 {pos} —"
            table.insert("", "end", values=(sep_text,) + ("",)*(len(TOP10_COLS)-1), tags=("pos_sep",))
            top10 = sorted(by_pos[pos], key=lambda t: t[0], reverse=True)[:10]
            for rank, (score, b) in enumerate(top10, 1):
                row_tags = []  # No highlights in Top 10 view
                values = (
                    rank,
                    b.get("Name", ""), b.get("ORG", ""), b.get("Age", ""), b.get("POS", ""),
                    b.get("B", ""), b.get("Prone", ""), b.get("SctAcc", ""),
                    b["Scores"].get("offense", 0), b["Scores"].get("offense_potential", 0),
                    b["Scores"].get("defense", 0), b["Scores"].get("total", 0)
                )
                iid = table.insert("", "end", values=values, tags=row_tags)
                id_map[iid] = b.get("ID", "")
        make_treeview_open_link_handler(table, id_map, lambda pid: player_url_template.format(pid=pid))
        table.yview_moveto(0)

    def show_all_batters():
        table_view_mode["mode"] = "all"
        set_table_columns("all")
        update()

    search_var.trace_add("write", lambda *_, **__: on_filter_or_search_change())

    add_batter_tab.CURRENT_BATTERS = []
    class BatterTab:
        def refresh(self, batters):
            sorted_batters = sorted(batters, key=lambda b: b["Scores"].get("total", 0), reverse=True)
            add_batter_tab.CURRENT_BATTERS = sorted_batters
            show_all_batters()
    return BatterTab()
