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

from pathlib import Path
from bs4 import BeautifulSoup

def get_base_path():
    import sys
    import os
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    else:
        return Path(__file__).parent

def load_batters_data(filename="batters.html"):
    base_path = get_base_path()
    html_path = base_path / filename

    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    table = soup.find("table", class_="data")
    if not table:
        raise ValueError(f"No table with class 'data' found in {filename}.")

    thead = table.find("thead")
    if thead:
        header_row = thead.find("tr")
    else:
        header_row = table.find("tr")

    if not header_row:
        raise ValueError(f"No header row found in the table in {filename}.")

    headers = [th.get_text(strip=True) for th in header_row.find_all("th")]
    batters = []

    tbody = table.find("tbody")
    if tbody:
        rows = tbody.find_all("tr")
    else:
        # Fallback if no tbody tag
        rows = table.find_all("tr")[1:]  # skip header row

    for row in rows:
        cells = row.find_all("td")
        if len(cells) != len(headers):
            # Skip incomplete rows or handle as needed
            continue
        batter_data = {headers[i]: cells[i].get_text(strip=True) for i in range(len(headers))}
        batters.append(batter_data)

    return batters


def calculate_batter_score(player, section_weights):
    pos = player.get('POS', '').upper()

    def to_number(val):
        val = str(val).replace(" Stars", "").strip()
        if val == "-" or val == "":
            return 0.0
        try:
            return float(val)
        except ValueError:
            return 0.0

    batter_key_map = {
        'CON': ('overall', 'contact'),
        'GAP': ('overall', 'gap'),
        'POW': ('overall', 'power'),
        'EYE': ('overall', 'eye'),
        "K's": ('overall', 'strikeouts'),

        'CON P': ('potential', 'contact_potential'),
        'GAP P': ('potential', 'gap_potential'),
        'POW P': ('potential', 'power_potential'),
        'EYE P': ('potential', 'eye_potential'),
        'K P': ('potential', 'strikeouts_potential'),

        'C ABI': ('defense', 'catcher', 'catcher_ability'),
        'C ARM': ('defense', 'catcher', 'catcher_arm'),
        'C BLK': ('defense', 'catcher', 'catcher_blocking'),

        'IF RNG': ('defense', 'infield', 'infield_range'),
        'IF ERR': ('defense', 'infield', 'infield_error'),
        'IF ARM': ('defense', 'infield', 'infield_arm'),

        'OF RNG': ('defense', 'outfield', 'outfield_range'),
        'OF ERR': ('defense', 'outfield', 'outfield_error'),
        'OF ARM': ('defense', 'outfield', 'outfield_arm'),

        'SPE': ('baserunning', 'speed'),
        'STE': ('baserunning', 'stealing'),
        'RUN': ('baserunning', 'running'),

        'SctAcc': ('scout_accuracy',)
    }

    overall_score = 0.0
    potential_score = 0.0
    defense_score = 0.0
    baserunning_score = 0.0
    scout_accuracy_score = 0.0

    meta = section_weights.get('meta', {})
    meta_overall = meta.get("overall", 1.0)
    meta_potential = meta.get("potential", 1.0)
    meta_defense = meta.get("defense", 1.0)
    meta_baserunning = meta.get("baserunning", 1.0)
    meta_scout = 1.0

    for attr, weight_path in batter_key_map.items():
        val = to_number(player.get(attr, "-"))
        if not val:
            continue

        if weight_path[0] == "overall":
            weight = section_weights['overall'].get(weight_path[1], 0)
            overall_score += val * weight
        elif weight_path[0] == "potential":
            weight = section_weights['potential'].get(weight_path[1], 0)
            potential_score += val * weight
        elif weight_path[0] == "defense":
            if len(weight_path) == 3:
                section = weight_path[1]
                key = weight_path[2]
                if section == "catcher" and pos == "C":
                    weight = section_weights['defense']['catcher'].get(key, 0)
                    defense_score += val * weight
                elif section == "infield" and pos in ['1B', '2B', 'SS', '3B']:
                    if key in ['infield_range', 'infield_arm']:
                        weight = section_weights['defense']['infield'][key].get(pos, 0)
                    else:
                        weight = section_weights['defense']['infield'].get(key, 0)
                    defense_score += val * weight
                elif section == "outfield" and pos in ['LF', 'CF', 'RF']:
                    if key == 'outfield_range':
                        weight = section_weights['defense']['outfield'][key].get(pos, 0)
                    else:
                        weight = section_weights['defense']['outfield'].get(key, 0)
                    defense_score += val * weight
        elif weight_path[0] == "baserunning":
            weight = section_weights['baserunning'].get(weight_path[1], 0)
            baserunning_score += val * weight
        elif weight_path[0] == "scout_accuracy":
            weight = section_weights.get('scout_accuracy', 0)
            scout_accuracy_score += val * weight

    overall_score *= meta_overall
    potential_score *= meta_potential
    defense_score *= meta_defense
    baserunning_score *= meta_baserunning
    scout_accuracy_score *= meta_scout

    total = overall_score + potential_score + defense_score + baserunning_score + scout_accuracy_score

    return {
        "offense": round(overall_score, 2),
        "offense_potential": round(potential_score, 2),
        "defense": round(defense_score, 2),
        "baserunning": round(baserunning_score, 2),
        "scout_accuracy": round(scout_accuracy_score, 2),
        "total": round(total, 2),
        "overall_stars": player.get('OVR', '0 Stars'),
        "potential_stars": player.get('POT', '0 Stars')
    }
