import tkinter as tk
import sys
from tkinter import ttk, messagebox
import importlib
import importlib.util
from pathlib import Path

from pitchers import load_pitchers_data, calculate_score
from batters import load_batters_data, calculate_batter_score

from .style import setup_theme
from .pitcher_tab import add_pitcher_tab
from .batter_tab import add_batter_tab
from .teams_tab import add_teams_tab

REQUIRED_PITCHER_FIELDS = [
    "ID","ORG","POS","Name","Age","B","T","OVR","POT","Prone","STU","MOV","CON",
    "STU P","MOV P","CON P","FB","FBP","CH","CHP","CB","CBP","SL","SLP","SI","SIP",
    "SP","SPP","CT","CTP","FO","FOP","CC","CCP","SC","SCP","KC","KCP","KN","KNP",
    "PIT","VELO","STM","G/F","HLD","SctAcc"
]
REQUIRED_BATTER_FIELDS = [
    "ID","POS","Name","ORG","Age","B","Prone","OVR","POT","CON","GAP","POW","EYE","K's",
    "CON P","GAP P","POW P","EYE P","K P","C ABI","C FRM","C ARM","IF RNG",
    "IF ERR","IF ARM","TDP","OF RNG","OF ERR","OF ARM","SPE","STE","RUN","SctAcc"
]

# Globals to hold the currently loaded weights
section_weights = None          # For pitcher weights
batter_section_weights = None   # For batter weights


import sys
import os
from pathlib import Path

if getattr(sys, 'frozen', False):
    # Running in PyInstaller bundle
    base_path = Path(sys.executable).parent  # Location of the executable
else:
    # Running normally in Python environment
    base_path = Path(__file__).parent.parent  # Your normal project root or weights folder

WEIGHTS_DIR = base_path  # or base_path / "weights" if you keep them in a subfolder

