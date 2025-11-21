import tkinter as tk
from tkinter import ttk, messagebox
from .style import on_treeview_motion, on_leave
from .widgets import (
    make_treeview_open_link_handler,
    load_player_url_template,
)

player_url_template = load_player_url_template()

def add_trade_tab(notebook, font):
    trade_frame = ttk.Frame(notebook)
    notebook.add(trade_frame, text="Trade")
    
    # Data storage (defined early so functions can reference them)
    team_a_players = []  # List of player dicts
    team_b_players = []  # List of player dicts
    team_a_picks = []  # List of draft pick dicts
    team_b_picks = []  # List of draft pick dicts
    all_pitchers = []
    all_batters = []
    team_a_id_map = {}
    team_b_id_map = {}
    
    # Normalization values
    max_pitcher_score = 0.0
    max_batter_score = 0.0
    draft_pick_base_value = 25.0  # Default, will be calculated dynamically
    
    # League configuration
    num_teams = 28  # Default number of teams
    num_rounds = 20  # Default number of rounds
    
    def get_matching_players(prefix):
        """Get matching players for autocomplete (returns list of tuples: (player_type, player_dict, display_string))"""
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
        
        # Get root window for dropdown parent to avoid clipping issues
        root = entry_frame.winfo_toplevel()
        
        # Create dropdown listbox as child of root window (initially hidden)
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
        dropdown.place_forget()  # Initially hidden
        
        current_selection = [None]  # Store current selection index
        matches_data = []  # Store current matches: [(player_type, player_dict, display_string), ...]
        is_selecting = [False]  # Flag to prevent dropdown from reappearing during selection
        
        def update_dropdown(*args):
            """Update dropdown based on entry text"""
            # Don't update if we're in the middle of selecting
            if is_selecting[0]:
                return
            
            text = entryvar.get()
            matches = get_matching_players(text)
            
            matches_data.clear()
            matches_data.extend(matches)
            dropdown.delete(0, tk.END)
            current_selection[0] = None
            
            if text and matches:
                for match in matches:
                    dropdown.insert(tk.END, match[2])  # display_string
                
                # Position dropdown below entry using absolute coordinates
                entry.update_idletasks()
                # Get absolute screen coordinates of entry
                entry_root_x = entry.winfo_rootx()
                entry_root_y = entry.winfo_rooty()
                entry_height = entry.winfo_height()
                entry_width = entry.winfo_width()
                
                # Convert to coordinates relative to root window
                root_x = root.winfo_rootx()
                root_y = root.winfo_rooty()
                
                # Calculate position relative to root window
                x = entry_root_x - root_x
                y = entry_root_y - root_y + entry_height
                
                # Position and show dropdown
                dropdown.place(x=x, y=y, width=entry_width)
                dropdown.lift()
                dropdown.update()
            else:
                dropdown.place_forget()
        
        def select_item(index=None, auto_add=False):
            """Select an item from dropdown"""
            if not matches_data:
                return
            
            if index is None:
                index = current_selection[0] if current_selection[0] is not None else 0
            
            if 0 <= index < len(matches_data):
                player_type, player_dict, display_str = matches_data[index]
                
                # Set flag to prevent dropdown from reappearing
                is_selecting[0] = True
                
                # Hide dropdown first
                dropdown.place_forget()
                dropdown.update()
                
                # Clear matches to prevent re-showing
                matches_data.clear()
                current_selection[0] = None
                
                # Set entry to just the player name
                entryvar.set(player_dict.get("Name", ""))
                
                # Only auto-add if explicitly requested (e.g., double-click)
                if auto_add and onselect_callback_ref and onselect_callback_ref[0]:
                    onselect_callback_ref[0]()
                
                # Reset flag after a short delay to allow any pending updates to complete
                entry.after(100, lambda: is_selecting.__setitem__(0, False))
        
        def on_dropdown_single_click(event):
            """Handle single click on dropdown item"""
            selection = dropdown.curselection()
            if selection:
                select_item(selection[0], auto_add=False)
        
        def on_dropdown_double_click(event):
            """Handle double click on dropdown item"""
            selection = dropdown.curselection()
            if selection:
                select_item(selection[0], auto_add=True)
        
        def on_keypress(event):
            """Handle keyboard navigation in dropdown"""
            # If dropdown not visible, trigger normal add behavior
            if not dropdown.winfo_ismapped():
                if event.keysym == "Return":
                    if onselect_callback_ref and onselect_callback_ref[0]:
                        onselect_callback_ref[0]()
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
                    select_item(auto_add=True)
                return "break"
            
            elif event.keysym == "Escape":
                dropdown.place_forget()
                return "break"
        
        def on_keyrelease(event):
            """Trigger dropdown update on key release"""
            # Update on any character input
            if event.keysym not in ("Up", "Down", "Return", "Escape", "Shift_L", "Shift_R", 
                                    "Control_L", "Control_R", "Alt_L", "Alt_R"):
                update_dropdown()
        
        def hide_dropdown(event=None):
            """Hide dropdown when focus is lost"""
            if event and event.widget not in (entry, dropdown):
                dropdown.place_forget()
        
        # Bind events
        entry.bind("<KeyPress>", on_keypress)
        entry.bind("<KeyRelease>", on_keyrelease)  # THIS IS THE KEY FIX
        entry.bind("<FocusOut>", hide_dropdown)
        dropdown.bind("<Button-1>", on_dropdown_single_click)
        dropdown.bind("<Double-Button-1>", on_dropdown_double_click)
        
        # Also hide dropdown when clicking elsewhere
        root = entry_frame.winfo_toplevel()
        root.bind("<Button-1>", lambda e: hide_dropdown(e) if e.widget not in (entry, dropdown) else None)
        
        return entry_frame, entry

    
    # League Settings Section
    settings_section = tk.Frame(trade_frame, bg="#1e1e1e", relief="ridge", bd=2)
    settings_section.pack(fill="x", padx=5, pady=5)
    
    tk.Label(
        settings_section,
        text="League Settings:",
        font=(font[0], font[1], "bold"),
        bg="#1e1e1e",
        fg="#00ff7f"
    ).pack(anchor="w", padx=10, pady=(10, 5))
    
    settings_inner = tk.Frame(settings_section, bg="#1e1e1e")
    settings_inner.pack(fill="x", padx=10, pady=5)
    
    # Number of teams
    teams_frame = tk.Frame(settings_inner, bg="#1e1e1e")
    teams_frame.pack(side="left", padx=10)
    
    tk.Label(
        teams_frame,
        text="Number of Teams:",
        bg="#1e1e1e",
        fg="#d4d4d4",
        font=font
    ).pack(side="left", padx=(0, 5))
    
    teams_var = tk.StringVar(value=str(num_teams))
    teams_entry = tk.Entry(
        teams_frame,
        textvariable=teams_var,
        width=5,
        bg="#000000",
        fg="#d4d4d4",
        font=font
    )
    teams_entry.pack(side="left")
    
    # Number of rounds
    rounds_frame = tk.Frame(settings_inner, bg="#1e1e1e")
    rounds_frame.pack(side="left", padx=10)
    
    tk.Label(
        rounds_frame,
        text="Number of Rounds:",
        bg="#1e1e1e",
        fg="#d4d4d4",
        font=font
    ).pack(side="left", padx=(0, 5))
    
    rounds_var = tk.StringVar(value=str(num_rounds))
    rounds_entry = tk.Entry(
        rounds_frame,
        textvariable=rounds_var,
        width=5,
        bg="#000000",
        fg="#d4d4d4",
        font=font
    )
    rounds_entry.pack(side="left")
    
    def update_league_settings():
        """Update league settings from UI inputs"""
        nonlocal num_teams, num_rounds
        try:
            new_teams = int(teams_var.get())
            new_rounds = int(rounds_var.get())
            
            if new_teams < 2 or new_teams > 50:
                messagebox.showerror("Error", "Number of teams must be between 2 and 50")
                return
            
            if new_rounds < 1 or new_rounds > 50:
                messagebox.showerror("Error", "Number of rounds must be between 1 and 50")
                return
            
            num_teams = new_teams
            num_rounds = new_rounds
            
            # Recalculate draft pick values for existing picks
            for pick in team_a_picks:
                new_pick = calculate_draft_pick_value(pick["round"], pick["position_in_standings"])
                pick.update(new_pick)
            
            for pick in team_b_picks:
                new_pick = calculate_draft_pick_value(pick["round"], pick["position_in_standings"])
                pick.update(new_pick)
            
            # Update displays
            update_team_table(team_a_table, team_a_players, team_a_id_map, team_a_picks)
            update_team_table(team_b_table, team_b_players, team_b_id_map, team_b_picks)
            update_summaries()
            
            messagebox.showinfo("Success", "League settings updated. Draft pick values have been recalculated.")
        except ValueError:
            messagebox.showerror("Error", "Please enter valid numbers")
    
    ttk.Button(
        settings_inner,
        text="Update Settings",
        command=update_league_settings
    ).pack(side="left", padx=10)
    
    # Main container split into left and right
    main_container = tk.Frame(trade_frame, bg="#1e1e1e")
    main_container.pack(fill="both", expand=True, padx=5, pady=5)
    
    # Team A Panel (Left)
    team_a_frame = tk.Frame(main_container, bg="#1e1e1e", relief="ridge", bd=2)
    team_a_frame.pack(side="left", fill="both", expand=True, padx=(0, 5))
    
    team_a_label = tk.Label(
        team_a_frame,
        text="Team A",
        font=(font[0], font[1] + 2, "bold"),
        bg="#1e1e1e",
        fg="#00ff7f"
    )
    team_a_label.pack(pady=(5, 10))
    
    # Team A Entry
    team_a_entry_frame = tk.Frame(team_a_frame, bg="#1e1e1e")
    team_a_entry_frame.pack(fill="x", padx=5, pady=5)
    
    tk.Label(
        team_a_entry_frame,
        text="Add Player:",
        bg="#1e1e1e",
        fg="#d4d4d4",
        font=font
    ).pack(side="left", padx=(0, 5))
    
    team_a_entry_var = tk.StringVar()
    team_a_callback_ref = [None]  # Use list to allow mutable reference
    team_a_autocomplete_frame, team_a_entry = create_autocomplete_entry(
        team_a_entry_frame, team_a_entry_var, team_a_callback_ref
    )
    team_a_autocomplete_frame.pack(side="left", fill="x", expand=True, padx=(0, 5))
    
    team_a_add_btn = ttk.Button(team_a_entry_frame, text="Add")
    team_a_add_btn.pack(side="left", padx=(0, 5))
    
    team_a_add_pick_btn = ttk.Button(team_a_entry_frame, text="Add Draft Pick")
    team_a_add_pick_btn.pack(side="left")
    
    # Team A Treeview
    team_a_table_frame = tk.Frame(team_a_frame, bg="#1e1e1e")
    team_a_table_frame.pack(fill="both", expand=True, padx=5, pady=5)
    
    team_a_vsb = ttk.Scrollbar(team_a_table_frame, orient="vertical")
    team_a_vsb.pack(side="right", fill="y")
    
    team_a_hsb = ttk.Scrollbar(team_a_table_frame, orient="horizontal")
    team_a_hsb.pack(side="bottom", fill="x")
    
    team_a_cols = ("Name", "Team", "POS", "Age", "Current", "Potential", "Defense", "Total")
    team_a_table = ttk.Treeview(
        team_a_table_frame,
        columns=team_a_cols,
        show="headings",
        yscrollcommand=team_a_vsb.set,
        xscrollcommand=team_a_hsb.set,
        height=12
    )
    team_a_table.pack(side="left", fill="both", expand=True)
    team_a_vsb.config(command=team_a_table.yview)
    team_a_hsb.config(command=team_a_table.xview)
    
    column_widths_a = {
        "Name": 120, "Team": 60, "POS": 50, "Age": 50,
        "Current": 80, "Potential": 80, "Defense": 80, "Total": 80
    }
    for col in team_a_cols:
        team_a_table.heading(col, text=col)
        team_a_table.column(col, width=column_widths_a.get(col, 100), minwidth=50, anchor="center", stretch=True)
    
    team_a_table.tag_configure("hover", background="#333")
    team_a_table.tag_configure("draft_pick", foreground="#00ff7f")
    team_a_table._prev_hover = None
    team_a_table.bind("<Motion>", on_treeview_motion)
    team_a_table.bind("<Leave>", on_leave)
    
    # Team A Summary
    team_a_summary_frame = tk.Frame(team_a_frame, bg="#1e1e1e")
    team_a_summary_frame.pack(fill="x", padx=5, pady=5)
    
    team_a_summary_label = tk.Label(
        team_a_summary_frame,
        text="",
        font=font,
        bg="#1e1e1e",
        fg="#d4d4d4",
        justify="left",
        anchor="w"
    )
    team_a_summary_label.pack(fill="x")
    
    # Team B Panel (Right)
    team_b_frame = tk.Frame(main_container, bg="#1e1e1e", relief="ridge", bd=2)
    team_b_frame.pack(side="right", fill="both", expand=True, padx=(5, 0))
    
    team_b_label = tk.Label(
        team_b_frame,
        text="Team B",
        font=(font[0], font[1] + 2, "bold"),
        bg="#1e1e1e",
        fg="#00ff7f"
    )
    team_b_label.pack(pady=(5, 10))
    
    # Team B Entry
    team_b_entry_frame = tk.Frame(team_b_frame, bg="#1e1e1e")
    team_b_entry_frame.pack(fill="x", padx=5, pady=5)
    
    tk.Label(
        team_b_entry_frame,
        text="Add Player:",
        bg="#1e1e1e",
        fg="#d4d4d4",
        font=font
    ).pack(side="left", padx=(0, 5))
    
    team_b_entry_var = tk.StringVar()
    team_b_callback_ref = [None]  # Use list to allow mutable reference
    team_b_autocomplete_frame, team_b_entry = create_autocomplete_entry(
        team_b_entry_frame, team_b_entry_var, team_b_callback_ref
    )
    team_b_autocomplete_frame.pack(side="left", fill="x", expand=True, padx=(0, 5))
    
    team_b_add_btn = ttk.Button(team_b_entry_frame, text="Add")
    team_b_add_btn.pack(side="left", padx=(0, 5))
    
    team_b_add_pick_btn = ttk.Button(team_b_entry_frame, text="Add Draft Pick")
    team_b_add_pick_btn.pack(side="left")
    
    # Team B Treeview
    team_b_table_frame = tk.Frame(team_b_frame, bg="#1e1e1e")
    team_b_table_frame.pack(fill="both", expand=True, padx=5, pady=5)
    
    team_b_vsb = ttk.Scrollbar(team_b_table_frame, orient="vertical")
    team_b_vsb.pack(side="right", fill="y")
    
    team_b_hsb = ttk.Scrollbar(team_b_table_frame, orient="horizontal")
    team_b_hsb.pack(side="bottom", fill="x")
    
    team_b_cols = ("Name", "Team", "POS", "Age", "Current", "Potential", "Defense", "Total")
    team_b_table = ttk.Treeview(
        team_b_table_frame,
        columns=team_b_cols,
        show="headings",
        yscrollcommand=team_b_vsb.set,
        xscrollcommand=team_b_hsb.set,
        height=12
    )
    team_b_table.pack(side="left", fill="both", expand=True)
    team_b_vsb.config(command=team_b_table.yview)
    team_b_hsb.config(command=team_b_table.xview)
    
    column_widths_b = {
        "Name": 120, "Team": 60, "POS": 50, "Age": 50,
        "Current": 80, "Potential": 80, "Defense": 80, "Total": 80
    }
    for col in team_b_cols:
        team_b_table.heading(col, text=col)
        team_b_table.column(col, width=column_widths_b.get(col, 100), minwidth=50, anchor="center", stretch=True)
    
    team_b_table.tag_configure("hover", background="#333")
    team_b_table.tag_configure("draft_pick", foreground="#00ff7f")
    team_b_table._prev_hover = None
    team_b_table.bind("<Motion>", on_treeview_motion)
    team_b_table.bind("<Leave>", on_leave)
    
    # Team B Summary
    team_b_summary_frame = tk.Frame(team_b_frame, bg="#1e1e1e")
    team_b_summary_frame.pack(fill="x", padx=5, pady=5)
    
    team_b_summary_label = tk.Label(
        team_b_summary_frame,
        text="",
        font=font,
        bg="#1e1e1e",
        fg="#d4d4d4",
        justify="left",
        anchor="w"
    )
    team_b_summary_label.pack(fill="x")
    
    # Comparison Section (Bottom)
    comparison_frame = tk.Frame(trade_frame, bg="#1e1e1e", relief="ridge", bd=2)
    comparison_frame.pack(fill="x", padx=5, pady=5)
    
    comparison_label = tk.Label(
        comparison_frame,
        text="Trade Comparison",
        font=(font[0], font[1] + 2, "bold"),
        bg="#1e1e1e",
        fg="#00ff7f"
    )
    comparison_label.pack(pady=(5, 10))
    
    comparison_content = tk.Frame(comparison_frame, bg="#1e1e1e")
    comparison_content.pack(fill="x", padx=10, pady=5)
    
    comparison_text = tk.Label(
        comparison_content,
        text="",
        font=font,
        bg="#1e1e1e",
        fg="#d4d4d4",
        justify="left",
        anchor="w"
    )
    comparison_text.pack(fill="x")
    
    # Data storage
    team_a_players = []  # List of player dicts
    team_b_players = []  # List of player dicts
    all_pitchers = []
    all_batters = []
    team_a_id_map = {}
    team_b_id_map = {}
    
    def get_matching_players(prefix):
        """Get matching players for autocomplete (returns list of tuples: (player_type, player_dict, display_string))"""
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
    
    def create_autocomplete_entry(parent_frame, entry_var, on_select_callback_ref):
        """Create an entry widget with autocomplete dropdown"""
        entry_frame = tk.Frame(parent_frame, bg="#1e1e1e")
        
        entry = tk.Entry(
            entry_frame,
            textvariable=entry_var,
            bg="#000000",
            fg="#d4d4d4",
            insertbackground="#00ff7f",
            highlightthickness=1,
            highlightbackground="#333",
            relief="flat",
            font=font
        )
        entry.pack(side="left", fill="x", expand=True)
        
        # Get root window for dropdown parent to avoid clipping issues
        root = entry_frame.winfo_toplevel()
        
        # Create dropdown listbox as child of root window (initially hidden)
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
        dropdown.place_forget()  # Initially hidden
        
        current_selection = [None]  # Store current selection index
        matches_data = []  # Store current matches: [(player_type, player_dict, display_string), ...]
        is_selecting = [False]  # Flag to prevent dropdown from reappearing during selection
        
        def update_dropdown(*args):
            """Update dropdown based on entry text"""
            # Don't update if we're in the middle of selecting
            if is_selecting[0]:
                return
            
            text = entry_var.get()
            matches = get_matching_players(text)
            matches_data.clear()
            matches_data.extend(matches)
            
            dropdown.delete(0, tk.END)
            current_selection[0] = None
            
            if text and matches:
                for match in matches:
                    dropdown.insert(tk.END, match[2])
                
                # Position dropdown below entry using absolute coordinates
                entry.update_idletasks()
                # Get absolute screen coordinates of entry
                entry_root_x = entry.winfo_rootx()
                entry_root_y = entry.winfo_rooty()
                entry_height = entry.winfo_height()
                entry_width = entry.winfo_width()
                
                # Convert to coordinates relative to root window
                root_x = root.winfo_rootx()
                root_y = root.winfo_rooty()
                
                # Calculate position relative to root window
                x = entry_root_x - root_x
                y = entry_root_y - root_y + entry_height
                
                # Position and show dropdown
                dropdown.place(x=x, y=y, width=entry_width)
                dropdown.lift()
                dropdown.update()
            else:
                dropdown.place_forget()
        
        def select_item(index=None, auto_add=False):
            """Select an item from dropdown"""
            if not matches_data:
                return
            
            if index is None:
                index = current_selection[0] if current_selection[0] is not None else 0
            
            if 0 <= index < len(matches_data):
                player_type, player_dict, display_str = matches_data[index]
                
                # Set flag to prevent dropdown from reappearing
                is_selecting[0] = True
                
                # Hide dropdown first
                dropdown.place_forget()
                dropdown.update()
                
                # Clear matches to prevent re-showing
                matches_data.clear()
                current_selection[0] = None
                
                # Set entry to just the player name
                entry_var.set(player_dict.get("Name", ""))
                
                # Only auto-add if explicitly requested (e.g., double-click)
                if auto_add and on_select_callback_ref and on_select_callback_ref[0]:
                    on_select_callback_ref[0]()
                
                # Reset flag after a short delay to allow any pending updates to complete
                entry.after(100, lambda: is_selecting.__setitem__(0, False))
        
        def on_dropdown_single_click(event):
            """Handle single click on dropdown item"""
            selection = dropdown.curselection()
            if selection:
                select_item(selection[0], auto_add=False)
        
        def on_dropdown_double_click(event):
            """Handle double click on dropdown item"""
            selection = dropdown.curselection()
            if selection:
                select_item(selection[0], auto_add=True)
        
        def on_key_press(event):
            """Handle keyboard navigation in dropdown"""
            if not dropdown.winfo_ismapped():
                if event.keysym == "Return":
                    # If dropdown not visible, trigger normal add behavior
                    if on_select_callback_ref and on_select_callback_ref[0]:
                        on_select_callback_ref[0]()
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
                    select_item(auto_add=True)
                    return "break"
            elif event.keysym == "Escape":
                dropdown.place_forget()
                return "break"
        
        def hide_dropdown(event=None):
            """Hide dropdown when focus is lost"""
            if event and event.widget not in (entry, dropdown):
                dropdown.place_forget()
        
        # Bind events
        entry_var.trace_add("write", update_dropdown)
        entry.bind("<KeyPress>", on_key_press)
        entry.bind("<FocusOut>", hide_dropdown)
        dropdown.bind("<Button-1>", on_dropdown_single_click)
        dropdown.bind("<Double-Button-1>", on_dropdown_double_click)
        
        # Also hide dropdown when clicking elsewhere
        root = entry_frame.winfo_toplevel()
        root.bind("<Button-1>", lambda e: hide_dropdown(e) if e.widget not in (entry, dropdown) else None)
        
        return entry_frame, entry
    
    def find_player_by_name(name):
        """Search for player by name (case-insensitive, partial match)"""
        name_lower = name.strip().lower()
        if not name_lower:
            return None
        
        # Search pitchers
        for p in all_pitchers:
            if name_lower in p.get("Name", "").lower():
                return ("pitcher", p)
        
        # Search batters
        for b in all_batters:
            if name_lower in b.get("Name", "").lower():
                return ("batter", b)
        
        return None
    
    def calculate_max_player_scores():
        """Calculate max pitcher and batter scores, and update draft pick base value"""
        nonlocal max_pitcher_score, max_batter_score, draft_pick_base_value
        
        max_pitcher_score = 0.0
        max_batter_score = 0.0
        
        # Find max pitcher score
        for pitcher in all_pitchers:
            scores = pitcher.get("Scores", {})
            total_score = scores.get("total", 0)
            if total_score > max_pitcher_score:
                max_pitcher_score = total_score
        
        # Find max batter score
        for batter in all_batters:
            scores = batter.get("Scores", {})
            total_score = scores.get("total", 0)
            if total_score > max_batter_score:
                max_batter_score = total_score
        
        # Calculate draft pick base value: Round 1, Pick 1 = 65% of max player score
        max_player_score = max(max_pitcher_score, max_batter_score)
        if max_player_score > 0:
            # For Round 1, Pick 1: pick_mult = 1.0, round_mult = 1.0
            # So base_value = target_value / (1.0 * 1.0) = target_value
            draft_pick_base_value = max_player_score * 0.65
        else:
            # Fallback to default if no players loaded
            draft_pick_base_value = 25.0
    
    def get_pick_exponential_multiplier(pick_number, round_num):
        """
        Get pick position multiplier using exponential curve for all picks.
        
        Args:
            pick_number: Draft pick number (1 to num_teams)
            round_num: Round number (affects flattening in later rounds)
        
        Returns:
            Multiplier value for the pick position
        """
        # Use exponential decay throughout
        # Pick 1 = 1.0, with exponential decay to pick num_teams
        # Formula: multiplier = base^((pick_number - 1) / scale_factor)
        # We want pick 1 = 1.0, pick num_teams ≈ 0.03
        
        if pick_number == 1:
            return 1.0
        
        if num_teams == 1:
            return 1.0
        
        # Calculate exponential decay factor
        # We want: 1.0 at pick 1, and approximately 0.03 at pick num_teams
        # Using: multiplier = e^(-decay_rate * (pick_number - 1))
        # Solve for decay_rate: 0.03 = e^(-decay_rate * (num_teams - 1))
        # decay_rate = -ln(0.03) / (num_teams - 1)
        import math
        target_final = 0.03
        decay_rate = -math.log(target_final) / (num_teams - 1)
        multiplier = math.exp(-decay_rate * (pick_number - 1))
        
        return multiplier
    
    def get_round_group_multiplier(round_num):
        """
        Get round multiplier based on round groupings with dramatic dropoffs.
        Dynamically generates multipliers based on num_rounds.
        
        Args:
            round_num: Round number (1 to num_rounds)
        
        Returns:
            Multiplier value for the round
        """
        if round_num < 1 or round_num > num_rounds:
            return 0.0001
        
        # Round 1: full value
        if round_num == 1:
            return 1.0
        
        # Round 2: dramatic dropoff
        if round_num == 2:
            return 0.12
        
        # Rounds 3-5: 50% decay each
        if round_num <= 5:
            prev_mult = 0.12 if round_num == 3 else get_round_group_multiplier(round_num - 1)
            return prev_mult * 0.5
        
        # Rounds 6-10: 70% decay each
        if round_num <= 10:
            prev_mult = get_round_group_multiplier(round_num - 1)
            return prev_mult * 0.7
        
        # Rounds 11+: 80% decay each
        prev_mult = get_round_group_multiplier(round_num - 1)
        return prev_mult * 0.8
    
    def get_position_importance_factor(round_num):
        """
        Get factor that reduces position importance in later rounds.
        
        Args:
            round_num: Round number (1 to num_rounds)
        
        Returns:
            Factor (1.0 for early rounds, <1.0 for later rounds)
        """
        if round_num <= 5:
            return 1.0  # Full position importance
        elif round_num <= 10:
            # Gradually reduce position importance
            return 1.0 - (round_num - 5) * 0.1  # 0.9, 0.8, 0.7, 0.6, 0.5
        else:
            # Minimal position importance in later rounds
            # Flatten to 0.3 and gradually reduce to 0.1
            # Scale based on num_rounds
            rounds_after_10 = min(round_num - 10, num_rounds - 10)
            total_late_rounds = max(1, num_rounds - 10)
            return max(0.1, 0.3 - rounds_after_10 * (0.2 / total_late_rounds))
    
    def calculate_draft_pick_value(round_num, position_in_standings):
        """
        Calculate draft pick value based on round and team position in standings.
        Uses exponential curve for top picks, dramatic round dropoffs, and
        diminishing position importance in later rounds.
        
        Args:
            round_num: Round number (1-20)
            position_in_standings: Team's position (1 = best team, 28 = worst team)
        
        Returns:
            dict with pick_number, value, and display string
        """
        # Validate inputs
        if round_num < 1 or round_num > num_rounds:
            return {
                "round": round_num,
                "pick_number": 0,
                "position_in_standings": position_in_standings,
                "value": 0.0,
                "display": f"Invalid round {round_num}"
            }
        
        if position_in_standings < 1 or position_in_standings > num_teams:
            return {
                "round": round_num,
                "pick_number": 0,
                "position_in_standings": position_in_standings,
                "value": 0.0,
                "display": f"Invalid position {position_in_standings}"
            }
        
        # Convert position to pick number (1 = best team → pick num_teams, num_teams = worst team → pick 1)
        pick_number = num_teams + 1 - position_in_standings
        
        # Get multipliers
        pick_multiplier = get_pick_exponential_multiplier(pick_number, round_num)
        round_multiplier = get_round_group_multiplier(round_num)
        position_importance = get_position_importance_factor(round_num)
        
        # For later rounds, apply position importance factor to flatten the curve
        # In early rounds, position matters fully. In later rounds, reduce the impact.
        if round_num > 5:
            # Get the average pick multiplier for this round to use as baseline
            # This represents what an "average" pick would be worth
            # Use middle picks based on num_teams instead of hardcoded values
            mid_pick_1 = (num_teams // 2)
            mid_pick_2 = (num_teams // 2) + 1
            avg_pick_multiplier = (get_pick_exponential_multiplier(mid_pick_1, round_num) + 
                                  get_pick_exponential_multiplier(mid_pick_2, round_num)) / 2
            
            # Blend between full position-based multiplier and average (flattened)
            # When position_importance = 0.3, picks are 70% similar to average, 30% different
            adjusted_pick_multiplier = (pick_multiplier * position_importance + 
                                      avg_pick_multiplier * (1 - position_importance))
        else:
            # Early rounds use full pick multiplier
            adjusted_pick_multiplier = pick_multiplier
        
        # Use dynamic base value (calculated from max player score)
        base_value = draft_pick_base_value
        
        # Calculate pick value
        pick_value = base_value * adjusted_pick_multiplier * round_multiplier
        
        # Ensure minimum value that scales with round number
        # Base minimum: 0.1% of top pick
        # Round-specific minimum ensures earlier rounds always have higher minimums
        base_min = draft_pick_base_value * 0.001
        # Scale minimum down by 2% per round, so round 20 has ~62% of round 1's minimum
        round_min_factor = max(0.4, 1.0 - (round_num - 1) * 0.02)
        min_value = base_min * round_min_factor
        pick_value = max(pick_value, min_value)
        
        return {
            "round": round_num,
            "pick_number": pick_number,
            "position_in_standings": position_in_standings,
            "value": round(pick_value, 2),
            "display": f"Round {round_num}, Pick #{pick_number}"
        }
    
    def show_add_draft_pick_dialog(team_picks_list, team_name):
        """Show dialog to add a draft pick"""
        dialog = tk.Toplevel()
        dialog.title(f"Add Draft Pick - {team_name}")
        dialog.configure(bg="#1e1e1e")
        dialog.transient()
        dialog.grab_set()
        
        # Center the dialog
        dialog.update_idletasks()
        width = 400
        height = 280
        x = (dialog.winfo_screenwidth() // 2) - (width // 2)
        y = (dialog.winfo_screenheight() // 2) - (height // 2)
        dialog.geometry(f"{width}x{height}+{x}+{y}")
        
        # Round selection
        round_frame = tk.Frame(dialog, bg="#1e1e1e")
        round_frame.pack(fill="x", padx=15, pady=(15, 10))
        
        tk.Label(
            round_frame,
            text="Round:",
            bg="#1e1e1e",
            fg="#d4d4d4",
            font=font
        ).pack(side="left", padx=(0, 10))
        
        round_var = tk.StringVar(value="1")
        round_combo = ttk.Combobox(
            round_frame,
            textvariable=round_var,
            values=[str(i) for i in range(1, num_rounds + 1)],
            state="readonly",
            width=15
        )
        round_combo.pack(side="left")
        
        # Position in standings - use a two-row layout for clarity
        position_frame = tk.Frame(dialog, bg="#1e1e1e")
        position_frame.pack(fill="x", padx=15, pady=10)
        
        position_label_frame = tk.Frame(position_frame, bg="#1e1e1e")
        position_label_frame.pack(fill="x", pady=(0, 5))
        
        tk.Label(
            position_label_frame,
            text="Position in Standings:",
            bg="#1e1e1e",
            fg="#d4d4d4",
            font=font
        ).pack(side="left")
        
        tk.Label(
            position_label_frame,
            text=f"(1 = best team, {num_teams} = worst team)",
            bg="#1e1e1e",
            fg="#888888",
            font=(font[0], font[1] - 2)
        ).pack(side="left", padx=(10, 0))
        
        position_input_frame = tk.Frame(position_frame, bg="#1e1e1e")
        position_input_frame.pack(fill="x")
        
        position_var = tk.StringVar(value="14")
        position_entry = tk.Entry(
            position_input_frame,
            textvariable=position_var,
            width=15,
            bg="#000000",
            fg="#d4d4d4",
            font=font,
            justify="center"
        )
        position_entry.pack(side="left")
        
        # Value display
        value_label = tk.Label(
            dialog,
            text="Value: --",
            bg="#1e1e1e",
            fg="#00ff7f",
            font=font
        )
        value_label.pack(pady=10)
        
        def update_value_display(*args):
            try:
                round_num = int(round_var.get())
                position = int(position_var.get())
                if 1 <= round_num <= num_rounds and 1 <= position <= num_teams:
                    pick_data = calculate_draft_pick_value(round_num, position)
                    value_label.config(text=f"Value: {pick_data['value']} (Pick #{pick_data['pick_number']})")
                else:
                    value_label.config(text="Value: -- (Invalid input)")
            except ValueError:
                value_label.config(text="Value: -- (Invalid input)")
        
        round_var.trace("w", update_value_display)
        position_var.trace("w", update_value_display)
        update_value_display()
        
        # Buttons
        button_frame = tk.Frame(dialog, bg="#1e1e1e")
        button_frame.pack(pady=10)
        
        def add_pick():
            try:
                round_num = int(round_var.get())
                position = int(position_var.get())
                
                if not (1 <= round_num <= num_rounds):
                    messagebox.showerror("Error", f"Round must be between 1 and {num_rounds}")
                    return
                
                if not (1 <= position <= num_teams):
                    messagebox.showerror("Error", f"Position must be between 1 and {num_teams}")
                    return
                
                pick_data = calculate_draft_pick_value(round_num, position)
                team_picks_list.append(pick_data)
                dialog.destroy()
                
                # Update display
                if team_name == "Team A":
                    update_team_table(team_a_table, team_a_players, team_a_id_map, team_a_picks)
                else:
                    update_team_table(team_b_table, team_b_players, team_b_id_map, team_b_picks)
                update_summaries()
            except ValueError:
                messagebox.showerror("Error", "Please enter valid numbers")
        
        ttk.Button(button_frame, text="Add", command=add_pick).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side="left", padx=5)
    
    def calculate_team_totals(players, picks=None):
        """Calculate totals for a team with normalized pitcher/batter scores"""
        pitchers_current = 0.0
        pitchers_potential = 0.0
        pitchers_total = 0.0
        batters_current = 0.0
        batters_potential = 0.0
        batters_defense = 0.0
        batters_total = 0.0
        draft_picks_value = 0.0
        
        # Normalization factors (scale to 100 for max player)
        pitcher_norm_factor = 100.0 / max_pitcher_score if max_pitcher_score > 0 else 1.0
        batter_norm_factor = 100.0 / max_batter_score if max_batter_score > 0 else 1.0
        
        for player in players:
            player_type = player.get("_type")
            scores = player.get("Scores", {})
            
            if player_type == "pitcher":
                # Normalize pitcher scores
                curr = scores.get("curr_total", 0) * pitcher_norm_factor
                pot = (scores.get("core_potential", 0) + scores.get("pitches_potential", 0)) * pitcher_norm_factor
                total = scores.get("total", 0) * pitcher_norm_factor
                
                pitchers_current += curr
                pitchers_potential += pot
                pitchers_total += total
            elif player_type == "batter":
                # Normalize batter scores
                curr = scores.get("offense", 0) * batter_norm_factor
                pot = scores.get("offense_potential", 0) * batter_norm_factor
                defense = scores.get("defense", 0) * batter_norm_factor
                total = scores.get("total", 0) * batter_norm_factor
                
                batters_current += curr
                batters_potential += pot
                batters_defense += defense
                batters_total += total
        
        # Add draft pick values (already normalized relative to max player)
        if picks:
            for pick in picks:
                draft_picks_value += pick.get("value", 0)
        
        team_current = pitchers_current + batters_current
        team_potential = pitchers_potential + batters_potential
        team_total = pitchers_total + batters_total + draft_picks_value
        
        return {
            "pitchers_current": round(pitchers_current, 2),
            "pitchers_potential": round(pitchers_potential, 2),
            "pitchers_total": round(pitchers_total, 2),
            "batters_current": round(batters_current, 2),
            "batters_potential": round(batters_potential, 2),
            "batters_defense": round(batters_defense, 2),
            "batters_total": round(batters_total, 2),
            "draft_picks_value": round(draft_picks_value, 2),
            "team_current": round(team_current, 2),
            "team_potential": round(team_potential, 2),
            "team_total": round(team_total, 2)
        }
    
    def update_team_table(table, players, id_map, picks=None):
        """Update a team's table display"""
        table.delete(*table.get_children())
        id_map.clear()
        
        # Display players
        for player in players:
            name = player.get("Name", "")
            team = player.get("ORG", "")
            pos = player.get("POS", "")
            age = player.get("Age", "")
            scores = player.get("Scores", {})
            player_type = player.get("_type")
            
            if player_type == "pitcher":
                current = scores.get("curr_total", 0)
                potential = scores.get("core_potential", 0) + scores.get("pitches_potential", 0)
                defense = ""  # Pitchers don't have defense
                total = scores.get("total", 0)
            else:  # batter
                current = scores.get("offense", 0)
                potential = scores.get("offense_potential", 0)
                defense = scores.get("defense", 0)
                total = scores.get("total", 0)
            
            values = (
                name,
                team,
                pos,
                age,
                round(current, 2),
                round(potential, 2),
                round(defense, 2) if defense != "" else "",
                round(total, 2)
            )
            
            iid = table.insert("", "end", values=values)
            player_id = player.get("ID", "")
            if player_id:
                id_map[iid] = player_id
        
        # Display draft picks
        if picks:
            for pick in picks:
                display = pick.get("display", "")
                value = pick.get("value", 0)
                
                values = (
                    display,  # Name column
                    "",      # Team column
                    "PICK",  # POS column
                    "",      # Age column
                    "",      # Current column
                    "",      # Potential column
                    "",      # Defense column
                    round(value, 2)  # Total column
                )
                
                iid = table.insert("", "end", values=values, tags=("draft_pick",))
                # Store pick data in id_map with negative key to distinguish from players
                id_map[iid] = f"pick_{pick.get('round')}_{pick.get('pick_number')}"
    
    def update_summaries():
        """Update both team summaries and comparison"""
        # Team A totals
        team_a_totals = calculate_team_totals(team_a_players, team_a_picks)
        
        # Team B totals
        team_b_totals = calculate_team_totals(team_b_players, team_b_picks)
        
        # Update Team A summary
        summary_lines = ["Team A Totals:"]
        if team_a_totals["pitchers_total"] > 0 or team_a_totals["batters_total"] > 0:
            if team_a_totals["pitchers_total"] > 0:
                summary_lines.append(f"  Pitchers - Current: {team_a_totals['pitchers_current']}, "
                                    f"Potential: {team_a_totals['pitchers_potential']}, "
                                    f"Total: {team_a_totals['pitchers_total']}")
            if team_a_totals["batters_total"] > 0:
                summary_lines.append(f"  Batters - Current: {team_a_totals['batters_current']}, "
                                    f"Potential: {team_a_totals['batters_potential']}, "
                                    f"Defense: {team_a_totals['batters_defense']}, "
                                    f"Total: {team_a_totals['batters_total']}")
        if team_a_totals["draft_picks_value"] > 0:
            summary_lines.append(f"  Draft Picks Value: {team_a_totals['draft_picks_value']}")
        summary_lines.append(f"  Team Total - Current: {team_a_totals['team_current']}, "
                           f"Potential: {team_a_totals['team_potential']}, "
                           f"Total: {team_a_totals['team_total']}")
        team_a_summary_label.config(text="\n".join(summary_lines))
        
        # Update Team B summary
        summary_lines = ["Team B Totals:"]
        if team_b_totals["pitchers_total"] > 0 or team_b_totals["batters_total"] > 0:
            if team_b_totals["pitchers_total"] > 0:
                summary_lines.append(f"  Pitchers - Current: {team_b_totals['pitchers_current']}, "
                                    f"Potential: {team_b_totals['pitchers_potential']}, "
                                    f"Total: {team_b_totals['pitchers_total']}")
            if team_b_totals["batters_total"] > 0:
                summary_lines.append(f"  Batters - Current: {team_b_totals['batters_current']}, "
                                    f"Potential: {team_b_totals['batters_potential']}, "
                                    f"Defense: {team_b_totals['batters_defense']}, "
                                    f"Total: {team_b_totals['batters_total']}")
        if team_b_totals["draft_picks_value"] > 0:
            summary_lines.append(f"  Draft Picks Value: {team_b_totals['draft_picks_value']}")
        summary_lines.append(f"  Team Total - Current: {team_b_totals['team_current']}, "
                           f"Potential: {team_b_totals['team_potential']}, "
                           f"Total: {team_b_totals['team_total']}")
        team_b_summary_label.config(text="\n".join(summary_lines))
        
        # Update comparison
        comp_lines = []
        
        # Current Score comparison
        curr_diff = team_a_totals["team_current"] - team_b_totals["team_current"]
        if curr_diff > 0:
            winner = "Team A"
            color = "#00ff7f"
        elif curr_diff < 0:
            winner = "Team B"
            color = "#00ff7f"
        else:
            winner = "Tie"
            color = "#d4d4d4"
        comp_lines.append(f"Current Score: Team A ({team_a_totals['team_current']}) vs "
                        f"Team B ({team_b_totals['team_current']}) - Winner: {winner}")
        
        # Potential Score comparison
        pot_diff = team_a_totals["team_potential"] - team_b_totals["team_potential"]
        if pot_diff > 0:
            winner = "Team A"
        elif pot_diff < 0:
            winner = "Team B"
        else:
            winner = "Tie"
        comp_lines.append(f"Potential Score: Team A ({team_a_totals['team_potential']}) vs "
                        f"Team B ({team_b_totals['team_potential']}) - Winner: {winner}")
        
        # Draft Picks comparison
        picks_diff = team_a_totals["draft_picks_value"] - team_b_totals["draft_picks_value"]
        if picks_diff > 0:
            picks_winner = "Team A"
        elif picks_diff < 0:
            picks_winner = "Team B"
        else:
            picks_winner = "Tie"
        comp_lines.append(f"Draft Picks Value: Team A ({team_a_totals['draft_picks_value']}) vs "
                        f"Team B ({team_b_totals['draft_picks_value']}) - Winner: {picks_winner}")
        
        # Total Score comparison
        total_diff = team_a_totals["team_total"] - team_b_totals["team_total"]
        if total_diff > 0:
            winner = "Team A"
            overall_winner = "Team A"
        elif total_diff < 0:
            winner = "Team B"
            overall_winner = "Team B"
        else:
            winner = "Tie"
            overall_winner = "Tie"
        comp_lines.append(f"Total Score: Team A ({team_a_totals['team_total']}) vs "
                        f"Team B ({team_b_totals['team_total']}) - Winner: {winner}")
        comp_lines.append("")
        comp_lines.append(f"Overall Trade Winner: {overall_winner}")
        
        comparison_text.config(text="\n".join(comp_lines))
        
        # Highlight overall winner
        if overall_winner == "Team A":
            comparison_text.config(fg="#00ff7f")
        elif overall_winner == "Team B":
            comparison_text.config(fg="#00ff7f")
        else:
            comparison_text.config(fg="#d4d4d4")
    
    def add_player_to_team(entry_var, team_players, team_table, team_id_map, team_name):
        """Add a player to a team"""
        name = entry_var.get().strip()
        if not name:
            return
        
        result = find_player_by_name(name)
        if not result:
            messagebox.showerror("Player Not Found", f"Could not find player: {name}")
            return
        
        player_type, player = result
        player_id = player.get("ID", "")
        
        # Check for duplicates
        for existing in team_players:
            if existing.get("ID") == player_id:
                messagebox.showwarning("Duplicate Player", f"{player.get('Name', '')} is already in {team_name}")
                return
        
        # Add player type marker
        player_copy = player.copy()
        player_copy["_type"] = player_type
        team_players.append(player_copy)
        
        # Update display
        if team_table == team_a_table:
            update_team_table(team_table, team_players, team_id_map, team_a_picks)
        else:
            update_team_table(team_table, team_players, team_id_map, team_b_picks)
        update_summaries()
        
        # Clear entry
        entry_var.set("")
    
    def remove_player_from_team(table, team_players, team_id_map, team_picks=None):
        """Remove selected player or draft pick from team"""
        selection = table.selection()
        if not selection:
            return
        
        for item_id in selection:
            item_id_str = team_id_map.get(item_id)
            if item_id_str:
                # Check if it's a draft pick (starts with "pick_")
                if item_id_str.startswith("pick_"):
                    # Remove draft pick
                    if team_picks:
                        # Parse pick identifier: "pick_round_picknumber"
                        parts = item_id_str.split("_")
                        if len(parts) >= 3:
                            try:
                                round_num = int(parts[1])
                                pick_num = int(parts[2])
                                team_picks[:] = [p for p in team_picks 
                                                if not (p.get("round") == round_num and p.get("pick_number") == pick_num)]
                            except ValueError:
                                pass
                else:
                    # Remove player
                    team_players[:] = [p for p in team_players if p.get("ID") != item_id_str]
                table.delete(item_id)
                del team_id_map[item_id]
        
        if table == team_a_table:
            update_team_table(table, team_players, team_id_map, team_a_picks)
        else:
            update_team_table(table, team_players, team_id_map, team_b_picks)
        update_summaries()
    
    # Set up double-click handlers for both tables
    make_treeview_open_link_handler(team_a_table, team_a_id_map, lambda pid: player_url_template.format(pid=pid))
    make_treeview_open_link_handler(team_b_table, team_b_id_map, lambda pid: player_url_template.format(pid=pid))
    
    # Set up callbacks for autocomplete selection
    def team_a_select_callback():
        add_player_to_team(team_a_entry_var, team_a_players, team_a_table, team_a_id_map, "Team A")
    
    def team_b_select_callback():
        add_player_to_team(team_b_entry_var, team_b_players, team_b_table, team_b_id_map, "Team B")
    
    # Set the callbacks in the reference lists
    team_a_callback_ref[0] = team_a_select_callback
    team_b_callback_ref[0] = team_b_select_callback
    
    # Bind add buttons
    team_a_add_btn.config(command=team_a_select_callback)
    team_b_add_btn.config(command=team_b_select_callback)
    
    # Bind draft pick buttons
    team_a_add_pick_btn.config(command=lambda: show_add_draft_pick_dialog(team_a_picks, "Team A"))
    team_b_add_pick_btn.config(command=lambda: show_add_draft_pick_dialog(team_b_picks, "Team B"))
    
    # Bind Enter key to entries (autocomplete handles this, but we need fallback)
    def team_a_enter_handler(e):
        if not team_a_entry_var.get().strip():
            return
        team_a_select_callback()
    
    def team_b_enter_handler(e):
        if not team_b_entry_var.get().strip():
            return
        team_b_select_callback()
    
    team_a_entry.bind("<Return>", team_a_enter_handler)
    team_b_entry.bind("<Return>", team_b_enter_handler)
    
    # Add remove buttons
    team_a_remove_btn = ttk.Button(team_a_entry_frame, text="Remove Selected", 
                                   command=lambda: remove_player_from_team(
                                       team_a_table, team_a_players, team_a_id_map, team_a_picks
                                   ))
    team_a_remove_btn.pack(side="left", padx=(5, 0))
    
    team_b_remove_btn = ttk.Button(team_b_entry_frame, text="Remove Selected",
                                   command=lambda: remove_player_from_team(
                                       team_b_table, team_b_players, team_b_id_map, team_b_picks
                                   ))
    team_b_remove_btn.pack(side="left", padx=(5, 0))
    
    class TradeTab:
        def refresh(self, pitchers, batters):
            all_pitchers.clear()
            all_batters.clear()
            all_pitchers.extend(pitchers)
            all_batters.extend(batters)
            # Calculate max scores and update draft pick base value
            calculate_max_player_scores()
            # Note: We don't clear draft picks on refresh - user may want to keep them
            # Don't clear existing trade data, just update available players
    
    return TradeTab()

