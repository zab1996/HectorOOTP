section_weights = {
    "meta": {
        "overall": 1.0,    # multiplier to weight all overall current ratings
        "potential": 1.0,  # multiplier to weight all potential ratings
        "defense": 1.0,    # multiplier for defense weights
        "baserunning": 1.0 # multiplier for baserunning weights
    },

    "overall": {
        "contact": 0.3,
        "gap": 0.1,
        "power": 0.4,
        "eye": 0.3,
        "strikeouts": 0.1,
    },

    "potential": {
        "contact_potential": 0.3,
        "gap_potential": 0.1,
        "power_potential": 0.4,
        "eye_potential": 0.3,
        "strikeouts_potential": 0.1,
    },

    "defense": {
        "catcher": {
            "catcher_ability": 0.5,
            "catcher_arm": 0.3,
            "catcher_blocking": 0.4
        },
        "infield": {
            "infield_range": {
                "1B": 0.2,
                "2B": 0.2,
                "SS": 0.4,
                "3B": 0.2
            },
            "infield_error": 0.2,
            "infield_arm": {
                "1B": 0.2,
                "2B": 0.2,
                "SS": 0.2,
                "3B": 0.4
            }
        },
        "outfield": {
            "outfield_range": {
                "LF": 0.2,
                "CF": 0.4,
                "RF": 0.2
            },
            "outfield_error": 0.2,
            "outfield_arm": 0.2
        }
    },

    "baserunning": {
        "speed": 0.1,
        "stealing": 0.1,
        "running": 0.1,
    },

    "scout_accuracy": 0.5
}
