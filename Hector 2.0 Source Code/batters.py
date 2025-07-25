from bs4 import BeautifulSoup
from pathlib import Path
import sys
import os
import importlib.util

def get_base_path():
    if getattr(sys, 'frozen', False):
        # If bundled by PyInstaller, sys.executable points to the exe
        return Path(sys.executable).parent
    else:
        # Running in normal Python environment
        return Path(__file__).parent

def import_weights_module(module_name):
    base_path = get_base_path()
    module_path = base_path / f"{module_name}.py"
    spec = importlib.util.spec_from_file_location(module_name, str(module_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

# Load batter_weights dynamically
batter_weights = import_weights_module("batter_weights")
section_weights = batter_weights.section_weights  # get the variable from the module

def load_batters_data(filename="batters.html"):
    base_path = get_base_path()
    html_path = base_path / filename

    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    # Locate the batter table
    table = soup.find("table", class_="data")
    if not table:
        raise ValueError("No table with class 'data' found in HTML file.")

    # Extract headers
    headers = [th.get_text(strip=True) for th in table.find("thead").find_all("th")]

    # Extract rows
    batters = []
    for row in table.find("tbody").find_all("tr"):
        cells = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cells) == len(headers):
            batter_data = dict(zip(headers, cells))
            batter_data['Scores'] = calculate_batter_score(batter_data)
            batters.append(batter_data)

    return batters

def calculate_batter_score(player):
    pos = player.get('POS', '').upper()

    def to_number(val):
        val = str(val).replace(" Stars", "")
        if val == "-" or val == "":
            return 0
        try:
            return float(val)
        except ValueError:
            return 0

    overall_w = section_weights.get('overall_weight', 1.0)
    potential_w = section_weights.get('potential_weight', 1.0)

    overall_stars = player.get('OVR', '0 Stars')
    potential_stars = player.get('POT', '0 Stars')

    overall_score = 0
    overall_score += to_number(player.get('CON', 0)) * section_weights['overall']['contact']
    overall_score += to_number(player.get('GAP', 0)) * section_weights['overall']['gap']
    overall_score += to_number(player.get('POW', 0)) * section_weights['overall']['power']
    overall_score += to_number(player.get('EYE', 0)) * section_weights['overall']['eye']
    overall_score += to_number(player.get("K's", 0)) * section_weights['overall']['strikeouts']
    overall_score *= overall_w

    potential_score = 0
    potential_score += to_number(player.get('CON P', 0)) * section_weights['potential']['contact_potential']
    potential_score += to_number(player.get('GAP P', 0)) * section_weights['potential']['gap_potential']
    potential_score += to_number(player.get('POW P', 0)) * section_weights['potential']['power_potential']
    potential_score += to_number(player.get('EYE P', 0)) * section_weights['potential']['eye_potential']
    potential_score += to_number(player.get('K P', 0)) * section_weights['potential']['strikeouts_potential']
    potential_score *= potential_w

    defense = 0
    if pos == 'C':
        defense += to_number(player.get('C ABI', 0)) * section_weights['catcher']['catcher_ability']
        defense += to_number(player.get('C ARM', 0)) * section_weights['catcher']['catcher_arm']
        defense += to_number(player.get('C BLK', 0)) * section_weights['catcher']['catcher_blocking']

    if pos in ['1B', '2B', 'SS', '3B']:
        defense += to_number(player.get('IF RNG', 0)) * section_weights['infield']['infield_range'].get(pos, 0)
        defense += to_number(player.get('IF ERR', 0)) * section_weights['infield']['infield_error']
        defense += to_number(player.get('IF ARM', 0)) * section_weights['infield']['infield_arm'].get(pos, 0)

    if pos in ['LF', 'CF', 'RF']:
        defense += to_number(player.get('OF RNG', 0)) * section_weights['outfield']['outfield_range'].get(pos, 0)
        defense += to_number(player.get('OF ERR', 0)) * section_weights['outfield']['outfield_error']
        defense += to_number(player.get('OF ARM', 0)) * section_weights['outfield']['outfield_arm']

    total = overall_score + potential_score + defense

    return {
        "offense": round(overall_score, 2),
        "offense_potential": round(potential_score, 2),
        "defense": round(defense, 2),
        "total": round(total, 2),
        "overall_stars": overall_stars,
        "potential_stars": potential_stars
    }
