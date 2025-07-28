import tkinter as tk
from tkinter import ttk
import webbrowser
import configparser
import os

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
    # Add more controls as needed
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

def make_clear_entry_handler(entry, string_var):
    """Attach a click-to-clear handler to the entry (shows ✕ when text present)."""
    clear_btn = tk.Label(entry.master, text="✕", fg="#aaa", bg="#1e1e1e", cursor="hand2")
    clear_btn.place_forget()

    def show_hide(*args):
        if string_var.get():
            x = entry.winfo_x() + entry.winfo_width() - 18
            y = entry.winfo_y() + 2
            clear_btn.place(x=x, y=y)
        else:
            clear_btn.place_forget()
    def clear_text(event=None):
        string_var.set("")
    clear_btn.bind("<Button-1>", clear_text)
    string_var.trace_add("write", show_hide)
    entry.bind("<Configure>", lambda e: show_hide())
    return clear_btn

def make_button_focus_handler(button):
    """Return handlers to visually highlight a button on focus/hover (optional style tweak)."""
    def on_enter(event):
        button.configure(style="Accent.TButton")
    def on_leave(event):
        button.configure(style="TButton")
    button.bind("<Enter>", on_enter)
    button.bind("<Leave>", on_leave)
    return (on_enter, on_leave)


def make_treeview_open_link_handler(treeview, id_map, url_template_func):
    """
    Attaches a double-click handler to a Treeview which, when a row is double-clicked,
    uses the id_map to fetch the record key and opens the URL generated from url_template_func(pid).
    """
    def on_double(event):
        region = treeview.identify_region(event.x, event.y)
        if region == "heading":
            return
        item_id = treeview.focus()
        pid = id_map.get(item_id)
        if pid:
            webbrowser.open(url_template_func(pid))
    treeview.bind("<Double-1>", on_double)
    # No return needed; handler attached directly


def update_summary_widgets(DATA, summary_left_var, summary_right_var):
    """Update left/right summary StringVars for the main summary bar."""

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

    from collections import defaultdict
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



def load_player_url_template():
    config = configparser.ConfigParser()
    # Locate config.ini relative to this file or the executable
    root_dir = os.path.dirname(os.path.abspath(__file__))
    candidate_paths = [
        os.path.join(root_dir, "..", "config.ini"),  # If running from gui/
        os.path.join(root_dir, "config.ini"),
    ]
    for path in candidate_paths:
        if os.path.isfile(path):
            config.read(path)
            break
    else:
        # Default
        return "https://atl-01.statsplus.net/rfbl/player/{pid}?page=dash"
    return config.get("links", "player_url_template", fallback="https://atl-01.statsplus.net/rfbl/player/{pid}?page=dash")