def import_weights_module(module_name):
    module_path = WEIGHTS_DIR / f"{module_name}.py"
    if not module_path.exists():
        raise FileNotFoundError(f"Weight file not found: {module_path}")
    spec = importlib.util.spec_from_file_location(module_name, str(module_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module



def import_weights_module(module_name):
    """
    Dynamically imports (or reloads) the specified weights module from disk.
    """
    module_path = WEIGHTS_DIR / f"{module_name}.py"
    if module_name in sys.modules:
        importlib.reload(sys.modules[module_name])
        module = sys.modules[module_name]
    else:
        spec = importlib.util.spec_from_file_location(module_name, str(module_path))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sys.modules[module_name] = module
    return module

def reload_weights():
    """
    Reload pitcher_weights and batter_weights modules and update global variables.
    """
    global section_weights, batter_section_weights

    pitcher_weights_module = import_weights_module("pitcher_weights")
    batter_weights_module = import_weights_module("batter_weights")

    section_weights = pitcher_weights_module.section_weights
    batter_section_weights = batter_weights_module.section_weights

def validate_fields(players, required_fields):
    missing_fields = set()
    for player in players:
        for field in required_fields:
            if field not in player or player[field] in [None, ""]:
                missing_fields.add(field)
    return missing_fields

def build_gui():
    root = tk.Tk()
    root.title("Hector 2.1.1")
    root.geometry("1500x850")
    root.configure(bg="#1e1e1e")  # Main background - very dark gray (near black)
    font = ("Consolas", 11)

    # Apply your theme setup if exists (optional)
    setup_theme(font)

    style = ttk.Style(root)

    # Use 'clam' theme as basis for easier color customizations
    style.theme_use('clam')
    # Scrollbars style
    style.configure('Vertical.TScrollbar', background='#1e1e1e', troughcolor='#1e1e1e', bordercolor='#1e1e1e')
    style.configure('Horizontal.TScrollbar', background='#1e1e1e', troughcolor='#1e1e1e', bordercolor='#1e1e1e')
    style.map('Vertical.TScrollbar',
          background=[('disabled', '#1e1e1e'), ('!disabled', '#000000')],
          troughcolor=[('disabled', '#1e1e1e'), ('!disabled', '#1e1e1e')],
          bordercolor=[('disabled', '#1e1e1e'), ('!disabled', '#1e1e1e')])

    style.map('Horizontal.TScrollbar',
          background=[('disabled', '#1e1e1e'), ('!disabled', '#000000')],
          troughcolor=[('disabled', '#1e1e1e'), ('!disabled', '#1e1e1e')],
          bordercolor=[('disabled', '#1e1e1e'), ('!disabled', '#1e1e1e')])


    # General colors for standard widgets
    style.configure('.', 
                    background='#1e1e1e', 
                    foreground='#d4d4d4', 
                    fieldbackground='#1e1e1e',
                    font=font)

    # Style for ttk.Frame (so ttk frames get dark background)
    style.configure('TFrame', background='#1e1e1e')

    # Style for ttk.Label
    style.configure('TLabel', background='#1e1e1e', foreground='#d4d4d4')

    # Style Treeview widget
    style.configure('Treeview',
                    background='#1e1e1e',
                    foreground='#d4d4d4',
                    fieldbackground='#1e1e1e',
                    bordercolor='#1e1e1e')
    style.map('Treeview',
              background=[('selected', '#0078d7')],
              foreground=[('selected', '#ffffff')])

    style.map('Treeview.Heading',
          background=[
              ('active', '#232e23'),       # slightly greenish dark
              ('pressed', '#232e23'),      # same for pressed/clicked
              ('!active', '#000000')       # default fallback
          ],
          foreground=[
              ('active', '#00ff7f'),       # green highlight for text (optional)
              ('pressed', '#00ff7f'),
              ('!active', '#d4d4d4')
          ]
)

    # Style Notebook and Tabs
    style.configure('TNotebook', background='#1e1e1e', borderwidth=0)
    style.configure('TNotebook.Tab', 
                    background='#2a2a2a', 
                    foreground='#d4d4d4',
                    padding=[10,5])
    style.map('TNotebook.Tab',
              background=[('selected', '#000000')],
              foreground=[('selected', '#00ff7f')])

    

    # Buttons style: dark background, light text, highlight on hover/active
    style.configure('TButton', background='#2a2a2a', foreground='#d4d4d4', borderwidth=0)
    style.map('TButton',
              background=[('active', '#0078d7')],
              foreground=[('active', '#ffffff')])

    # Entry widget style: dark background with light text
    style.configure('TEntry', fieldbackground='#1e1e1e', background='#1e1e1e', foreground='#d4d4d4')

    # Now create your widgets

    # Title label
    title = tk.Label(root, 
                     text="Hector 2.1.1 - OOTP Analyzer", 
                     font=("Consolas", 14, "bold"),
                     fg="#00ff7f",
                     bg="#1e1e1e",
                     anchor="w")
    title.pack(fill="x", padx=10, pady=5)

    # Summary Frame - holds two labels side by side
    summary_frame = tk.Frame(root, bg="#1e1e1e")
    summary_frame.pack(fill="x", padx=10)

    # Left summary label (pitchers and batters counts)
    summary_left_var = tk.StringVar()
    summary_left_label = tk.Label(summary_frame,
                                  textvariable=summary_left_var,
                                  font=font,
                                  fg="#d4d4d4",
                                  bg="#1e1e1e",
                                  anchor="w",
                                  justify="left")
    summary_left_label.pack(side="left", fill="x", expand=True)

    # Right summary label (batters average scores by position)
    summary_right_var = tk.StringVar()
    summary_right_label = tk.Label(summary_frame,
                                   textvariable=summary_right_var,
                                   font=font,
                                   fg="#d4d4d4",
                                   bg="#1e1e1e",
                                   anchor="ne",
                                   justify="left")
    summary_right_label.pack(side="right", fill="y", padx=(10,0))

    # Control buttons frame
    control_frame = tk.Frame(root, bg="#1e1e1e")
    control_frame.pack(fill="x", padx=10, pady=5)

    reload_btn = ttk.Button(control_frame, text="Reload Data")
    reload_btn.pack(side="left", padx=5)

    # Notebook for tabs
    notebook = ttk.Notebook(root)
    notebook.pack(fill="both", expand=True, padx=10, pady=10)

   



    # Data cache (reloadable)
    class DATA:
        pitchers = []
        batters = []

    def load_data():
        # Reload weights dynamically before loading data
        reload_weights()

        # Load player data from HTML files
        DATA.pitchers = load_pitchers_data()   # These functions should NOT depend on global weights
        DATA.batters = load_batters_data()

        # Recalculate Scores using the freshly loaded weights
        for pitcher in DATA.pitchers:
            pitcher['Scores'] = calculate_score(pitcher, section_weights)
            # Print the raw pitch potential score for this pitcher:
            print(f"Pitcher: {pitcher.get('Name', 'Unknown')}, Pitch Potential Score: {pitcher['Scores']['pitches_potential']}")
        for batter in DATA.batters:
            batter['Scores'] = calculate_batter_score(batter, batter_section_weights)

        # Validate required fields
        missing_pitcher_fields = validate_fields(DATA.pitchers, REQUIRED_PITCHER_FIELDS)
        missing_batter_fields = validate_fields(DATA.batters, REQUIRED_BATTER_FIELDS)
        if missing_pitcher_fields or missing_batter_fields:
            error_message = "Your OOTP export is missing fields:\n\n"
            if missing_pitcher_fields:
                error_message += "Pitchers are missing:\n- " + "\n- ".join(sorted(missing_pitcher_fields)) + "\n\n"
            if missing_batter_fields:
                error_message += "Batters are missing:\n- " + "\n- ".join(sorted(missing_batter_fields)) + "\n\n"
            error_message += "Please update your OOTP export to include these fields."
            messagebox.showerror("Missing Fields", error_message)
            root.destroy()
            sys.exit(1)

    def update_summary():
        num_pitchers = len(DATA.pitchers)
        num_batters = len(DATA.batters)

        sp_pitchers = [p for p in DATA.pitchers if p.get("POS") == "SP"]
        rp_pitchers = [p for p in DATA.pitchers if p.get("POS") == "RP"]

        def avg_total(players):
            scores = [p["Scores"].get("total", 0) for p in players if "Scores" in p]
            return round(sum(scores)/len(scores), 2) if scores else 0

        avg_sp = avg_total(sp_pitchers)
        avg_rp = avg_total(rp_pitchers)
        avg_batters = avg_total(DATA.batters)

        # Left summary text remains the same
        left_summary = (
            f"Pitchers in data: {num_pitchers}  (SP: {len(sp_pitchers)}, RP: {len(rp_pitchers)})\n"
            f"Batters in data: {num_batters}\n"
            f"Average Total Score - SP: {avg_sp}  RP: {avg_rp}  Batters: {avg_batters}"
        )
        summary_left_var.set(left_summary)

        from collections import defaultdict
        pos_groups = defaultdict(list)
        for b in DATA.batters:
            pos = b.get("POS", "Unknown")
            pos_groups[pos].append(b)

        pos_avg_scores = {pos: avg_total(players) for pos, players in pos_groups.items()}

        # Define groups explicitly
        group1_positions = ["C", "1B", "2B", "3B", "SS"]
        group2_positions = ["CF", "LF", "RF"]

        # Helper to build formatted string rows horizontally
        def format_pos_group(positions):
            items = []
            for pos in positions:
                score = pos_avg_scores.get(pos, "N/A")
                items.append(f"{pos}: {score}".ljust(15))
            # Join items with two spaces for readability
            return "  ".join(items)

        # Compose final right summary with two groups separated by a blank line
        right_lines = [
            "Average Total Score by Batter Position:",
            "",
            "Infield: " + format_pos_group(group1_positions),
            "Outfield: " + format_pos_group(group2_positions)
        ]

        summary_right_var.set("\n".join(right_lines))



    # Setup the tabs
    pitcher_tab = add_pitcher_tab(notebook, font)
    batter_tab = add_batter_tab(notebook, font)
    teams_tab = add_teams_tab(notebook, font)

    def refresh_all_tabs():
        try:
            load_data()
            # The rest of your usual code:
            # Sort data by total score descending before sending to tabs for display
            sorted_pitchers = sorted(DATA.pitchers, key=lambda p: p["Scores"].get("total", 0), reverse=True)
            sorted_batters = sorted(DATA.batters, key=lambda b: b["Scores"].get("total", 0), reverse=True)

            pitcher_tab.refresh(sorted_pitchers)
            batter_tab.refresh(sorted_batters)
            teams_tab.refresh(sorted_pitchers, sorted_batters)

            update_summary()   # Update the summary labels

        except Exception as e:
            messagebox.showerror("Data Load Error", str(e))

    

    reload_btn.config(command=refresh_all_tabs)

    # Initial load on startup
    refresh_all_tabs()

    root.mainloop()

if __name__ == "__main__":
    build_gui()
