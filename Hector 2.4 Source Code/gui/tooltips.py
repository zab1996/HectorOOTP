import tkinter as tk

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

def attach_treeview_heading_tooltips(treeview, col_tooltips):
    """
    Attach tooltips to column headers of a ttk.Treeview.
    col_tooltips: dict mapping column names ("Pitch Score" etc) to tooltip strings.
    """
    tooltip = [None]  # [Toplevel] or None
    label = [None]    # [Label] inside the toplevel, so we can update its text
    
    def show_tooltip(text, event):
        if tooltip[0] is None:
            tooltip[0] = tk.Toplevel(treeview)
            tooltip[0].withdraw()
            tooltip[0].overrideredirect(True)
            label[0] = tk.Label(
                tooltip[0], text=text, bg="#333", fg="#fff",
                font=("Consolas", 10), justify="left", padx=5, pady=3
            )
            label[0].pack()
        else:
            label[0].configure(text=text)
        
        # Calculate ideal position (default right of mouse)
        x = treeview.winfo_rootx() + event.x + 20
        y = treeview.winfo_rooty() + 20
        
        tooltip[0].update_idletasks()  # Ensure width/height are up-to-date
        tip_w = tooltip[0].winfo_width()
        tip_h = tooltip[0].winfo_height()
        
        # Get boundaries of root window and screen
        root = treeview.winfo_toplevel()
        root_x = root.winfo_rootx()
        root_y = root.winfo_rooty()
        root_w = root.winfo_width()
        root_h = root.winfo_height()
        screen_w = treeview.winfo_screenwidth()
        screen_h = treeview.winfo_screenheight()
        
        # Constrain right boundary (window/screen)
        if x + tip_w > root_x + root_w - 8:
            x = root_x + root_w - tip_w - 8
        if x + tip_w > screen_w - 8:
            x = screen_w - tip_w - 8
        if x < root_x + 4:
            x = root_x + 4
        
        # Constrain bottom boundary (window/screen)
        if y + tip_h > root_y + root_h - 8:
            y = root_y + root_h - tip_h - 8
        if y + tip_h > screen_h - 8:
            y = screen_h - tip_h - 8
        if y < root_y + 4:
            y = root_y + 4
        
        tooltip[0].geometry(f"+{x}+{y}")
        tooltip[0].deiconify()
    
    def hide_tooltip(_):
        if tooltip[0]:
            tooltip[0].withdraw()
    
    def motion(event):
        region = treeview.identify_region(event.x, event.y)
        if region == "heading":
            col = treeview.identify_column(event.x)
            idx = int(col[1:]) - 1
            columns = treeview["columns"]
            if idx < len(columns):
                col_name = columns[idx]
                text = col_tooltips.get(col_name)
                if text:
                    show_tooltip(text, event)
                    return
        hide_tooltip(event)
    
    treeview.bind("<Motion>", motion, add='+')
    treeview.bind("<Leave>", hide_tooltip, add='+')

# Rest of the file remains the same with all the tooltip constants...
PITCHER_COL_TOOLTIPS = {
    "Pitch Score": (
        "Pitch Score:\n"
        "Weighted sum of this player's pitch arsenal grades only—\n"
        "(current Fastball, Slider, Curveball, etc.)\n"
        "Uses weights set in pitcher_weights.py.\n"
        "Does NOT include Stuff, Movement, or Control."
    ),
    "Pitch Pot. Score": (
        "Pitch Pot. Score:\n"
        "Weighted sum of EACH pitch type's potential (future) grade only—\n"
        "(potential Fastball, Slider, Curveball, ...)\n"
        "All weighted as in pitcher_weights.py.\n"
        "Does NOT include Stuff Pot., Movement Pot., or Control Pot."
    ),
    "Potential Score": (
        "Potential Total Score:\n"
        "Sum of ALL potential-based core skills (Stuff Pot., Movement Pot., Control Pot.)\n"
        "+ all pitch potential grades, with weights from pitcher_weights.py.\n"
        "Shows a pitcher's overall future ceiling."
    ),
    "Total Score": (
        "Total Score:\n"
        "FULL combined value for a pitcher:\n"
        "- All current skills (Stuff, Movement, Control)\n"
        "- All current arsenal grades\n"
        "- All potentials\n"
        "- Stamina, ground/fly ratio, #pitches, scout accuracy, etc.\n"
        "See pitcher_weights.py for full formula."
    ),
    "Current Score": (
        "Current Total Score:\n"
        "Combines ONLY the CURRENT (not potential/future) core pitching attributes (Stuff, Movement, Control)\n"
        "+ all current pitch grades\n"
        "+ all current non-potential weighted factors (stamina, #pitches, etc).\n"
        "Represents true present skill."
    ),
}

