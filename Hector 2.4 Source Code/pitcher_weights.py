section_weights = {
    "meta": {
        "core_attributes": 1.0,
        "core_potentials": 1.0,
        "pitch_arsenal": 1.0,
        "pitch_arsenal_potential": 1.0,  # NEW meta multiplier for pitch potentials
        "other_attributes": 1.0,
        "penalties": 1.0
    },

    "core_attributes": {
        # Core pitching skills used in overall scoring
        "stuff": 0.3,        # Ability to strike batters out
        "movement": 0.4,     # Preventing home runs via pitch movement
        "control": 0.5,      # Limiting walks by pitch accuracy
    },

    "core_potentials": {
        # Potentials for the core pitching skills only
        "stuff_potential": 0.3,
        "movement_potential": 0.4,
        "control_potential": 0.5,
    },

    "pitch_arsenal": {
        # Pitch types weights (only actual pitches, no potentials)
        "Fastball": 0.03,
        "Changeup": 0.03,
        "Splitter": 0.03,
        "Circle Change": 0.03,
        "Curveball": 0.03,
        "Slider": 0.03,
        "Knuckle Curve": 0.03,
        "Screwball": 0.01,
        "Sinker": 0.03,
        "Cutter": 0.01,
        "Forkball": 0.01,
        "Knuckleball": 0.03,
    },

    "pitch_arsenal_potential": {
        # Pitch potentials weights grouped separately from core potentials
        "fastball_potential": 0.03,
        "changeup_potential": 0.03,
        "splitter_potential": 0.03,
        "circle_change_potential": 0.03,
        "curveball_potential": 0.03,
        "slider_potential": 0.03,
        "knuckle_curve_potential": 0.03,
        "screwball_potential": 0.01,
        "sinker_potential": 0.03,
        "cutter_potential": 0.01,
        "forkball_potential": 0.01,
        "knuckleball_potential": 0.03,
    },

    "other_attributes": {
        "number_of_pitches": 0.3,    # Bonus for pitchers who throw a variety of pitches
        "velocity": 0.0,             # Weight for average pitch velocity
        "stamina": 0.03,             # Pitcher's endurance
        "ground_fly_ratio": 0.02,    # Favor ground ball pitchers
        "holds": 0.01,               # Relief pitcher holds
        "scout_accuracy": 0.00,      # Default weight is 0. Increase to 0.05 to give higher ratings to well-scouted players.
# However, this is not recommended because it may unfairly lower ratings of quality players who have limited scouting data (e.g., IFAs).
        
    },

    "penalties": {
        "penalty_sp_low_pitches": -0.2, #Penatly only to SP who have 3 or less Pitches. 
        #In other words a boost to pitchers who have more pitches
        "penalty_sp_low_stamina": -0.5, # Penalty only to SP who have below 50 Stamina
        "no_pitch_50_plus": -0.4, # Penalty to all pitchers who have no individual pitches than are over 50.
         # This is to stop pitchers who have a bunch of below avg (45 and below) from being weighed so highly 

    }
}
