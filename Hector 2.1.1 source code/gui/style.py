import tkinter as tk
from tkinter import ttk

# ---- Styles ----
def setup_theme(font):
    style = ttk.Style()
    # Removed conflicting theme_use call (do NOT call theme_use here!)
    # Assume theme is set globally in core.py (to 'clam')

    style.configure(
        "Treeview",
        background="#1e1e1e",
        foreground="#d4d4d4",
        fieldbackground="#1e1e1e",
        font=font)
    style.map("Treeview", background=[("selected", "#264f78")])

# ---- Hover highlight ----
def on_treeview_motion(event):
    tree = event.widget
    if hasattr(tree, '_prev_hover') and tree._prev_hover:
        # Check item still exists
        if tree.exists(tree._prev_hover):
            tree.item(tree._prev_hover, tags=())
        tree._prev_hover = None

    # Identify the item under the mouse cursor
    row_id = tree.identify_row(event.y)
    if row_id:
        tree.item(row_id, tags=("hover",))
        tree._prev_hover = row_id
    else:
        tree._prev_hover = None

def on_leave(event):
    tree = event.widget
    if getattr(tree, "_prev_hover", None):
        tree.item(tree._prev_hover, tags=())
        tree._prev_hover = None

# ---- Column sorting w/ arrow ----
def sort_treeview(tree, col, reverse):
    data = [(tree.set(k, col), k) for k in tree.get_children("")]
    # Sort rules
    if col.lower() == "prone":
        order = {
            "wrecked": 0,
            "fragile": 1,
            "normal": 2,
            "durable": 3,
            "iron man": 4,
            "ironman": 4,
        }
        def rank(val): return order.get(val.lower(), -1)
        data.sort(key=lambda t: rank(t[0]), reverse=reverse)
    elif "velo" in col.lower():
        def velo_value(val):
            val = str(val).strip()
            if val.endswith("+"):
                try: return float(val[:-1]) + 1.1
                except: return -1
            elif "-" in val:
                try: return float(val.split("-")[-1])
                except: return -1
            else:
                try: return float(val)
                except: return -1
        data.sort(key=lambda t: velo_value(t[0]), reverse=reverse)
    else:
        try:
            data.sort(
                key=lambda t:
                    float(str(t[0]).replace("-", "0").replace("Stars", "").strip()),
                reverse=reverse)
        except ValueError:
            data.sort(key=lambda t: str(t[0]).lower(), reverse=reverse)
    # Reorder rows
    for idx, (val, k) in enumerate(data):
        tree.move(k, "", idx)
    # Arrow
    arrow = " ▲" if not reverse else " ▼"
    for c in tree["columns"]:
        tree.heading(c, text=c)
    tree.heading(col, text=col + arrow, command=lambda: sort_treeview(tree, col, not reverse))
