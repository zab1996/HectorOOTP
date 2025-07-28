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
from .widgets import create_title_label, create_summary_widgets, create_control_frame, update_summary_widgets



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

section_weights = None
batter_section_weights = None

PITCHER_POSITIONS = {"P", "SP", "RP"}
BATTER_POSITIONS = {"1B", "2B", "3B", "SS", "CF", "RF", "LF", "C", "DH"}


def get_weights_dir():
    import sys
    from pathlib import Path
    if getattr(sys, 'frozen', False):
        # Use the folder where the .exe is located—works for PyInstaller onefolder mode
        return Path(sys.executable).parent
    else:
        # Use project root in development
        return Path(__file__).parent.parent


def import_weights_module(module_name):
    import importlib.util
    import sys
    module_path = get_weights_dir() / f"{module_name}.py"
    # Always remove from sys.modules, to force fresh import
    if module_name in sys.modules:
        del sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, str(module_path))
    if spec is None or not module_path.exists():
        raise ImportError(f"Could not find spec for {module_name} at {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.modules[module_name] = module
    return module



def reload_weights():
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

def detect_wrong_import(players, valid_positions, wrong_positions):
    """
    Returns True if all seen positions are from 'wrong_positions'
    and none are from 'valid_positions'.
    """
    seen_positions = {p.get("POS", "").upper() for p in players}
    seen_positions.discard("")
    if not seen_positions:
        return False
    # All positions are in the wrong set and none in the valid set
    return seen_positions.issubset(wrong_positions) and not seen_positions & valid_positions

def build_gui():
    root = tk.Tk()
    root.title("Hector 2.3")
    root.geometry("1500x850")
    root.configure(bg="#1e1e1e")
    font = ("Consolas", 11)

    setup_theme(font, root)

    # --- Title label via widget helper ---
    title = create_title_label(root, font, "Hector 2.3 - OOTP Analyzer")
    title.pack(fill="x", padx=10, pady=5)

    # --- Summary section via widget helper ---
    summary_frame, summary_left_var, summary_right_var = create_summary_widgets(root, font)
    summary_frame.pack(fill="x", padx=10)

    # --- Control/reload bar via widget helper (reload_callback assigned after def below) ---
    control_frame, reload_btn = create_control_frame(root, reload_callback=None, font=font)
    control_frame.pack(fill="x", padx=10, pady=5)

    notebook = ttk.Notebook(root)
    notebook.pack(fill="both", expand=True, padx=10, pady=10)

    class DATA:
        pitchers = []
        batters = []

    def load_data():
        reload_weights()
        DATA.pitchers = load_pitchers_data()
        DATA.batters = load_batters_data()
        for pitcher in DATA.pitchers:
            pitcher['Scores'] = calculate_score(pitcher, section_weights)
        for batter in DATA.batters:
            batter['Scores'] = calculate_batter_score(batter, batter_section_weights)

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

        # Inserted logic for file type mixup detection!
        if detect_wrong_import(DATA.pitchers, PITCHER_POSITIONS, BATTER_POSITIONS):
            messagebox.showerror(
                "File Mixup Detected",
                "The file you loaded for Pitchers appears to only contain batter positions (e.g. 1B, 2B, SS, etc).\n"
                "Please export and load the correct OOTP PITCHERS report."
            )
            root.destroy()
            sys.exit(1)

        if detect_wrong_import(DATA.batters, BATTER_POSITIONS, PITCHER_POSITIONS):
            messagebox.showerror(
                "File Mixup Detected",
                "The file you loaded for Batters appears to only contain pitcher positions (e.g. P, SP, RP).\n"
                "Please export and load the correct OOTP BATTERS report."
            )
            root.destroy()
            sys.exit(1)


    pitcher_tab = add_pitcher_tab(notebook, font)
    batter_tab = add_batter_tab(notebook, font)
    teams_tab = add_teams_tab(notebook, font)

    def refresh_all_tabs():
        try:
            load_data()
            sorted_pitchers = sorted(DATA.pitchers, key=lambda p: p["Scores"].get("total", 0), reverse=True)
            sorted_batters = sorted(DATA.batters, key=lambda b: b["Scores"].get("total", 0), reverse=True)
            pitcher_tab.refresh(sorted_pitchers)
            batter_tab.refresh(sorted_batters)
            teams_tab.refresh(sorted_pitchers, sorted_batters)
            update_summary_widgets(DATA, summary_left_var, summary_right_var)
        except Exception as e:
            messagebox.showerror("Data Load Error", str(e))

    # Attach the actual callback to the reload button (after defining function)
    reload_btn.config(command=refresh_all_tabs)

    # Initial fill
    refresh_all_tabs()
    root.mainloop()

if __name__ == "__main__":
    build_gui()
