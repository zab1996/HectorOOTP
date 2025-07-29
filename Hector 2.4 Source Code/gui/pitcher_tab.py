import tkinter as tk
from tkinter import ttk
from .style import on_treeview_motion, on_leave, sort_treeview
from .widgets import (
    add_clear_button,
    make_treeview_open_link_handler,
    load_player_url_template,
    filter_players,
    get_pitcher_highlight_tags,
    make_debounced_callback,
)
from .tooltips import (
    add_search_tooltip, attach_treeview_heading_tooltips, PITCHER_COL_TOOLTIPS,
    attach_treeview_row_tooltips, HIGHLIGHT_EXPLANATIONS, add_button_tooltip
)

player_url_template = load_player_url_template()

def add_pitcher_tab(notebook, font):
    pitcher_frame = ttk.Frame(notebook)
    notebook.add(pitcher_frame, text="Pitchers")

    filter_frame = tk.Frame(pitcher_frame, bg="#1e1e1e", highlightthickness=0, bd=0)
    filter_frame.pack(side="left", fill="y", padx=5, pady=5)

    filter_label = tk.Label(
        filter_frame,
        text="Filter by Position",
        font=font,
        anchor="w",
        bg="#1e1e1e",
        fg="#d4d4d4"
    )
    filter_label.pack(fill="x", padx=0, pady=(2, 8))

    pitcher_positions = ["SP", "RP"]
    pos_vars = {pos: tk.BooleanVar(value=True) for pos in pitcher_positions}
    search_var = tk.StringVar()
    table_view_mode = {"mode": "all"}

    # -- Horizontal position filters (no old add_position_filters) --
    def add_horizontal_position_filters(parent, positions, pos_vars, on_change):
        row = tk.Frame(parent, bg="#1e1e1e", highlightthickness=0, highlightbackground="#1e1e1e")
        row.pack(fill="x", pady=(0, 2))
        cbargs = dict(
            bg="#1e1e1e", fg="#d4d4d4", selectcolor="#1e1e1e",
            activebackground="#1e1e1e", activeforeground="#d4d4d4",
            highlightthickness=0,
            highlightbackground="#1e1e1e",
            highlightcolor="#1e1e1e",
            takefocus=0,
            bd=0
        )
        for pos in positions:
            tk.Checkbutton(row, text=pos, variable=pos_vars[pos], command=on_change, **cbargs).pack(side="left", padx=8)


    def on_filter_or_search_change():
        if table_view_mode["mode"] == "all":
            show_all_pitchers()
        else:
            show_top_20_pitcher_total_by_pos()

    add_horizontal_position_filters(filter_frame, pitcher_positions, pos_vars, on_filter_or_search_change)

    ALL_COLS = (
        "Name", "Team", "Age", "POS", "Prone", "Scout Accuracy", "Throws", "Velo", "#Pitches", "G/F",
        "Pitch Score", "Pitch Pot. Score", "Potential Score", "Current Score", "Total Score"
    )

    TOP20_COLS = (
        "Rank", "Name", "Team", "Age", "POS", "Throws", "Velo", "#Pitches", "G/F",
        "Pitch Score", "Pitch Pot. Score", "Potential Score", "Current Score", "Total Score"
    )

    column_widths_all = {
        "Rank": 38, "Name": 150, "Team": 55, "Age": 42, "POS": 46, "Prone": 65, "Scout Accuracy": 85,
        "Throws": 40, "Velo": 55, "#Pitches": 52, "G/F": 48, "Pitch Score": 78, "Pitch Pot. Score": 98,
        "Potential Score": 110, "Current Score": 110, "Total Score": 95,
    }

    column_widths_top = {
        "Rank": 130, "Name": 185, "Team": 110, "Age": 60, "POS": 80,
        "Throws": 68, "Velo": 80, "#Pitches": 74, "G/F": 66,
        "Pitch Score": 119, "Pitch Pot. Score": 130, "Potential Score": 132,
        "Current Score": 132, "Total Score": 130,
    }

    def set_all(val):
        for v in pos_vars.values():
            v.set(val)
        on_filter_or_search_change()

    ttk.Button(filter_frame, text="Select All", command=lambda: set_all(True)).pack(fill="x", pady=2)
    ttk.Button(filter_frame, text="Clear All", command=lambda: set_all(False)).pack(fill="x", pady=2)

    report_label = tk.Label(
        filter_frame,
        text="Quick Reports",
        font=font,
        anchor="w",
        bg="#1e1e1e",  # Explicit dark background
        fg="#d4d4d4"   # Light text color
    )
    report_label.pack(fill="x", padx=0, pady=(16,2))

    top20_btn_frame = tk.Frame(filter_frame, bg="#1e1e1e")
    top20_btn_frame.pack(fill="x", pady=6, anchor="n")

    # SHOW ALL PITCHERS FIRST
    btn_show_all = ttk.Button(
        top20_btn_frame,
        text="Show All Pitchers",
        command=lambda: show_all_pitchers()
    )
    btn_show_all.pack(fill="x", pady=2)
    add_button_tooltip(btn_show_all, "show_all_pitchers")

    # THEN: TOP 20 BY POSITION
    btn_top20 = ttk.Button(
        top20_btn_frame,
        text="Top 20 Pitchers by Position",
        command=lambda: show_top_20_pitcher_total_by_pos()
    )
    btn_top20.pack(fill="x", pady=2)
    add_button_tooltip(btn_top20, "top_pitchers_by_pos")


    controls = tk.Frame(pitcher_frame, bg="#1e1e1e", highlightthickness=0, bd=0)
    controls.pack(fill="x", padx=5, pady=5)

    tk.Label(controls, text="Search Player:", bg="#1e1e1e", fg="#d4d4d4").pack(side="left")
    search_entry = tk.Entry(controls, textvariable=search_var, width=30,
                        bg="#000000", fg="#d4d4d4", insertbackground="#00ff7f",
                        highlightthickness=0, relief="flat", font=font)
    search_entry.pack(side="left", padx=(0,2))
    add_clear_button(search_entry, search_var)
    add_search_tooltip(search_entry, tab_type="pitcher")

    table_frame = tk.Frame(pitcher_frame, bg="#1e1e1e", highlightthickness=0, bd=0)
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
    table.tag_configure("rp_sp_potential", background="#384574")
    table.tag_configure("pos_sep", background="#384574", font=(font[0], font[1], "bold"))

    table._prev_hover = None
    table.bind("<Motion>", on_treeview_motion)
    table.bind("<Leave>", on_leave)

    attach_treeview_heading_tooltips(table, PITCHER_COL_TOOLTIPS)
    attach_treeview_row_tooltips(table, HIGHLIGHT_EXPLANATIONS)

    add_pitcher_tab.CURRENT_PITCHERS = []

    def get_filtered_pitchers():
        allowed_positions = [p for p, v in pos_vars.items() if v.get()]
        search = search_var.get().strip()
        return filter_players(
            add_pitcher_tab.CURRENT_PITCHERS, allowed_positions, search, player_type="pitcher"
        )

    def set_table_columns(mode):
        if mode.startswith("top20"):
            width_lookup = column_widths_top
            cols = TOP20_COLS
        else:
            width_lookup = column_widths_all
            cols = ALL_COLS

        table["columns"] = cols

        for col in cols:
            if mode == "all":
                table.heading(col, text=col, command=lambda c=col: sort_treeview(table, c, False))
            else:
                table.heading(col, text=col)

            table.column(col, width=width_lookup.get(col, 80), minwidth=28, anchor="center", stretch=True)

    def update():
        mode = table_view_mode.get("mode", "all")
        set_table_columns(mode)

        table.delete(*table.get_children())
        id_map.clear()

        for p in get_filtered_pitchers():
            player_id = p.get("ID", "")
            pos = "RP" if p.get("POS") == "CL" else p.get("POS")
            row_tags = get_pitcher_highlight_tags(p)

            values = (
                p.get("Name", ""), p.get("ORG", ""), p.get("Age", ""), pos,
                p.get("Prone", ""), p.get("SctAcc", ""), p.get("T", ""),
                p.get("VELO", ""), p.get("PIT", ""), p.get("G/F", ""),
                p["Scores"].get("pitches", 0),
                p["Scores"].get("pitches_potential", 0),
                p["Scores"].get("core_potential", 0) + p["Scores"].get("pitches_potential", 0),
                p["Scores"].get("curr_total", 0),
                p["Scores"].get("total", 0)
            )

            iid = table.insert("", "end", values=values, tags=row_tags)
            id_map[iid] = player_id

        make_treeview_open_link_handler(table, id_map, lambda pid: player_url_template.format(pid=pid))

    def show_top_20_pitcher_total_by_pos():
        table_view_mode["mode"] = "top20_total_by_pos"
        set_table_columns("top20_total_by_pos")

        table.delete(*table.get_children())
        id_map.clear()

        by_pos = {}
        for p in get_filtered_pitchers():
            pos = "RP" if p.get("POS") == "CL" else p.get("POS")
            total = p["Scores"].get("total", 0)
            by_pos.setdefault(pos, []).append((total, p))

        for pos in pitcher_positions:
            if pos not in by_pos:
                continue

            sep_text = f"— Top 20 {pos} —"
            table.insert("", "end", values=(sep_text,) + ("",)*(len(TOP20_COLS)-1), tags=("pos_sep",))

            top20 = sorted(by_pos[pos], key=lambda t: t[0], reverse=True)[:20]

            for rank, (score, p) in enumerate(top20, 1):
                row_tags = []

                values = (
                    rank, p.get("Name", ""), p.get("ORG", ""), p.get("Age", ""), pos,
                    p.get("T", ""), p.get("VELO", ""), p.get("PIT", ""), p.get("G/F", ""),
                    p["Scores"].get("pitches", 0),
                    p["Scores"].get("pitches_potential", 0),
                    p["Scores"].get("core_potential", 0) + p["Scores"].get("pitches_potential", 0),
                    p["Scores"].get("curr_total", 0),
                    p["Scores"].get("total", 0)
                )

                iid = table.insert("", "end", values=values, tags=row_tags)
                id_map[iid] = p.get("ID", "")

        make_treeview_open_link_handler(table, id_map, lambda pid: player_url_template.format(pid=pid))
        table.yview_moveto(0)

    def show_all_pitchers():
        table_view_mode["mode"] = "all"
        set_table_columns("all")
        update()

    root = pitcher_frame.winfo_toplevel()
    debounced_filter = make_debounced_callback(root, 200, on_filter_or_search_change)
    search_var.trace_add("write", lambda *_: debounced_filter())

    class PitcherTab:
        def refresh(self, pitchers):
            add_pitcher_tab.CURRENT_PITCHERS = sorted(
                pitchers, key=lambda p: p["Scores"].get("total", 0), reverse=True
            )
            show_all_pitchers()

    return PitcherTab()
