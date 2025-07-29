import sys
import importlib.util
from pathlib import Path 



def calculate_batter_score(player, section_weights):
    pos = player.get('POS', '').upper()
    def to_number(val):
        val = str(val).replace(" Stars", "").strip()
        if val == "-" or val == "":
            return 0.0
        try: return float(val)
        except ValueError: return 0.0
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
        'C FRM': ('defense', 'catcher', 'catcher_framing'),
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
                # Only score the main defensive section by POS (no double-scoring)
                if pos == "C" and section == "catcher":
                    weight = section_weights['defense']['catcher'].get(key,0)
                    defense_score += val * weight
                elif pos in ['1B', '2B', '3B', 'SS'] and section == "infield":
                    if key in ['infield_range', 'infield_arm']:
                        weight = section_weights['defense']['infield'][key].get(pos,0)
                    else:
                        weight = section_weights['defense']['infield'].get(key,0)
                    defense_score += val * weight
                elif pos in ['LF', 'CF', 'RF'] and section == "outfield":
                    if key == 'outfield_range':
                        weight = section_weights['defense']['outfield'][key].get(pos,0)
                    else:
                        weight = section_weights['defense']['outfield'].get(key,0)
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
# No file loader needed anymore!
