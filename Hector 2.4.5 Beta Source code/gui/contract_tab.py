import tkinter as tk
from tkinter import ttk
from .style import on_treeview_motion, on_leave
from .widgets import (
    make_treeview_open_link_handler,
    load_player_url_template,
)

player_url_template = load_player_url_template()

# Position grouping for comparisons
POSITION_GROUPS = {
    "OF": ["LF", "CF", "RF"],
    "IF": ["1B", "2B", "3B", "SS"],
    "C": ["C"],
    "SP": ["SP"],
    "RP": ["RP", "CL"]
}

def parse_currency(value):
    """Parse currency string like '$26,000,000' to float"""
    if not value or value == "-" or value == "":
        return 0.0
    try:
        # Remove $ and commas
        cleaned = str(value).replace("$", "").replace(",", "").strip()
        return float(cleaned)
    except (ValueError, AttributeError):
        return 0.0

def parse_number(value):
    """Parse numeric value, handling '-' and empty strings"""
    if not value or value == "-" or value == "":
        return 0.0
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, AttributeError):
        return 0.0

def get_position_group(pos):
    """Get the position group for a given position"""
    pos = pos.upper()
    for group, positions in POSITION_GROUPS.items():
        if pos in positions:
            return group, positions
    return None, []

def add_contract_tab(notebook, font):
    contract_frame = ttk.Frame(notebook)
    notebook.add(contract_frame, text="Contract")
    
    # Data storage
    all_pitchers = []
    all_batters = []
    selected_player = [None]  # Use list to allow mutable reference
    
    def get_matching_players(prefix):
        """Get matching players for autocomplete"""
        prefix_lower = prefix.strip().lower()
        if not prefix_lower or len(prefix_lower) < 1:
            return []
        
        matches = []
        
        # Search pitchers
        for p in all_pitchers:
            name = p.get("Name", "")
            if prefix_lower in name.lower():
                team = p.get("ORG", "")
                pos = p.get("POS", "")
                display = f"{name} ({team}, {pos})"
                matches.append(("pitcher", p, display))
        
        # Search batters
        for b in all_batters:
            name = b.get("Name", "")
            if prefix_lower in name.lower():
                team = b.get("ORG", "")
                pos = b.get("POS", "")
                display = f"{name} ({team}, {pos})"
                matches.append(("batter", b, display))
        
        # Sort by name and limit to 10
        matches.sort(key=lambda x: x[2].lower())
        return matches[:10]
    
    def create_autocomplete_entry(parent_frame, entryvar, onselect_callback_ref):
        """Create an entry widget with autocomplete dropdown"""
        entry_frame = tk.Frame(parent_frame, bg="#1e1e1e")
        entry = tk.Entry(
            entry_frame,
            textvariable=entryvar,
            bg="#000000",
            fg="#d4d4d4",
            insertbackground="#00ff7f",
            highlightthickness=1,
            highlightbackground="#333",
            relief="flat",
            font=font
        )
        entry.pack(side="left", fill="x", expand=True)
        
        # Get root window for dropdown parent
        root = entry_frame.winfo_toplevel()
        
        # Create dropdown listbox
        dropdown = tk.Listbox(
            root,
            bg="#1e1e1e",
            fg="#d4d4d4",
            selectbackground="#0078d7",
            selectforeground="#ffffff",
            highlightthickness=0,
            relief="flat",
            font=font,
            height=6
        )
        dropdown.place_forget()
        
        current_selection = [None]
        matches_data = []
        
        def update_dropdown(*args):
            text = entryvar.get()
            matches = get_matching_players(text)
            
            matches_data.clear()
            matches_data.extend(matches)
            dropdown.delete(0, tk.END)
            current_selection[0] = None
            
            if text and matches:
                for match in matches:
                    dropdown.insert(tk.END, match[2])
                
                entry.update_idletasks()
                entry_root_x = entry.winfo_rootx()
                entry_root_y = entry.winfo_rooty()
                entry_height = entry.winfo_height()
                entry_width = entry.winfo_width()
                
                root_x = root.winfo_rootx()
                root_y = root.winfo_rooty()
                
                x = entry_root_x - root_x
                y = entry_root_y - root_y + entry_height
                
                dropdown.place(x=x, y=y, width=entry_width)
                dropdown.lift()
                dropdown.update()
            else:
                dropdown.place_forget()
        
        def select_item(index=None):
            if not matches_data:
                return
            
            if index is None:
                index = current_selection[0] if current_selection[0] is not None else 0
            
            if 0 <= index < len(matches_data):
                player_type, player_dict, display_str = matches_data[index]
                entryvar.set(player_dict.get("Name", ""))
                dropdown.place_forget()
                
                if onselect_callback_ref and onselect_callback_ref[0]:
                    onselect_callback_ref[0](player_dict, player_type)
        
        def on_dropdown_single_click(event):
            selection = dropdown.curselection()
            if selection:
                select_item(selection[0])
        
        def on_dropdown_double_click(event):
            selection = dropdown.curselection()
            if selection:
                select_item(selection[0])
        
        def on_keypress(event):
            if not dropdown.winfo_ismapped():
                if event.keysym == "Return":
                    if onselect_callback_ref and onselect_callback_ref[0] and matches_data:
                        if current_selection[0] is not None:
                            select_item()
                return
            
            if event.keysym == "Up":
                if current_selection[0] is None or current_selection[0] <= 0:
                    current_selection[0] = len(matches_data) - 1 if matches_data else 0
                else:
                    current_selection[0] -= 1
                
                if matches_data:
                    dropdown.selection_clear(0, tk.END)
                    dropdown.selection_set(current_selection[0])
                    dropdown.see(current_selection[0])
                return "break"
            
            elif event.keysym == "Down":
                if current_selection[0] is None or current_selection[0] >= len(matches_data) - 1:
                    current_selection[0] = 0
                else:
                    current_selection[0] += 1
                
                if matches_data:
                    dropdown.selection_clear(0, tk.END)
                    dropdown.selection_set(current_selection[0])
                    dropdown.see(current_selection[0])
                return "break"
            
            elif event.keysym == "Return":
                if dropdown.winfo_ismapped() and matches_data:
                    select_item()
                return "break"
            
            elif event.keysym == "Escape":
                dropdown.place_forget()
                return "break"
        
        def on_keyrelease(event):
            if event.keysym not in ("Up", "Down", "Return", "Escape", "Shift_L", "Shift_R", 
                                    "Control_L", "Control_R", "Alt_L", "Alt_R"):
                update_dropdown()
        
        def hide_dropdown(event=None):
            if event and event.widget not in (entry, dropdown):
                dropdown.place_forget()
        
        entry.bind("<KeyPress>", on_keypress)
        entry.bind("<KeyRelease>", on_keyrelease)
        entry.bind("<FocusOut>", hide_dropdown)
        dropdown.bind("<Button-1>", on_dropdown_single_click)
        dropdown.bind("<Double-Button-1>", on_dropdown_double_click)
        
        root = entry_frame.winfo_toplevel()
        root.bind("<Button-1>", lambda e: hide_dropdown(e) if e.widget not in (entry, dropdown) else None)
        
        return entry_frame, entry
    
    # Main container
    main_container = tk.Frame(contract_frame, bg="#1e1e1e")
    main_container.pack(fill="both", expand=True, padx=5, pady=5)
    
    # Top section: Player selection
    selection_frame = tk.Frame(main_container, bg="#1e1e1e", relief="ridge", bd=2)
    selection_frame.pack(fill="x", padx=5, pady=5)
    
    tk.Label(
        selection_frame,
        text="Select Player:",
        bg="#1e1e1e",
        fg="#d4d4d4",
        font=font
    ).pack(side="left", padx=5, pady=5)
    
    player_entry_var = tk.StringVar()
    player_callback_ref = [None]
    
    def on_player_selected(player_dict, player_type):
        selected_player[0] = (player_dict, player_type)
        update_player_display()
        update_comparables()
    
    player_callback_ref[0] = on_player_selected
    
    player_autocomplete_frame, player_entry = create_autocomplete_entry(
        selection_frame, player_entry_var, player_callback_ref
    )
    player_autocomplete_frame.pack(side="left", fill="x", expand=True, padx=5, pady=5)
    
    # Selected player info panel
    player_info_frame = tk.Frame(main_container, bg="#1e1e1e", relief="ridge", bd=2)
    player_info_frame.pack(fill="x", padx=5, pady=5)
    
    player_info_label = tk.Label(
        player_info_frame,
        text="No player selected",
        font=font,
        bg="#1e1e1e",
        fg="#d4d4d4",
        justify="left",
        anchor="w"
    )
    player_info_label.pack(fill="x", padx=10, pady=10)
    
    # Settings panel
    settings_frame = tk.Frame(main_container, bg="#1e1e1e", relief="ridge", bd=2)
    settings_frame.pack(fill="x", padx=5, pady=5)
    
    tk.Label(
        settings_frame,
        text="Comparison Settings:",
        font=(font[0], font[1], "bold"),
        bg="#1e1e1e",
        fg="#00ff7f"
    ).pack(anchor="w", padx=10, pady=(10, 5))
    
    settings_inner = tk.Frame(settings_frame, bg="#1e1e1e")
    settings_inner.pack(fill="x", padx=10, pady=5)
    
    # Position group selection
    tk.Label(settings_inner, text="Compare to positions:", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left", padx=5)
    
    position_group_var = tk.StringVar(value="auto")
    position_group_combo = ttk.Combobox(
        settings_inner,
        textvariable=position_group_var,
        state="readonly",
        width=20,
        font=font
    )
    position_group_combo.pack(side="left", padx=5)
    
    def update_position_group_options():
        if selected_player[0]:
            player_dict, player_type = selected_player[0]
            pos = player_dict.get("POS", "").upper()
            group, positions = get_position_group(pos)
            
            if player_type == "batter":
                if group:
                    options = ["Auto (same group)"] + [f"All {group}"] + ["All Batters"] + positions
                else:
                    options = ["Auto (same position)", pos, "All Batters"]
                position_group_combo['values'] = options
                position_group_combo.set("Auto (same group)" if group else "Auto (same position)")
            else:  # pitcher
                if group:
                    options = ["Auto (same group)"] + [f"All {group}"] + positions
                else:
                    options = ["Auto (same position)", pos]
                position_group_combo['values'] = options
                position_group_combo.set("Auto (same group)" if group else "Auto (same position)")
        else:
            position_group_combo['values'] = []
            position_group_combo.set("")
    
    # Age range filter
    age_frame = tk.Frame(settings_inner, bg="#1e1e1e")
    age_frame.pack(side="left", padx=10)
    
    tk.Label(age_frame, text="Age range:", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left", padx=5)
    
    min_age_var = tk.StringVar(value="18")
    max_age_var = tk.StringVar(value="45")
    
    tk.Entry(age_frame, textvariable=min_age_var, width=5, bg="#000000", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    tk.Label(age_frame, text="to", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    tk.Entry(age_frame, textvariable=max_age_var, width=5, bg="#000000", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    
    # Stat range filters - Batter filters
    batter_filters_frame = tk.Frame(settings_inner, bg="#1e1e1e")
    
    # OPS+ range filter
    ops_frame = tk.Frame(batter_filters_frame, bg="#1e1e1e")
    ops_frame.pack(side="left", padx=5)
    tk.Label(ops_frame, text="OPS+ range: ±", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    ops_range_var = tk.StringVar(value="20")
    tk.Entry(ops_frame, textvariable=ops_range_var, width=5, bg="#000000", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    tk.Label(ops_frame, text="%", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    
    # wRC+ range filter
    wrc_frame = tk.Frame(batter_filters_frame, bg="#1e1e1e")
    wrc_frame.pack(side="left", padx=5)
    tk.Label(wrc_frame, text="wRC+ range: ±", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    wrc_range_var = tk.StringVar(value="20")
    tk.Entry(wrc_frame, textvariable=wrc_range_var, width=5, bg="#000000", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    tk.Label(wrc_frame, text="%", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    
    # WAR range filter (batter)
    war_batter_frame = tk.Frame(batter_filters_frame, bg="#1e1e1e")
    war_batter_frame.pack(side="left", padx=5)
    tk.Label(war_batter_frame, text="WAR range: ±", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    war_batter_range_var = tk.StringVar(value="2.0")
    tk.Entry(war_batter_frame, textvariable=war_batter_range_var, width=5, bg="#000000", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    
    # Stat range filters - Pitcher filters
    pitcher_filters_frame = tk.Frame(settings_inner, bg="#1e1e1e")
    
    # ERA+ range filter
    era_frame = tk.Frame(pitcher_filters_frame, bg="#1e1e1e")
    era_frame.pack(side="left", padx=5)
    tk.Label(era_frame, text="ERA+ range: ±", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    era_range_var = tk.StringVar(value="20")
    tk.Entry(era_frame, textvariable=era_range_var, width=5, bg="#000000", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    tk.Label(era_frame, text="%", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    
    # WAR range filter (pitcher)
    war_pitcher_frame = tk.Frame(pitcher_filters_frame, bg="#1e1e1e")
    war_pitcher_frame.pack(side="left", padx=5)
    tk.Label(war_pitcher_frame, text="WAR range: ±", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    war_pitcher_range_var = tk.StringVar(value="2.0")
    tk.Entry(war_pitcher_frame, textvariable=war_pitcher_range_var, width=5, bg="#000000", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    
    # rWAR range filter
    rwar_frame = tk.Frame(pitcher_filters_frame, bg="#1e1e1e")
    rwar_frame.pack(side="left", padx=5)
    tk.Label(rwar_frame, text="rWAR range: ±", bg="#1e1e1e", fg="#d4d4d4", font=font).pack(side="left")
    rwar_range_var = tk.StringVar(value="2.0")
    tk.Entry(rwar_frame, textvariable=rwar_range_var, width=5, bg="#000000", fg="#d4d4d4", font=font).pack(side="left", padx=2)
    
    # Update button callback
    def on_settings_changed():
        update_comparables()
    
    # Update button
    update_btn = ttk.Button(settings_inner, text="Update Comparison", command=on_settings_changed)
    update_btn.pack(side="left", padx=10)
    
    def update_filter_visibility():
        """Show/hide filters based on selected player type"""
        # Remove both frames first
        batter_filters_frame.pack_forget()
        pitcher_filters_frame.pack_forget()
        
        if selected_player[0]:
            player_dict, player_type = selected_player[0]
            if player_type == "batter":
                batter_filters_frame.pack(side="left", padx=10)
            else:  # pitcher
                pitcher_filters_frame.pack(side="left", padx=10)
    
    # Comparables table
    comparables_frame = tk.Frame(main_container, bg="#1e1e1e", relief="ridge", bd=2)
    comparables_frame.pack(fill="both", expand=True, padx=5, pady=5)
    
    tk.Label(
        comparables_frame,
        text="Comparable Players:",
        font=(font[0], font[1], "bold"),
        bg="#1e1e1e",
        fg="#00ff7f"
    ).pack(anchor="w", padx=10, pady=(10, 5))
    
    table_frame = tk.Frame(comparables_frame, bg="#1e1e1e")
    table_frame.pack(fill="both", expand=True, padx=10, pady=5)
    
    vsb = ttk.Scrollbar(table_frame, orient="vertical")
    vsb.pack(side="right", fill="y")
    
    hsb = ttk.Scrollbar(table_frame, orient="horizontal")
    hsb.pack(side="bottom", fill="x")
    
    # Start with batter columns, will be updated dynamically
    comparables_cols_batter = ("Name", "Team", "POS", "Age", "G", "OPS+", "wRC+", "WAR", "SLR", "YL", "CV")
    comparables_cols_pitcher = ("Name", "Team", "POS", "Age", "IP", "ERA+", "WAR", "rWAR", "SLR", "YL", "CV")
    
    comparables_table = ttk.Treeview(
        table_frame,
        columns=comparables_cols_batter,
        show="headings",
        yscrollcommand=vsb.set,
        xscrollcommand=hsb.set,
        height=10
    )
    comparables_table.pack(side="left", fill="both", expand=True)
    vsb.config(command=comparables_table.yview)
    hsb.config(command=comparables_table.xview)
    
    column_widths = {
        "Name": 150, "Team": 60, "POS": 50, "Age": 50, "G": 50, "IP": 60,
        "OPS+": 60, "wRC+": 60, "WAR": 60, "ERA+": 60, "rWAR": 60,
        "SLR": 120, "YL": 50, "CV": 120
    }
    
    def update_table_columns(player_type):
        """Update table columns based on player type"""
        # Clear existing columns
        for col in comparables_table['columns']:
            comparables_table.heading(col, text="")
            comparables_table.column(col, width=0)
        
        # Set new columns
        if player_type == "batter":
            new_cols = comparables_cols_batter
        else:
            new_cols = comparables_cols_pitcher
        
        comparables_table['columns'] = new_cols
        
        # Configure new columns
        for col in new_cols:
            comparables_table.heading(col, text=col)
            comparables_table.column(col, width=column_widths.get(col, 100), minwidth=50, anchor="center", stretch=True)
    
    # Initialize with batter columns
    update_table_columns("batter")
    
    comparables_table.tag_configure("hover", background="#333")
    comparables_table._prev_hover = None
    comparables_table.bind("<Motion>", on_treeview_motion)
    comparables_table.bind("<Leave>", on_leave)
    
    # Contract suggestion panel
    suggestion_frame = tk.Frame(main_container, bg="#1e1e1e", relief="ridge", bd=2)
    suggestion_frame.pack(fill="x", padx=5, pady=5)
    
    tk.Label(
        suggestion_frame,
        text="Contract Suggestion:",
        font=(font[0], font[1], "bold"),
        bg="#1e1e1e",
        fg="#00ff7f"
    ).pack(anchor="w", padx=10, pady=(10, 5))
    
    suggestion_label = tk.Label(
        suggestion_frame,
        text="Select a player to see contract suggestions",
        font=font,
        bg="#1e1e1e",
        fg="#d4d4d4",
        justify="left",
        anchor="w"
    )
    suggestion_label.pack(fill="x", padx=10, pady=10)
    
    def update_player_display():
        if not selected_player[0]:
            player_info_label.config(text="No player selected")
            return
        
        player_dict, player_type = selected_player[0]
        name = player_dict.get("Name", "Unknown")
        pos = player_dict.get("POS", "")
        age = player_dict.get("Age", "")
        team = player_dict.get("ORG", "")
        
        if player_type == "batter":
            ops_plus = player_dict.get("OPS+", "-")
            wrc_plus = player_dict.get("wRC+", "-")
            war = player_dict.get("WAR (Batter)", player_dict.get("WAR", "-"))
            slr = player_dict.get("SLR", "-")
            yl = player_dict.get("YL", "-")
            cv = player_dict.get("CV", "-")
            
            info_text = (
                f"Player: {name} ({team}, {pos}, Age {age})\n"
                f"OPS+: {ops_plus} | wRC+: {wrc_plus} | WAR: {war}\n"
                f"Current Salary: {slr} | Years Left: {yl} | Contract Value: {cv}"
            )
        else:  # pitcher
            era_plus = player_dict.get("ERA+", "-")
            war = player_dict.get("WAR (Pitcher)", player_dict.get("WAR", "-"))
            rwar = player_dict.get("rWAR", "-")
            slr = player_dict.get("SLR", "-")
            yl = player_dict.get("YL", "-")
            cv = player_dict.get("CV", "-")
            
            info_text = (
                f"Player: {name} ({team}, {pos}, Age {age})\n"
                f"ERA+: {era_plus} | WAR: {war} | rWAR: {rwar}\n"
                f"Current Salary: {slr} | Years Left: {yl} | Contract Value: {cv}"
            )
        
        player_info_label.config(text=info_text)
        update_position_group_options()
        update_table_columns(player_type)
        update_filter_visibility()
    
    def find_comparable_players():
        """Find comparable players based on selected player and settings"""
        if not selected_player[0]:
            return []
        
        player_dict, player_type = selected_player[0]
        pos = player_dict.get("POS", "").upper()
        
        # Get position filter
        pos_filter = position_group_var.get()
        if pos_filter == "Auto (same group)":
            group, positions = get_position_group(pos)
            if group:
                allowed_positions = set(positions)
            else:
                allowed_positions = {pos}
        elif pos_filter == "Auto (same position)":
            allowed_positions = {pos}
        elif pos_filter == "All Batters":
            # Compare to all batter positions
            allowed_positions = {"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"}
        elif pos_filter.startswith("All "):
            group = pos_filter[4:]
            allowed_positions = set(POSITION_GROUPS.get(group, [pos]))
        else:
            allowed_positions = {pos_filter}
        
        # Get age range
        try:
            min_age = int(min_age_var.get())
            max_age = int(max_age_var.get())
        except ValueError:
            min_age = 18
            max_age = 45
        
        # Get player pool - only compare within same type
        if player_type == "batter":
            pool = all_batters
        else:
            pool = all_pitchers
        
        # Get stat range filters
        if player_type == "batter":
            # Get batter stat ranges
            try:
                ops_percent = float(ops_range_var.get())
            except ValueError:
                ops_percent = 20.0
            
            try:
                wrc_percent = float(wrc_range_var.get())
            except ValueError:
                wrc_percent = 20.0
            
            try:
                war_range = float(war_batter_range_var.get())
            except ValueError:
                war_range = 2.0
            
            # Calculate ranges from selected player's stats
            selected_ops = parse_number(player_dict.get("OPS+", 0))
            selected_wrc = parse_number(player_dict.get("wRC+", 0))
            selected_war = parse_number(player_dict.get("WAR (Batter)", player_dict.get("WAR", 0)))
            
            ops_min = selected_ops * (1 - ops_percent / 100) if selected_ops > 0 else 0
            ops_max = selected_ops * (1 + ops_percent / 100) if selected_ops > 0 else float('inf')
            wrc_min = selected_wrc * (1 - wrc_percent / 100) if selected_wrc > 0 else 0
            wrc_max = selected_wrc * (1 + wrc_percent / 100) if selected_wrc > 0 else float('inf')
            war_min = selected_war - war_range
            war_max = selected_war + war_range
        else:  # pitcher
            # Get pitcher stat ranges
            try:
                era_percent = float(era_range_var.get())
            except ValueError:
                era_percent = 20.0
            
            try:
                war_range = float(war_pitcher_range_var.get())
            except ValueError:
                war_range = 2.0
            
            try:
                rwar_range = float(rwar_range_var.get())
            except ValueError:
                rwar_range = 2.0
            
            # Calculate ranges from selected player's stats
            selected_era = parse_number(player_dict.get("ERA+", 0))
            selected_war = parse_number(player_dict.get("WAR (Pitcher)", player_dict.get("WAR", 0)))
            selected_rwar = parse_number(player_dict.get("rWAR", 0))
            
            era_min = selected_era * (1 - era_percent / 100) if selected_era > 0 else 0
            era_max = selected_era * (1 + era_percent / 100) if selected_era > 0 else float('inf')
            war_min = selected_war - war_range
            war_max = selected_war + war_range
            rwar_min = selected_rwar - rwar_range
            rwar_max = selected_rwar + rwar_range
        
        # Filter players
        comparables = []
        for p in pool:
            p_pos = p.get("POS", "").upper()
            if p_pos not in allowed_positions:
                continue
            
            try:
                p_age = int(p.get("Age", 0))
                if not (min_age <= p_age <= max_age):
                    continue
            except (ValueError, TypeError):
                continue
            
            # Exclude the selected player
            if p.get("Name") == player_dict.get("Name"):
                continue
            
            # Filter out players with 0 games/IP (didn't play)
            if player_type == "batter":
                games = parse_number(p.get("G", 0))
                if games == 0:
                    continue
            else:  # pitcher
                ip = parse_number(p.get("IP", 0))
                if ip == 0:
                    continue
            
            # Apply stat range filters
            if player_type == "batter":
                p_ops = parse_number(p.get("OPS+", 0))
                p_wrc = parse_number(p.get("wRC+", 0))
                p_war = parse_number(p.get("WAR (Batter)", p.get("WAR", 0)))
                
                # Check if stats are within range (only filter if selected player has meaningful stat)
                if selected_ops > 0:
                    if p_ops <= 0 or not (ops_min <= p_ops <= ops_max):
                        continue
                if selected_wrc > 0:
                    if p_wrc <= 0 or not (wrc_min <= p_wrc <= wrc_max):
                        continue
                if selected_war != 0:
                    if not (war_min <= p_war <= war_max):
                        continue
            else:  # pitcher
                p_era = parse_number(p.get("ERA+", 0))
                p_war = parse_number(p.get("WAR (Pitcher)", p.get("WAR", 0)))
                p_rwar = parse_number(p.get("rWAR", 0))
                
                # Check if stats are within range (only filter if selected player has meaningful stat)
                if selected_era > 0:
                    if p_era <= 0 or not (era_min <= p_era <= era_max):
                        continue
                if selected_war != 0:
                    if not (war_min <= p_war <= war_max):
                        continue
                if selected_rwar != 0:
                    if not (rwar_min <= p_rwar <= rwar_max):
                        continue
            
            comparables.append(p)
        
        return comparables
    
    def calculate_similarity_score(player, selected_player_dict, player_type):
        """Calculate similarity score between player and selected player"""
        score = 0.0
        
        if player_type == "batter":
            # Compare OPS+, wRC+, WAR
            selected_ops = parse_number(selected_player_dict.get("OPS+", 0))
            selected_wrc = parse_number(selected_player_dict.get("wRC+", 0))
            selected_war = parse_number(selected_player_dict.get("WAR (Batter)", selected_player_dict.get("WAR", 0)))
            
            player_ops = parse_number(player.get("OPS+", 0))
            player_wrc = parse_number(player.get("wRC+", 0))
            player_war = parse_number(player.get("WAR (Batter)", player.get("WAR", 0)))
            
            # Calculate differences (smaller is better)
            if selected_ops > 1 and player_ops > 1:  # Only compare meaningful values
                ops_diff = abs(selected_ops - player_ops) / selected_ops
                score += ops_diff * 0.4
            if selected_wrc > 1 and player_wrc > 1:  # Only compare meaningful values
                wrc_diff = abs(selected_wrc - player_wrc) / selected_wrc
                score += wrc_diff * 0.4
            if selected_war != 0 and player_war != 0:
                war_diff = abs(selected_war - player_war) / max(abs(selected_war), 1)
                score += war_diff * 0.2
        else:  # pitcher
            selected_era = parse_number(selected_player_dict.get("ERA+", 0))
            selected_war = parse_number(selected_player_dict.get("WAR (Pitcher)", selected_player_dict.get("WAR", 0)))
            selected_rwar = parse_number(selected_player_dict.get("rWAR", 0))
            
            player_era = parse_number(player.get("ERA+", 0))
            player_war = parse_number(player.get("WAR (Pitcher)", player.get("WAR", 0)))
            player_rwar = parse_number(player.get("rWAR", 0))
            
            if selected_era > 1 and player_era > 1:  # Only compare meaningful values
                era_diff = abs(selected_era - player_era) / selected_era
                score += era_diff * 0.4
            if selected_war != 0 and player_war != 0:
                war_diff = abs(selected_war - player_war) / max(abs(selected_war), 1)
                score += war_diff * 0.3
            if selected_rwar != 0 and player_rwar != 0:
                rwar_diff = abs(selected_rwar - player_rwar) / max(abs(selected_rwar), 1)
                score += rwar_diff * 0.3
        
        return score
    
    def suggest_contract(comparables):
        """Suggest contract based on comparable players"""
        if not comparables or not selected_player[0]:
            return None, None
        
        player_dict, player_type = selected_player[0]
        
        # Calculate similarity scores and get top comparables
        scored_comparables = []
        for comp in comparables:
            score = calculate_similarity_score(comp, player_dict, player_type)
            scored_comparables.append((score, comp))
        
        # Sort by similarity (lower score = more similar)
        scored_comparables.sort(key=lambda x: x[0])
        
        # Get top 20 most similar
        top_comparables = [comp for _, comp in scored_comparables[:20]]
        
        if not top_comparables:
            return None, None
        
        # Calculate suggested AAV (median of comparable salaries)
        salaries = []
        for comp in top_comparables:
            slr = parse_currency(comp.get("SLR", 0))
            if slr > 0:
                salaries.append(slr)
        
        if not salaries:
            return None, None
        
        salaries.sort()
        suggested_aav = salaries[len(salaries) // 2]  # Median
        
        # Calculate suggested years based on age and comparable contracts
        try:
            player_age = int(player_dict.get("Age", 25))
        except (ValueError, TypeError):
            player_age = 25
        
        # Get years from comparables
        years_list = []
        for comp in top_comparables:
            yl = parse_number(comp.get("YL", 0))
            if yl > 0:
                years_list.append(yl)
        
        if years_list:
            years_list.sort()
            base_years = years_list[len(years_list) // 2]  # Median
        else:
            base_years = 3  # Default
        
        # Adjust years based on age
        if player_age >= 32:
            suggested_years = max(1, int(base_years * 0.7))  # Shorter for older players
        elif player_age <= 25:
            suggested_years = min(8, int(base_years * 1.2))  # Longer for younger players
        else:
            suggested_years = int(base_years)
        
        return suggested_aav, suggested_years
    
    def update_comparables():
        """Update the comparables table and suggestion"""
        comparables_table.delete(*comparables_table.get_children())
        
        if not selected_player[0]:
            suggestion_label.config(text="Select a player to see contract suggestions")
            update_table_columns("batter")  # Reset to default
            return
        
        comparables = find_comparable_players()
        
        if not comparables:
            suggestion_label.config(text="No comparable players found with current filters")
            return
        
        # Calculate similarity and sort
        player_dict, player_type = selected_player[0]
        scored_comparables = []
        for comp in comparables:
            score = calculate_similarity_score(comp, player_dict, player_type)
            scored_comparables.append((score, comp))
        
        scored_comparables.sort(key=lambda x: x[0])
        
        # Display top 30
        for score, comp in scored_comparables[:30]:
            name = comp.get("Name", "")
            team = comp.get("ORG", "")
            pos = comp.get("POS", "")
            age = comp.get("Age", "")
            
            if player_type == "batter":
                games = comp.get("G", "-")
                ops_plus = comp.get("OPS+", "-")
                wrc_plus = comp.get("wRC+", "-")
                war = comp.get("WAR (Batter)", comp.get("WAR", "-"))
                slr = comp.get("SLR", "-")
                yl = comp.get("YL", "-")
                cv = comp.get("CV", "-")
                values = (name, team, pos, age, games, ops_plus, wrc_plus, war, slr, yl, cv)
            else:  # pitcher
                ip = comp.get("IP", "-")
                era_plus = comp.get("ERA+", "-")
                war = comp.get("WAR (Pitcher)", comp.get("WAR", "-"))
                rwar = comp.get("rWAR", "-")
                slr = comp.get("SLR", "-")
                yl = comp.get("YL", "-")
                cv = comp.get("CV", "-")
                values = (name, team, pos, age, ip, era_plus, war, rwar, slr, yl, cv)
            
            comparables_table.insert("", "end", values=values)
        
        # Update suggestion
        suggested_aav, suggested_years = suggest_contract(comparables)
        
        if suggested_aav is not None and suggested_years is not None:
            aav_formatted = f"${suggested_aav:,.0f}"
            total_value = suggested_aav * suggested_years
            total_formatted = f"${total_value:,.0f}"
            
            suggestion_text = (
                f"Suggested Contract:\n"
                f"  Average Annual Value (AAV): {aav_formatted}\n"
                f"  Years: {suggested_years}\n"
                f"  Total Contract Value: {total_formatted}\n"
                f"  Based on {len([c for _, c in scored_comparables[:20]])} comparable players"
            )
        else:
            suggestion_text = "Unable to calculate suggestion (insufficient comparable contract data)"
        
        suggestion_label.config(text=suggestion_text)
    
    class ContractTab:
        def refresh(self, pitchers, batters):
            all_pitchers.clear()
            all_batters.clear()
            all_pitchers.extend(pitchers)
            all_batters.extend(batters)
            # Keep selected player if still exists
            if selected_player[0]:
                player_dict, player_type = selected_player[0]
                name = player_dict.get("Name", "")
                # Try to find player in new data
                found = None
                if player_type == "pitcher":
                    for p in all_pitchers:
                        if p.get("Name") == name:
                            found = (p, player_type)
                            break
                else:
                    for b in all_batters:
                        if b.get("Name") == name:
                            found = (b, player_type)
                            break
                
                if found:
                    selected_player[0] = found
                    update_player_display()
                    update_comparables()
                else:
                    selected_player[0] = None
                    player_info_label.config(text="No player selected")
                    comparables_table.delete(*comparables_table.get_children())
                    suggestion_label.config(text="Select a player to see contract suggestions")
    
    return ContractTab()

