import tkinter as tk
from tkinter import ttk
import webbrowser
import configparser
import os
import re
from collections import defaultdict
import sys

### -------- UI Factories and Utility Widgets -------- ###

def set_app_icon(root, icon_filename="hector_icon.ico"):
    """
    Uses hector_icon.ico from internal/ for the window and taskbar icon at runtime.
    """
    import sys
    import os

    if getattr(sys, "frozen", False):
        # In PyInstaller bundle: sys._MEIPASS points to temp folder where files are extracted
        base_dir = os.path.join(sys._MEIPASS, "internal")
    else:
        # In development: assume internal/ is next to this file
        base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "internal")

    icon_path = os.path.join(base_dir, icon_filename)

    if os.path.isfile(icon_path):
        try:
            root.iconbitmap(icon_path)
        except Exception:
            # fallback to .png
            png_path = os.path.splitext(icon_path)[0] + ".png"
            try:
                import tkinter as tk
                img = tk.PhotoImage(file=png_path)
                root.iconphoto(True, img)
            except Exception:
                pass





def create_title_label(parent, font, text):
    return tk.Label(
        parent,
        text=text,
        font=(font[0], font[1]+3, "bold"),
        fg="#00ff7f",
        bg="#1e1e1e",
        anchor="w"
    )

def create_control_frame(parent, reload_callback, font):
    frame = tk.Frame(parent, bg="#1e1e1e")
    reload_btn = ttk.Button(frame, text="Reload Data", command=reload_callback)
    reload_btn.pack(side="left", padx=5)
    return frame, reload_btn

def create_summary_widgets(parent, font):
    frame = tk.Frame(parent, bg="#1e1e1e")
    left_var = tk.StringVar()
    left_label = tk.Label(
        frame, textvariable=left_var, font=font,
        fg="#d4d4d4", bg="#1e1e1e", anchor="w", justify="left")
    left_label.pack(side="left", fill="x", expand=True)

    right_var = tk.StringVar()
    right_label = tk.Label(
        frame, textvariable=right_var, font=font,
        fg="#d4d4d4", bg="#1e1e1e", anchor="ne", justify="left")
    right_label.pack(side="right", fill="y", padx=(10, 0))
    return frame, left_var, right_var

def add_clear_button(entry, variable):
    clear_btn = tk.Label(entry.master, text="✕", fg="#aaa", bg="#1e1e1e", cursor="hand2")
    clear_btn.place_forget()
    def show_hide(*args):
        if variable.get():
            x = entry.winfo_x() + entry.winfo_width() - 18
            y = entry.winfo_y() + 2
            clear_btn.place(x=x, y=y)
        else:
            clear_btn.place_forget()
    def clear_text(event=None):
        variable.set("")
    clear_btn.bind("<Button-1>", clear_text)
    variable.trace_add("write", show_hide)
    return clear_btn

def make_treeview_open_link_handler(treeview, id_map, url_template_func):
    def on_double(event):
        region = treeview.identify_region(event.x, event.y)
        if region == "heading":
            return
        item_id = treeview.focus()
        pid = id_map.get(item_id)
        if pid:
            webbrowser.open(url_template_func(pid))
    treeview.bind("<Double-1>", on_double)

def load_player_url_template():
    config = configparser.ConfigParser()
    if getattr(sys, 'frozen', False):
        app_dir = os.path.dirname(sys.executable)
    else:
        app_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(app_dir, "config.ini")
    if not os.path.isfile(config_path):
        return "https://atl-01.statsplus.net/rfbl/player/{pid}?page=dash"
    config.read(config_path)
    return config.get(
        "links",
        "player_url_template",
        fallback="https://atl-01.statsplus.net/rfbl/player/{pid}?page=dash"
    )

### -------- General Filtering/Highlighting/Position Filter -------- ###

def filter_players(players, allowed_positions, search, player_type="batter"):
    raw_terms = search.strip().split()
    text_search_terms = []
    age_filters = []
    comp_re = re.compile(r'^([<>]=?|=)?(\d+)$')
    for term in raw_terms:
        match = comp_re.match(term)
        if match:
            op = match.group(1) or '='
            num = int(match.group(2))
            age_filters.append((op, num))
        else:
            text_search_terms.append(term.lower())
    filtered = []
    for player in players:
        pos = player.get("POS", "")
        if pos not in allowed_positions:
            continue
        fields = f"{player.get('Name', '')} {player.get('ORG', '')} {pos}".lower()
        if not all(term in fields for term in text_search_terms):
            continue
        age_raw = player.get("Age", "")
        age = int(age_raw) if age_raw.isdigit() else None
        if age is None and age_filters:
            continue
        age_filter_failed = False
        for op, num in age_filters:
            if op == '>':
                if not (age > num): 
                    age_filter_failed = True
                    break
            elif op == '<':
                if not (age < num): 
                    age_filter_failed = True
                    break
            elif op == '>=':
                if not (age >= num): 
                    age_filter_failed = True
                    break
            elif op == '<=':
                if not (age <= num): 
                    age_filter_failed = True
                    break
            elif op == '=':
                if not (age == num): 
                    age_filter_failed = True
                    break
        if age_filter_failed:
            continue
        filtered.append(player)
    return filtered

