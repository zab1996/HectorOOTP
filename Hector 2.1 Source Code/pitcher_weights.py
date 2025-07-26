section_weights = {
    "meta": {
        "core_attributes": 1.0,
        "core_potentials": 1.0,
        "pitch_arsenal": 1.0,
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
        # Potentials for the core pitching skills
        "stuff_potential": 0.3,
        "movement_potential": 0.4,
        "control_potential": 0.5,
    },

    "pitch_arsenal": {
        # Pitch types weights (Current & Potential)
        "Fastball": 0.03,
        "Fastball Potential": 0.03,

        "Changeup": 0.03,
        "Changeup Potential": 0.03,
        "Splitter": 0.03,
        "Splitter Potential": 0.03,
        "Circle Change": 0.03,
        "Circle Change Potential": 0.03,

        "Curveball": 0.03,
        "Curveball Potential": 0.03,
        "Slider": 0.03,
        "Slider Potential": 0.03,
        "Knuckle Curve": 0.03,
        "Knuckle Curve Potential": 0.03,
        "Screwball": 0.01,
        "Screwball Potential": 0.01,

        "Sinker": 0.03,
        "Sinker Potential": 0.03,
        "Cutter": 0.01,
        "Cutter Potential": 0.01,
        "Forkball": 0.01,
        "Forkball Potential": 0.01,
        "Knuckleball": 0.03,
        "Knuckleball Potential": 0.03,
    },

    "other_attributes": {
        "number_of_pitches": 0.3,    # Bonus for pitchers who throw a larger variety of pitches, rewarding versatility.
        "velocity": 0.0,             # Weight for average pitch velocity; higher velocity generally leads to more dominance.
        "stamina": 0.03,             # Pitcher's endurance; important for starters to pitch deep into games.
        "ground_fly_ratio": 0.02,    # Favor pitchers who induce more ground balls rather than fly balls, reducing extra-base hits.
        "holds": 0.01,               # Reward relievers for holds — preserving leads.
        "scout_accuracy": 0.05,      # Trustworthiness of scouting data; improves confidence in ratings.
        "overall_rating": 0.0,       # Pitcher's overall star rating representing general ability.
        "potential_rating": 0.0,     # Pitcher's potential star rating indicating future upside.
    },

    "penalties": {
        "penalty_sp_low_pitches": -0.2,  # Penalty for starting pitchers with fewer than 4 pitches, reflecting limited arsenal.
        "penalty_sp_low_stamina": -0.5,  # Penalty for starters with stamina below 50, indicating poor endurance.
    }
}
