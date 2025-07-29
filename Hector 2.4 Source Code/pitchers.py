import sys
import importlib.util
from pathlib import Path 



def calculate_score(player, section_weights):
    total_core = 0
    total_core_potential = 0
    total_pitch_arsenal = 0
    total_pitch_potential = 0
    total_other = 0
    penalties = 0
    pitch_key_map_actual = {
        "FB": "Fastball", "CH": "Changeup", "CB": "Curveball", "SL": "Slider", "SI": "Sinker",
        "SP": "Splitter", "CT": "Cutter", "FO": "Forkball", "CC": "Circle Change",
        "SC": "Screwball", "KC": "Knuckle Curve", "KN": "Knuckleball"
    }
    pitch_key_map_potential = {
        "FBP": "Fastball Potential", "CHP": "Changeup Potential", "CBP": "Curveball Potential",
        "SLP": "Slider Potential", "SIP": "Sinker Potential", "SPP": "Splitter Potential",
        "CTP": "Cutter Potential", "FOP": "Forkball Potential", "CCP": "Circle Change Potential",
        "SCP": "Screwball Potential", "KCP": "Knuckle Curve Potential", "KNP": "Knuckleball Potential"
    }

    def parse_value(raw_value):
        raw_value = str(raw_value).strip()
        if "Stars" in raw_value:
            try: return float(raw_value.split()[0])
            except Exception: return 0
        elif "-" in raw_value and raw_value != "-" and not raw_value.startswith("-"):
            parts = [p.strip() for p in raw_value.replace("mph", "").split("-")]
            nums = []
            for p in parts:
                try: nums.append(float(p))
                except Exception: pass
            return sum(nums) / len(nums) if nums else 0
        elif raw_value == "-" or raw_value == "":
            return 0
        else:
            import re
            match = re.search(r"\d+(\.\d+)?", raw_value)
            if match:
                return float(match.group(0))
            else:
                return 0

    meta = section_weights.get("meta", {})
    meta_core = meta.get("core_attributes", 1.0)
    meta_core_potential = meta.get("core_potentials", 1.0)
    meta_pitch = meta.get("pitch_arsenal", 1.0)
    meta_pitch_potential = meta.get("pitch_arsenal_potential", 1.0)
    meta_other = meta.get("other_attributes", 1.0)
    meta_penalties = meta.get("penalties", 1.0)

    pitch_values = []
    for header, value in player.items():
        val = parse_value(value)
        if header in pitch_key_map_actual:
            key = pitch_key_map_actual[header]
            weight = section_weights["pitch_arsenal"].get(key, 0)
            total_pitch_arsenal += val * weight * meta_pitch
            if val > 0:
                pitch_values.append(val)
        elif header in pitch_key_map_potential:
            key = pitch_key_map_potential[header]
            weight_key = key.lower().replace(" ", "_")
            weight = section_weights["pitch_arsenal_potential"].get(weight_key, 0)
            total_pitch_potential += val * weight * meta_pitch_potential
        else:
            header_to_weight = {
                'STU': 'stuff', 'MOV': 'movement', 'CON': 'control',
                'STU P': 'stuff_potential', 'MOV P': 'movement_potential', 'CON P': 'control_potential',
                'PIT': 'number_of_pitches', 'VELO': 'velocity', 'STM': 'stamina',
                'G/F': 'ground_fly_ratio', 'HLD': 'holds', 'SctAcc': 'scout_accuracy'
            }

            weight_key = header_to_weight.get(header)
            if weight_key:
                if weight_key in ["stuff", "movement", "control", "overall_rating"]:
                    weight = section_weights["core_attributes"].get(weight_key, 0)
                    total_core += val * weight * meta_core
                elif weight_key in ["stuff_potential", "movement_potential", "control_potential", "potential_rating"]:
                    weight_key_norm = weight_key.lower().replace(" ", "_")
                    weight = section_weights["core_potentials"].get(weight_key_norm, 0)
                    total_core_potential += val * weight * meta_core_potential
                else:
                    weight = section_weights["other_attributes"].get(weight_key, 0)
                    total_other += val * weight * meta_other
        pos = player.get("POS", "").upper()
    try:
        if pos == "SP":
            if int(player.get("PIT", 0)) < 4:
                penalties += section_weights["penalties"].get("penalty_sp_low_pitches", 0)
            if int(player.get("STM", 0)) < 50:
                penalties += section_weights["penalties"].get("penalty_sp_low_stamina", 0)
    except Exception:
        pass


    if pitch_values and max(pitch_values) < 50:
        penalties += section_weights["penalties"].get("no_pitch_50_plus", 0)
    total_other += penalties * meta_penalties
    total_potential = total_pitch_potential + total_core_potential
    total_score = total_core + total_potential + total_pitch_arsenal + total_other
    return {
        'total': round(total_score, 2),
        'pitches': round(total_pitch_arsenal, 2),
        'pitches_potential': round(total_pitch_potential, 2),
        'core_potential': round(total_core_potential, 2),
        'curr_total': round(total_core + total_pitch_arsenal + total_other, 2)
    }
# No file loader needed!