def get_batter_highlight_tags(b):
    tags = []
    if b.get("POS", "") == "1B":
        range_ = int(b.get("IF RNG", 0)) if str(b.get("IF RNG", "0")).isdigit() else 0
        arm = int(b.get("IF ARM", 0)) if str(b.get("IF ARM", "0")).isdigit() else 0
        error = int(b.get("IF ERR", 0)) if str(b.get("IF ERR", "0")).isdigit() else 0
        if range_ >= 50 and arm >= 55 and error >= 45:
            tags.append("1b_to_3b")
    if b.get("POS", "") == "2B":
        range_ = int(b.get("IF RNG", 0)) if str(b.get("IF RNG", "0")).isdigit() else 0
        arm = int(b.get("IF ARM", 0)) if str(b.get("IF ARM", "0")).isdigit() else 0
        error = int(b.get("IF ERR", 0)) if str(b.get("IF ERR", "0")).isdigit() else 0
        dp = int(b.get("TDP", 0)) if str(b.get("TDP", "0")).isdigit() else 0
        if range_ >= 60 and arm >= 50 and error >= 50 and dp >= 50:
            tags.append("2b_to_ss")
    return tags

def get_pitcher_highlight_tags(p):
    tags = []
    pos = "RP" if p.get("POS") == "CL" else p.get("POS")
    num_pitches = int(p.get("PIT", 0)) if str(p.get("PIT", "0")).isdigit() else 0
    stamina = int(p.get("STM", 0)) if str(p.get("STM", "0")).isdigit() else 0
    if pos == "RP" and num_pitches >= 3 and stamina >= 50:
        tags.append("rp_sp_potential")
    return tags

def add_grouped_position_filters(parent, pos_vars, on_change):
    IF_POSITIONS = ["C", "1B", "2B", "3B", "SS"]
    OF_POSITIONS = ["LF", "CF", "RF"]
    group_row = tk.Frame(parent, bg="#1e1e1e", highlightthickness=0, highlightbackground="#1e1e1e", bd=0)
    group_row.pack(fill='x', pady=(0, 2))
    if_var = tk.BooleanVar(value=all(pos_vars[p].get() for p in IF_POSITIONS))
    of_var = tk.BooleanVar(value=all(pos_vars[p].get() for p in OF_POSITIONS))

    def set_group_positions(var, positions):
        val = var.get()
        for p in positions:
            pos_vars[p].set(val)
        on_change()

    def update_group_vars(*_):
        if_var.set(all(pos_vars[p].get() for p in IF_POSITIONS))
        of_var.set(all(pos_vars[p].get() for p in OF_POSITIONS))

    cbargs = dict(
        bg="#1e1e1e", fg="#d4d4d4", selectcolor="#1e1e1e",
        activebackground="#1e1e1e", activeforeground="#d4d4d4",
        highlightthickness=0,
        highlightbackground="#1e1e1e",
        highlightcolor="#1e1e1e",
        takefocus=0,
        bd=0
    )

    if_cb = tk.Checkbutton(
        group_row, text="IF", variable=if_var,
        command=lambda: set_group_positions(if_var, IF_POSITIONS),
        **cbargs
    )
    of_cb = tk.Checkbutton(
        group_row, text="OF", variable=of_var,
        command=lambda: set_group_positions(of_var, OF_POSITIONS),
        **cbargs
    )

    if_cb.pack(side="left", padx=3)
    of_cb.pack(side="left", padx=12)

    # IF checkboxes
    if_positions_row = tk.Frame(parent, bg="#1e1e1e", highlightthickness=0, highlightbackground="#1e1e1e", bd=0)
    if_positions_row.pack(fill='x')
    for p in IF_POSITIONS:
        cb = tk.Checkbutton(if_positions_row, text=p, variable=pos_vars[p], command=on_change, **cbargs)
        cb.pack(side="left", padx=3)
        pos_vars[p].trace_add("write", update_group_vars)
    # OF checkboxes
    of_positions_row = tk.Frame(parent, bg="#1e1e1e", highlightthickness=0, highlightbackground="#1e1e1e", bd=0)
    of_positions_row.pack(fill='x', pady=(3, 0))
    for p in OF_POSITIONS:
        cb = tk.Checkbutton(of_positions_row, text=p, variable=pos_vars[p], command=on_change, **cbargs)
        cb.pack(side="left", padx=3)
        pos_vars[p].trace_add("write", update_group_vars)
    # Single "DH" - FIXED
    dh_row = tk.Frame(parent, bg="#1e1e1e", highlightthickness=0, highlightbackground="#1e1e1e", bd=0)
    dh_row.pack(fill='x', pady=(3, 0))
    cb = tk.Checkbutton(dh_row, text="DH", variable=pos_vars["DH"], command=on_change, **cbargs)
    cb.pack(side="left", padx=3)

