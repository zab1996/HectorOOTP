section_weights = {
    # --- Global multipliers ---
    # These control the relative importance of current vs potential ratings
    'overall_weight': 1.0,      # 0 = ignore current ratings, 1 = normal, >1 = emphasize
    'potential_weight': 1.0,    # 0 = ignore potential, 1 = normal, >1 = emphasize

    # --- Hitting (Current) ---
    # How important each batting skill is for current performance
    'overall': {
        'contact': 0.3,         # Ability to make contact
        'gap': 0.1,             # Gap power (doubles/triples)
        'power': 0.4,           # Home run power
        'eye': 0.3,             # Plate discipline / walks
        'strikeouts': 0.1       # Strikeout avoidance
    },

    # --- Hitting (Potential) ---
    # Same as above but for potential ratings
    'potential': {
        'contact_potential': 0.3,
        'gap_potential': 0.1,
        'power_potential': 0.4,
        'eye_potential': 0.3,
        'strikeouts_potential': 0.1
    },

    # --- Defense (Catcher) ---
    'catcher': {
        'catcher_ability': 0.5, # Framing/overall defense
        'catcher_arm': 0.3,     # Throwing out runners
        'catcher_blocking': 0.4 # Blocking pitches
    },

    # --- Defense (Infield) ---
    'infield': {
        'infield_range': {      # Positional range importance
            '1B': 0.2,
            '2B': 0.2,
            'SS': 0.5,          # Shortstop gets extra weight for range
            '3B': 0.2
        },
        'infield_error': 0.2,   # Error avoidance
        'infield_arm': {        # Positional arm importance
            '1B': 0.2,
            '2B': 0.2,
            'SS': 0.2,
            '3B': 0.5           # Third base needs a stronger arm
        }
    },

    # --- Defense (Outfield) ---
    'outfield': {
        'outfield_range': {
            'LF': 0.2,
            'CF': 0.4,          # Center field needs the most range
            'RF': 0.2
        },
        'outfield_error': 0.2,  # Error avoidance
        'outfield_arm': 0.2     # Arm strength
    },

    # --- Baserunning ---
    'speed': { 'speed': 0.1 },        # Raw speed
    'stealing': { 'stealing': 0.1 },  # Stealing ability
    'running': { 'running': 0.1 },    # Baserunning instincts

    # --- Other ---
    'scout_accuracy': { 'scout_accuracy': 0.2 }  # Trust in scouting accuracy
}
