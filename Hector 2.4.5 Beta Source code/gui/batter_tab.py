import tkinter as tk
from tkinter import ttk
from .style import on_treeview_motion, on_leave, sort_treeview
from .widgets import (
    add_clear_button,
    make_treeview_open_link_handler,
    load_player_url_template,
    filter_players,
    get_batter_highlight_tags,
    make_debounced_callback,
    add_grouped_position_filters,  # <-- NEW: import the grouped filter!
)
from .tooltips import (
    add_search_tooltip, attach_treeview_heading_tooltips, BATTER_COL_TOOLTIPS,
    attach_treeview_row_tooltips, HIGHLIGHT_EXPLANATIONS, add_button_tooltip
)
from batters import calculate_batter_score

player_url_template = load_player_url_template()

def add_batter_tab(notebook, font):
    batter_frame = ttk.Frame(notebook)
    notebook.add(batter_frame, text="Batters")

    filter_frame = tk.Frame(batter_frame, bg="#1e1e1e", highlightthickness=0, bd=0)
    filter_frame.pack(side="left", fill="y", padx=5, pady=5)

    # Draft Comparison Mode Toggle
    draft_mode_var = tk.BooleanVar(value=False)
    draft_toggle_frame = tk.Frame(filter_frame, bg="#1e1e1e")
    draft_toggle_frame.pack(fill="x", padx=0, pady=(2, 8))
    
    draft_toggle = tk.Checkbutton(
        draft_toggle_frame,
        text="Draft Comparison Mode",
        variable=draft_mode_var,
        bg="#1e1e1e",
        fg="#d4d4d4",
        selectcolor="#1e1e1e",
        activebackground="#1e1e1e",
        activeforeground="#00ff7f",
        highlightthickness=0,
        font=(font[0], font[1], "bold")
    )
    draft_toggle.pack(anchor="w")
    add_button_tooltip(draft_toggle, "draft_comparison_mode")
    
    filter_label = tk.Label(
        filter_frame,
        text="Filter by Position",
        font=font,
        anchor="w",
        bg="#1e1e1e",
        fg="#d4d4d4"
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

    # --- RECOMMENDED: USE GROUPED HORIZONTAL CHECKBOXES ---
    add_grouped_position_filters(filter_frame, pos_vars, on_filter_or_search_change)
    # -------------------------------------------------------

    ttk.Button(filter_frame, text="Select All", command=lambda: set_all(True)).pack(fill="x", pady=2)
    ttk.Button(filter_frame, text="Clear All", command=lambda: set_all(False)).pack(fill="x", pady=2)

    # ... after Select All/Clear All buttons ...

    # Quick Reports label FIRST
    report_label = tk.Label(
        filter_frame,
        text="Quick Reports",
        font=font,
        anchor="w",
        bg="#1e1e1e",
        fg="#d4d4d4"
    )
    report_label.pack(fill="x", padx=0, pady=(16,2))

    # Button frame for both buttons
    btn_frame = tk.Frame(filter_frame, bg="#1e1e1e")
    btn_frame.pack(fill="x", pady=6, anchor="n")

    # 🟢 SHOW ALL BATTERS FIRST
    btn_showall = ttk.Button(
        btn_frame,
        text="Show All Batters",
        command=lambda: show_all_batters()
    )
    btn_showall.pack(fill="x", pady=2)
    add_button_tooltip(btn_showall, "show_all_batters")

    # 🟢 THEN TOP 10 BY POSITION
    btn_top10 = ttk.Button(
        btn_frame,
        text="Top 10 Batters by Position",
        command=lambda: show_top_10_batter_total_by_pos()
    )
    btn_top10.pack(fill="x", pady=2)
    add_button_tooltip(btn_top10, "top_batters_by_pos")

    # Show Secondary Positions checkbox (do NOT pack yet)
    show_secondary_positions_var = tk.BooleanVar(value=False)
    secondary_cb = tk.Checkbutton(
        filter_frame,
        text="Show Secondary Positions",
        variable=show_secondary_positions_var,
        command=lambda: show_top_10_batter_total_by_pos(),
        bg="#1e1e1e",
        fg="#d4d4d4",
        selectcolor="#1e1e1e",
        activebackground="#1e1e1e",
        activeforeground="#d4d4d4",
        highlightthickness=0,
        bd=0
    )


    controls = tk.Frame(batter_frame, bg="#1e1e1e", highlightthickness=0, bd=0)
    controls.pack(fill="x", padx=5, pady=5)

    tk.Label(controls, text="Search Player:", bg="#1e1e1e", fg="#d4d4d4").pack(side="left")
    search_entry = tk.Entry(controls, textvariable=search_var, width=30,
                        bg="#000000", fg="#d4d4d4", insertbackground="#00ff7f",
                        highlightthickness=0, relief="flat", font=font)
    search_entry.pack(side="left", padx=(0,2))
    add_clear_button(search_entry, search_var)
    add_search_tooltip(search_entry, tab_type="batter")

    table_frame = tk.Frame(batter_frame, bg="#1e1e1e", highlightthickness=0, bd=0)
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

    add_batter_tab.CURRENT_BATTERS = []
    
    # Import weights module to access and modify weights
    import sys
    import importlib.util
    
    def get_weights_module():
        """Get batter weights module - uses same logic as core.py for frozen apps"""
        # Import here to avoid circular import
        from .core import get_weights_dir
        weights_path = get_weights_dir() / "batter_weights.py"
        if "batter_weights" in sys.modules:
            return sys.modules["batter_weights"]
        spec = importlib.util.spec_from_file_location("batter_weights", str(weights_path))
        weights_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(weights_module)
        sys.modules["batter_weights"] = weights_module
        return weights_module
    
    # Store original meta values
    original_meta_values = {
        "overall": None,
        "potential": None
    }
    
    def recalculate_scores_with_draft_mode():
        """Recalculate all batter scores with draft mode weights"""
        weights_module = get_weights_module()
        weights = weights_module.section_weights
        
        # Store original values on first call
        if original_meta_values["overall"] is None:
            original_meta_values["overall"] = weights["meta"].get("overall", 1.0)
            original_meta_values["potential"] = weights["meta"].get("potential", 1.0)
        
        if draft_mode_var.get():
            # Draft mode: emphasize potential
            weights["meta"]["potential"] = 1.5
            weights["meta"]["overall"] = 0.9
        else:
            # Normal mode: restore original weights
            weights["meta"]["potential"] = original_meta_values["potential"]
            weights["meta"]["overall"] = original_meta_values["overall"]
        
        # Recalculate all batter scores
        for batter in add_batter_tab.CURRENT_BATTERS:
            batter['Scores'] = calculate_batter_score(batter, weights)
        
        # Re-sort by new total scores
        add_batter_tab.CURRENT_BATTERS.sort(
            key=lambda b: b["Scores"].get("total", 0), reverse=True
        )
        
        # Refresh display
        if table_view_mode["mode"] == "all":
            show_all_batters()
        else:
            show_top_10_batter_total_by_pos()
    
    def on_draft_mode_toggle(*args):
        """Callback when draft mode toggle changes"""
        if add_batter_tab.CURRENT_BATTERS:  # Only recalculate if we have players
            recalculate_scores_with_draft_mode()
    
    draft_mode_var.trace("w", on_draft_mode_toggle)

    def get_filtered_batters():
        allowed_positions = [pos for pos, var in pos_vars.items() if var.get()]
        search = search_var.get().strip()
        return filter_players(
            add_batter_tab.CURRENT_BATTERS, allowed_positions, search, player_type="batter"
        )

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

        if secondary_cb.winfo_ismapped():
            secondary_cb.pack_forget()

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

        if not secondary_cb.winfo_ismapped():
            secondary_cb.pack(anchor="w", pady=(0, 6))

        set_table_columns("top10_total_by_pos")
        table.delete(*table.get_children())
        id_map.clear()

        POSITION_ORDER = ["C", "1B", "2B", "3B", "SS", "DH", "LF", "CF", "RF"]
        all_batters = get_filtered_batters()
        used_ids_by_pos = {pos: set() for pos in POSITION_ORDER}

        for pos in POSITION_ORDER:
            candidates = []
            threshold = 50

            if show_secondary_positions_var.get():
                for b in all_batters:
                    already_in = b.get("ID") in used_ids_by_pos[pos]
                    if b.get("POS", "") == pos and not already_in:
                        candidates.append((b["Scores"].get("total", 0), b))
                        used_ids_by_pos[pos].add(b.get("ID"))
                    elif b.get("POS", "") != pos:
                        try:
                            rating = int(b.get(pos, "0"))
                        except Exception:
                            rating = 0

                        if rating >= threshold and not already_in:
                            candidates.append((b["Scores"].get("total", 0), b))
                            used_ids_by_pos[pos].add(b.get("ID"))
            else:
                for b in all_batters:
                    if b.get("POS", "") == pos and b.get("ID") not in used_ids_by_pos[pos]:
                        candidates.append((b["Scores"].get("total", 0), b))
                        used_ids_by_pos[pos].add(b.get("ID"))

            if not candidates:
                continue

            sep_text = f"— Top 10 {pos} —"
            table.insert("", "end", values=(sep_text,) + ("",)*(len(TOP10_COLS)-1), tags=("pos_sep",))

            top10 = sorted(candidates, key=lambda t: t[0], reverse=True)[:10]

            for rank, (score, b) in enumerate(top10, 1):
                row_tags = []

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

        if secondary_cb.winfo_ismapped():
            secondary_cb.pack_forget()

        set_table_columns("all")
        update()

    root = batter_frame.winfo_toplevel()
    debounced_filter = make_debounced_callback(root, 200, on_filter_or_search_change)
    search_var.trace_add("write", lambda *_: debounced_filter())

    add_batter_tab.CURRENT_BATTERS = []

    class BatterTab:
        def refresh(self, batters):
            # Reset weights to original when refreshing
            weights_module = get_weights_module()
            weights = weights_module.section_weights
            
            # Reload weights module to get fresh original values
            import sys
            if "batter_weights" in sys.modules:
                del sys.modules["batter_weights"]
            
            # Get fresh module with original values
            fresh_weights_module = get_weights_module()
            fresh_weights = fresh_weights_module.section_weights
            
            # Get original values from fresh module
            original_overall = fresh_weights["meta"].get("overall", 1.0)
            original_potential = fresh_weights["meta"].get("potential", 1.0)
            
            # Store original values (fresh_weights already has original values, so no need to modify)
            original_meta_values["overall"] = original_overall
            original_meta_values["potential"] = original_potential
            
            # Store batters and recalculate with current mode
            add_batter_tab.CURRENT_BATTERS = list(batters)
            recalculate_scores_with_draft_mode()

    return BatterTab()
