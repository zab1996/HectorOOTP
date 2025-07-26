import tkinter as tk

def create_tooltip(widget, text):
    tooltip = tk.Toplevel(widget)
    tooltip.withdraw()
    tooltip.overrideredirect(True)
    tooltip.configure(bg="#333", padx=5, pady=3)
    label = tk.Label(tooltip, text=text, bg="#333", fg="#fff", font=("Consolas", 10), justify="left")
    label.pack()
    def enter(event):
        x = widget.winfo_rootx() + 20
        y = widget.winfo_rooty() + widget.winfo_height() + 5
        tooltip.geometry(f"+{x}+{y}")
        tooltip.deiconify()
    def leave(event):
        tooltip.withdraw()
    widget.bind("<Enter>", enter)
    widget.bind("<Leave>", leave)


def add_search_tooltip(widget, tab_type="pitcher"):
    """
    Adds tooltip to the search entry widget for pitchers or batters.

    Parameters:
        widget: The Tkinter widget (usually ttk.Entry) to attach the tooltip to.
        tab_type: "pitcher" or "batter" to determine appropriate tooltip text.
    """
    if tab_type == "pitcher":
        tip_text = (
            "Search tips:\n"
            "- Filter by team: CAS, ATL\n"
            "- Filter by position: SP, RP\n"
            "- Numeric filters with >, <, >=, <=, = for Age, e.g. '>25'\n"
            "- Combine filters, e.g. 'CAS SP >25'"
        )
    elif tab_type == "batter":
        tip_text = (
            "Search tips:\n"
            "- Filter by team: CAS, ATL\n"
            "- Filter by position: C, 1B, 2B, ...\n"
            "- Numeric filters with >, <, >=, <=, = for Age, e.g. '<30'\n"
            "- Combine filters, e.g. 'ATL 2B <30'"
        )
    else:
        tip_text = "Search the list"

    from .tooltips import create_tooltip
    create_tooltip(widget, tip_text)