BATTER_COL_TOOLTIPS = {
    "Offense": (
        "Offense:\n"
        "Weighted sum of current main batting skills:\n"
        "Contact, Gap, Power, Eye, K's\n"
        "Weights from 'overall' in batter_weights.py."
    ),
    "Offense Pot.": (
        "Offense Pot.:\n"
        "Same formula as Offense,\n"
        "but uses potential/future ratings only\n"
        "(e.g., Contact Pot., Gap Pot., ...)\n"
        "Weights from 'potential' in batter_weights.py."
    ),
    "Defense": (
        "Defense:\n"
        "Weighted sum of all relevant fielding skills, including\n"
        "- Range, Error, Arm\n"
        "- Catcher skills if C, OF skills if OF, IF skills if IF\n"
        "Formula adapts to position per batter_weights.py."
    ),
    "Total Score": (
        "Total Score:\n"
        "Sum of offense, offense potential, defense, baserunning,\n"
        "injury risk, and scouting accuracy, all with weights from batter_weights.py.\n"
        "Represents full combined value."
    ),
}

TEAMS_COL_TOOLTIPS = {
    "SP Curr. Score": (
        "SP Curr. Score:\n"
        "Sum of 'Curr.Total Score' for starting pitchers (POS=SP).\n"
        "\n"
        "Reflects only current pitching skills (no potential)."
    ),
    "RP Curr. Score": (
        "RP Curr. Score:\n"
        "Sum of 'Curr.Total Score' for relievers (POS=RP or CL).\n"
        "\n"
        "Current skills only; no potential ratings included."
    ),
    "Team Pitching Curr. Score": (
        "Team Pitching Curr. Score:\n"
        "SP Curr. Score + RP Curr. Score for this team.\n"
        "\n"
        "Represents overall current pitching strength."
    ),
    "SP Pot. Score": (
        "SP Pot. Score:\n"
        "Sum of the potential-only scores (core and arsenal potentials only) for all starting pitchers (POS=SP).\n"
        "\n"
        "NOTE: ONLY SCOUTED POTENTIAL SKILLS ARE INCLUDED.\n"
        "Projected values for meta attributes like stamina, velocity, or number of pitches are NOT included.\n"
        "This is why a team's pitching potential score might be lower than its current pitching score."
    ),
    "RP Pot. Score": (
        "RP Pot. Score:\n"
        "Sum of potential-only scores for all relievers (POS=RP or CL), including only skills with a potential rating.\n"
        "\n"
        "NOTE: ONLY SCOUTED POTENTIAL SKILLS ARE INCLUDED.\n"
        "Meta attributes (stamina, pitch variety, etc.) are NOT projected and not counted for potential.\n"
        "This is why a team's pitching potential score may be lower than its current pitching score."
    ),
    "Team Pitching Pot. Score": (
        "Team Pitching Pot. Score:\n"
        "SP Pot. Score + RP Pot. Score for this team — total future-oriented (potential-only) scores for pitchers.\n"
        "\n"
        "NOTE: ONLY SKILLS THAT HAVE A SCOUTED POTENTIAL RATING IN OOTP ARE INCLUDED;\n"
        "Meta attributes (like stamina, #pitches, ground/fly ratio) are not projected and not included in this score.\n"
        "This is why 'Team Pitching Pot. Score' can sometimes be lower than 'Team Pitching Curr. Score'."
    ),
    "Batters Offense Curr.": (
        "Batters Offense Current:\n"
        "Sum of all batters' 'Offense' scores on this team.\n"
        "(Current batting skill ratings, using weights from batter_weights.py.)"
    ),
    "Batters Offense Pot.": (
        "Batters Offense Pot.:\n"
        "Sum of all batters' 'Offense Pot.' (potential offense) scores.\n"
        "(Future/potential batting skill ratings only; weights from batter_weights.py, 'potential' section.)"
    ),
    "Team Defense": (
        "Team Defense:\n"
        "Sum of all batters' 'Defense' scores on this team.\n"
        "Reflects total fielding value across all positions, weighted by batter_weights.py."
    ),
    "Total Team Score": (
        "Total Team Score:\n"
        "Team Pitching Curr. Score + Batters Offense Current + Team Defense.\n"
        "\n"
        "This gives each team's overall present-day value across pitching, offense, and defense."
    ),
}

