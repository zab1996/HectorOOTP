section_weights = {
    # --- Core attributes ---
    # These are the main pitching skills used in overall scoring
    'stuff': 0.5,                  # Ability to strike batters out
    'movement': 0.5,               # Preventing HRs
    'control': 0.5,                # Limiting walks

    # Potentials for the same core attributes
    'stuff_potential': 0.5,
    'movement_potential': 0.5,
    'control_potential': 0.5,

    # --- Pitch Arsenal Weights ---
    # Weight for each pitch type (Current & Potential)
    # Increase these if you want to value pitchers who throw a specific pitch more.
    'pitches': {
        # --- Fastballs ---
        'Fastball': 0.03,
        'Fastball Potential': 0.03,

        # --- Off-speed ---
        'Changeup': 0.03,
        'Changeup Potential': 0.03,
        'Splitter': 0.03,
        'Splitter Potential': 0.03,
        'Circle Change': 0.03,
        'Circle Change Potential': 0.03,

        # --- Breaking Pitches ---
        'Curveball': 0.03,
        'Curveball Potential': 0.03,
        'Slider': 0.03,
        'Slider Potential': 0.03,
        'Knuckle Curve': 0.03,
        'Knuckle Curve Potential': 0.03,
        'Screwball': 0.01,
        'Screwball Potential': 0.01,

        # --- Specialty Pitches ---
        'Sinker': 0.03,
        'Sinker Potential': 0.03,
        'Cutter': 0.01,
        'Cutter Potential': 0.01,
        'Forkball': 0.01,
        'Forkball Potential': 0.01,
        'Knuckleball': 0.03,
        'Knuckleball Potential': 0.03,
    },

    # --- Other Attributes ---
    'number_of_pitches': 0.3,      # Bonus for pitchers with more pitch types
    'velocity': 0.2,               # Weight for pitch velocity
    'stamina': 0.03,               # Endurance (especially for SP)
    'ground_fly_ratio': 0.02,      # Favor groundball pitchers
    'holds': 0.02,                 # Reliever holds
    'scout_accuracy': 0.05,        # Trust in scouting accuracy
    'overall_rating': 0.1,         # OVR star rating
    'potential_rating': 0.1,       # POT star rating

    # --- Penalties ---
    'penalty_sp_low_pitches': -0.2, # Deduct for SP with fewer than 4 pitches
    'penalty_sp_low_stamina': -0.5  # Deduct for SP with stamina <50
}
