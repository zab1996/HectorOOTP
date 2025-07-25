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

def load_pitchers_data(filename="pitchers.html"):
    base_path = get_base_path()
    html_path = base_path / filename

    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    # Locate the player table
    table = soup.find("table", class_="data")
    if not table:
        raise ValueError("No table with class 'data' found in HTML file.")

    # Extract headers
    headers = [th.get_text(strip=True) for th in table.find("thead").find_all("th")]

    # Extract rows and build player dictionaries with scores
    players = []
    for row in table.find("tbody").find_all("tr"):
        cells = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cells) == len(headers):
            player_data = dict(zip(headers, cells))
            player_data['Scores'] = calculate_score(player_data)
            players.append(player_data)

    return players

def calculate_score(player):
    total_score = 0
    pitches_score = 0
    pitches_potential_score = 0

    # Flatten weights except nested 'pitches'
    flat_weights = {k.lower(): v for k, v in section_weights.items() if k != 'pitches'}
    for pitch, w in section_weights.get('pitches', {}).items():
        flat_weights[pitch.lower().replace(" ", "_")] = w

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
        # Pitch fields normalized:
        'FB': 'fastball',
        'FBP': 'fastball_potential',
        'CH': 'changeup',
        'CHP': 'changeup_potential',
        'CB': 'curveball',
        'CBP': 'curveball_potential',
        'SL': 'slider',
        'SLP': 'slider_potential',
        'SI': 'sinker',
        'SIP': 'sinker_potential',
        'SP': 'splitter',
        'SPP': 'splitter_potential',
        'CT': 'cutter',
        'CTP': 'cutter_potential',
        'FO': 'forkball',
        'FOP': 'forkball_potential',
        'CC': 'circle_change',
        'CCP': 'circle_change_potential',
        'SC': 'screwball',
        'SCP': 'screwball_potential',
        'KC': 'knuckle_curve',
        'KCP': 'knuckle_curve_potential',
        'KN': 'knuckleball',
        'KNP': 'knuckleball_potential',
    }

    for header, value in player.items():
        weight_key = header_to_weight.get(header)
        if not weight_key:
            continue
        weight = flat_weights.get(weight_key, 0)
        if weight == 0:
            continue

        raw_value = value.strip()
        try:
            if "Stars" in raw_value:
                num = float(raw_value.split()[0])
            elif "-" in raw_value and header == "VELO":
                parts = [part.strip() for part in raw_value.replace("mph", "").split("-")]
                nums = []
                for p in parts:
                    try:
                        nums.append(float(p))
                    except ValueError:
                        pass
                num = sum(nums) / len(nums) if nums else 0
            elif raw_value == "-" or raw_value == "":
                num = 0
            else:
                match = re.search(r"\d+(\.\d+)?", raw_value)
                if match:
                    num = float(match.group(0))
                else:
                    num = 0
        except Exception:
            num = 0

        # Add to pitches separately, do NOT add to total_score
        if header in ['FB','CH','CB','SL','SI','SP','CT','FO','CC','SC','KC','KN']:
            pitches_score += num * weight
        elif header in ['FBP','CHP','CBP','SLP','SIP','SPP','CTP','FOP','CCP','SCP','KCP','KNP']:
            pitches_potential_score += num * weight
        else:
            total_score += num * weight

    # Apply penalties only to total_score
    try:
        if int(player.get("PIT", 0)) < 4:
            total_score += section_weights.get('penalty_sp_low_pitches', 0)
        if int(player.get("STM", 0)) < 50:
            total_score += section_weights.get('penalty_sp_low_stamina', 0)
    except ValueError:
        pass

    return {
        'total': round(total_score, 2),
        'pitches': round(pitches_score, 2),
        'pitches_potential': round(pitches_potential_score, 2)
    }