### --------- (Optional) Data Validation --------- ###

def validate_fields(players, required_fields):
    missing_fields = set()
    for player in players:
        for field in required_fields:
            if field not in player or player[field] in [None, ""]:
                missing_fields.add(field)
    return missing_fields

def detect_wrong_import(players, valid_positions, wrong_positions):
    seen_positions = {p.get("POS", "").upper() for p in players}
    seen_positions.discard("")
    if not seen_positions:
        return False
    return seen_positions.issubset(wrong_positions) and not (seen_positions & valid_positions)

### --------- Summary Widget Updater --------- ###

def update_summary_widgets(DATA, summary_left_var, summary_right_var):
    num_pitchers = len(DATA.pitchers)
    num_batters = len(DATA.batters)
    sp_pitchers = [p for p in DATA.pitchers if p.get("POS") == "SP"]
    rp_pitchers = [p for p in DATA.pitchers if p.get("POS") == "RP"]
    def avg_total(players):
        scores = [p["Scores"].get("total", 0) for p in players if "Scores" in p]
        return round(sum(scores) / len(scores), 2) if scores else 0
    avg_sp = avg_total(sp_pitchers)
    avg_rp = avg_total(rp_pitchers)
    avg_batters_score = avg_total(DATA.batters)
    left_summary = (
        f"Pitchers in data: {num_pitchers} (SP: {len(sp_pitchers)}, RP: {len(rp_pitchers)})\n"
        f"Batters in data: {num_batters}\n"
        f"Average Total Score - SP: {avg_sp} RP: {avg_rp} Batters: {avg_batters_score}"
    )
    summary_left_var.set(left_summary)
    pos_groups = defaultdict(list)
    for b in DATA.batters:
        pos = b.get("POS", "Unknown")
        pos_groups[pos].append(b)
    pos_avg_scores = {pos: avg_total(players) for pos, players in pos_groups.items()}
    group1_positions = ["C", "1B", "2B", "3B", "SS"]
    group2_positions = ["CF", "LF", "RF"]
    def format_pos_group(positions):
        items = []
        for pos in positions:
            score = pos_avg_scores.get(pos, "N/A")
            items.append(f"{pos}: {score}".ljust(15))
        return " ".join(items)
    right_lines = [
        "Average Total Score by Batter Position:",
        "",
        "Infield: " + format_pos_group(group1_positions),
        "Outfield: " + format_pos_group(group2_positions)
    ]
    summary_right_var.set("\n".join(right_lines))

def make_debounced_callback(root, wait_ms, func):
    after_id = [None]
    def debounced(*args, **kwargs):
        if after_id[0]:
            root.after_cancel(after_id[0])
        after_id[0] = root.after(wait_ms, lambda: func(*args, **kwargs))
    return debounced

def show_loading_bar(
    root,
    label_text="Loading data, please wait...",
    font=None,
    bar_color="#09ff00",
    bg="#000000"
):
    frame = tk.Frame(root, bg=bg)
    frame.place(relx=0.5, rely=0.47, anchor="center")
    loading_label = tk.Label(
        frame,
        text=label_text,
        font=font if font else ("Consolas", 20, "bold"),
        fg="#09ff00",
        bg=bg,
    )
    loading_label.pack(padx=70, pady=(44, 18))
    progress = ttk.Progressbar(
        frame,
        mode="indeterminate",
        length=420,
        style="Neon.Horizontal.TProgressbar"
    )
    progress.pack(padx=70, pady=(0, 40))
    progress.start(8)
    root.update_idletasks()
    root.update()
    return frame, progress
