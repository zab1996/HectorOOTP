from bs4 import BeautifulSoup
from pathlib import Path
import sys
import os
import importlib.util
import re

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

# Load pitcher_weights dynamically
pitcher_weights = import_weights_module("pitcher_weights")
section_weights = pitcher_weights.section_weights  # get the variable from the module

from pathlib import Path
from bs4 import BeautifulSoup

def get_base_path():
    import sys
    import os
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    else:
        return Path(__file__).parent

def load_pitchers_data(filename="pitchers.html"):
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
    pitchers = []

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
        pitcher_data = {headers[i]: cells[i].get_text(strip=True) for i in range(len(headers))}
        pitchers.append(pitcher_data)

    return pitchers


def calculate_score(player, section_weights):
    total_core = 0
    total_potential = 0
    total_pitch_arsenal = 0
    total_other = 0

    penalties = 0

    pitch_key_map = {
        "FB": "Fastball",
        "FBP": "Fastball Potential",
        "CH": "Changeup",
        "CHP": "Changeup Potential",
        "CB": "Curveball",
        "CBP": "Curveball Potential",
        "SL": "Slider",
        "SLP": "Slider Potential",
        "SI": "Sinker",
        "SIP": "Sinker Potential",
        "SP": "Splitter",
        "SPP": "Splitter Potential",
        "CT": "Cutter",
        "CTP": "Cutter Potential",
        "FO": "Forkball",
        "FOP": "Forkball Potential",
        "CC": "Circle Change",
        "CCP": "Circle Change Potential",
        "SC": "Screwball",
        "SCP": "Screwball Potential",
        "KC": "Knuckle Curve",
        "KCP": "Knuckle Curve Potential",
        "KN": "Knuckleball",
        "KNP": "Knuckleball Potential",
    }

    def parse_value(raw_value):
        raw_value = str(raw_value).strip()
        if "Stars" in raw_value:
            try:
                return float(raw_value.split()[0])
            except Exception:
                return 0
        elif "-" in raw_value and raw_value != "-" and not raw_value.startswith("-"):
            parts = [p.strip() for p in raw_value.replace("mph", "").split("-")]
            nums = []
            for p in parts:
                try:
                    nums.append(float(p))
                except Exception:
                    pass
            return sum(nums) / len(nums) if nums else 0
        elif raw_value == "-" or raw_value == "":
            return 0
        else:
            try:
                import re
                match = re.search(r"\d+(\.\d+)?", raw_value)
                if match:
                    return float(match.group(0))
                else:
                    return 0
            except Exception:
                return 0

    meta = section_weights.get("meta", {})
    meta_core = meta.get("core_attributes", 1.0)
    meta_potential = meta.get("core_potentials", 1.0)
    meta_pitch = meta.get("pitch_arsenal", 1.0)
    meta_other = meta.get("other_attributes", 1.0)
    meta_penalties = meta.get("penalties", 1.0)

    for header, value in player.items():
        if header in pitch_key_map:
            key = pitch_key_map[header]
            val = parse_value(value)
            weight = section_weights["pitch_arsenal"].get(key, 0)
            total_pitch_arsenal += val * weight * meta_pitch
        else:
            header_to_weight = {
                'STU': 'stuff',
                'MOV': 'movement',
                'CON': 'control',
                'STU P': 'stuff_potential',
                'MOV P': 'movement_potential',
                'CON P': 'control_potential',
                'OVR': 'overall_rating',
                'POT': 'potential_rating',
                'PIT': 'number_of_pitches',
                'VELO': 'velocity',
                'STM': 'stamina',
                'G/F': 'ground_fly_ratio',
                'HLD': 'holds',
                'SctAcc': 'scout_accuracy',
            }
            weight_key = header_to_weight.get(header)
            val = parse_value(value)
            if weight_key:
                if weight_key in ["stuff", "movement", "control", "overall_rating"]:
                    weight = section_weights["core_attributes"].get(weight_key, 0)
                    total_core += val * weight * meta_core
                elif weight_key in ["stuff_potential", "movement_potential", "control_potential", "potential_rating"]:
                    weight = section_weights["core_potentials"].get(weight_key, 0)
                    total_potential += val * weight * meta_potential
                else:
                    weight = section_weights["other_attributes"].get(weight_key, 0)
                    total_other += val * weight * meta_other

    # Apply penalties only to total_other
    try:
        if int(player.get("PIT", 0)) < 4:
            penalties += section_weights["penalties"].get("penalty_sp_low_pitches", 0)
        if int(player.get("STM", 0)) < 50:
            penalties += section_weights["penalties"].get("penalty_sp_low_stamina", 0)
    except Exception:
        pass

    total_other += penalties * meta_penalties

    total_score = total_core + total_potential + total_pitch_arsenal + total_other

    return {
        'total': round(total_score, 2),
        'pitches': round(total_pitch_arsenal, 2),
        'pitches_potential': round(total_potential, 2)
    }
