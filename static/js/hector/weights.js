/** Default Hector weight trees — generated from Python sources. */
export const DEFAULT_PITCHER_WEIGHTS = {
  "meta": {
    "core_attributes": 1.0,
    "core_potentials": 1.0,
    "pitch_arsenal": 0.5,
    "pitch_arsenal_potential": 0.5,
    "other_attributes": 1.0,
    "penalties": 1.0
  },
  "core_attributes": {
    "stuff": 0.3,
    "movement": 0.4,
    "control": 0.5
  },
  "core_potentials": {
    "stuff_potential": 0.3,
    "movement_potential": 0.4,
    "control_potential": 0.5
  },
  "pitch_arsenal": {
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
    "Knuckleball": 0.03
  },
  "pitch_arsenal_potential": {
    "fastball_potential": 0.02,
    "changeup_potential": 0.02,
    "splitter_potential": 0.02,
    "circle_change_potential": 0.02,
    "curveball_potential": 0.02,
    "slider_potential": 0.02,
    "knuckle_curve_potential": 0.02,
    "screwball_potential": 0.01,
    "sinker_potential": 0.02,
    "cutter_potential": 0.01,
    "forkball_potential": 0.01,
    "knuckleball_potential": 0.02
  },
  "other_attributes": {
    "number_of_pitches": 0.15,
    "velocity": 0.0,
    "stamina": 0.02,
    "ground_fly_ratio": 0.01,
    "holds": 0.01,
    "scout_accuracy": 0.0
  },
  "penalties": {
    "penalty_sp_low_pitches": -0.2,
    "penalty_sp_low_stamina": -0.5,
    "penalty_sp_low_control": -0.3,
    "penalty_sp_low_control_potential": -0.3,
    "no_pitch_50_plus": -0.4,
    "no_pitch_potential_50_plus": -0.4
  }
};

export const DEFAULT_BATTER_WEIGHTS = {
  "meta": {
    "overall": 1.0,
    "potential": 1.0,
    "defense": 1.0,
    "baserunning": 1.0
  },
  "overall": {
    "contact": 0.3,
    "gap": 0.1,
    "power": 0.4,
    "eye": 0.3,
    "strikeouts": 0.1
  },
  "potential": {
    "contact_potential": 0.3,
    "gap_potential": 0.1,
    "power_potential": 0.4,
    "eye_potential": 0.3,
    "strikeouts_potential": 0.1
  },
  "defense": {
    "catcher": {
      "catcher_ability": 0.3,
      "catcher_arm": 0.2,
      "catcher_framing": 0.2
    },
    "infield": {
      "infield_range": {
        "1B": 0.2,
        "2B": 0.2,
        "SS": 0.3,
        "3B": 0.2
      },
      "infield_error": 0.2,
      "infield_arm": {
        "1B": 0.2,
        "2B": 0.2,
        "SS": 0.2,
        "3B": 0.3
      }
    },
    "outfield": {
      "outfield_range": {
        "LF": 0.2,
        "CF": 0.3,
        "RF": 0.2
      },
      "outfield_error": 0.2,
      "outfield_arm": 0.2
    }
  },
  "baserunning": {
    "speed": 0.1,
    "stealing": 0.1,
    "running": 0.1
  },
  "scout_accuracy": 0.0
};

export function defaultPitcherWeights() {
  return structuredClone(DEFAULT_PITCHER_WEIGHTS);
}

export function defaultBatterWeights() {
  return structuredClone(DEFAULT_BATTER_WEIGHTS);
}