def add_search_tooltip(widget, tab_type="pitcher"):
    """
    Adds tooltip to the search entry widget for pitchers or batters.
    Parameters:
    widget: The Tkinter widget (usually ttk.Entry) to attach the tooltip to.
    tab_type: "pitcher" or "batter" to determine appropriate tooltip text.
    """
    if tab_type == "pitcher":
        tip_text = (
            "Search tips:\n"
            "- Filter by team: CAS, ATL\n"
            "- Filter by position: SP, RP\n"
            "- Numeric filters with >, <, >=, <=, = for Age, e.g. '>25'\n"
            "- Combine filters, e.g. 'CAS SP >25'"
        )
    elif tab_type == "batter":
        tip_text = (
            "Search tips:\n"
            "- Filter by team: CAS, ATL\n"
            "- Filter by position: C, 1B, 2B, ...\n"
            "- Numeric filters with >, <, >=, <=, = for Age, e.g. '<30'\n"
            "- Combine filters, e.g. 'ATL 2B <30'"
        )
    else:
        tip_text = "Search the list"
    
    from .tooltips import create_tooltip
    create_tooltip(widget, tip_text)

# ------------------------
# Highlight tag explanations (centralized)
# ------------------------

HIGHLIGHT_EXPLANATIONS = {
    "rp_sp_potential": (
        "This RP has 3 or more pitches and stamina ≥ 50.\n"
        "Candidate for training as a starting pitcher (SP)."
    ),
    "1b_to_3b": (
        "1B meets all minimums for 3B (Range ≥ 50, Arm ≥ 55, Error ≥ 45):\n"
        "Candidate for training as a third base."
    ),
    "2b_to_ss": (
        "2B meets all minimums for SS (Range ≥ 60, Arm ≥ 50, Error ≥ 50, DP ≥ 50):\n"
        "Candidate for training as a shortstop."
    ),
}

def attach_treeview_row_tooltips(tree, highlight_explanations=HIGHLIGHT_EXPLANATIONS):
    """
    Show a tooltip when hovering any row with a recognized highlight tag.
    Args:
    tree: ttk.Treeview
    highlight_explanations: dict mapping tag -> explanation text
    """
    import tkinter as tk
    
    tooltip = [None]
    
    def show_tooltip(event):
        row_id = tree.identify_row(event.y)
        tags = tree.item(row_id, "tags") if row_id else ()
        
        # Collect explanations for the row (allow stacking)
        reasons = [highlight_explanations[tag] for tag in tags if tag in highlight_explanations]
        
        if reasons and row_id:
            reason = "\n".join(reasons)
            x = tree.winfo_rootx() + event.x + 18
            y = tree.winfo_rooty() + event.y + 18
            
            if tooltip[0] is not None:
                try: 
                    tooltip[0].destroy()
                except: 
                    pass
            
            tooltip[0] = tk.Toplevel(tree)
            tooltip[0].overrideredirect(True)
            tooltip[0].geometry(f"+{x}+{y}")
            
            label = tk.Label(
                tooltip[0], text=reason, bg="#333", fg="#fff",
                font=("Consolas", 10), padx=8, pady=4, justify="left", wraplength=400
            )
            label.pack()
        else:
            if tooltip[0] is not None:
                tooltip[0].destroy()
                tooltip[0] = None
    
    def hide_tooltip(event=None):
        if tooltip[0] is not None:
            tooltip[0].destroy()
            tooltip[0] = None
    
    tree.bind("<Motion>", show_tooltip, add='+')
    tree.bind("<Leave>", hide_tooltip, add='+')

BUTTON_TOOLTIPS = {
    "top_batters_by_pos": (
        "Show the Top 10 batters at each position by Total Score.\n"
        "Results are grouped by position and respond instantly to your search bar, age filters (e.g. '<25', '>=21').\n"
        "Tip: Use the search bar to filter for young players—like '<23' or '=19'—and view the best options by age!"
    ),
    "show_all_batters": (
        "Restore the sortable, full list of all batters matching your current filters and search—including age or text queries."
    ),
    "top_pitchers_by_pos": (
        "Show the Top 20 pitchers at each position (SP, RP) by Total Score.\n"
        "Results are grouped by SP/RP and update instantly with your search bar, age filters (e.g. '<26').\n"
        "Tip: Filter for your top young arms—try searching '<24' or '=20' to get the best under that age!"
    ),
    "show_all_pitchers": (
        "Restore the sortable, full list of all pitchers, using whatever search or filters you have set—including age filters."
    ),
}

def add_button_tooltip(widget, key):
    text = BUTTON_TOOLTIPS.get(key)
    if text:
        import tkinter as tk
        
        tooltip = tk.Toplevel(widget)
        tooltip.withdraw()
        tooltip.overrideredirect(True)
        
        label = tk.Label(tooltip, text=text, bg="#333", fg="#fff", font=("Consolas", 10), justify="left")
        label.pack()
        
        def enter(event):
            x = widget.winfo_rootx() + 16
            y = widget.winfo_rooty() + widget.winfo_height() + 8
            tooltip.geometry(f"+{x}+{y}")
            tooltip.deiconify()
        
        def leave(event):
            tooltip.withdraw()
        
        widget.bind("<Enter>", enter)
        widget.bind("<Leave>", leave)
