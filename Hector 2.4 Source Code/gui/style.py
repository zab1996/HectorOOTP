import tkinter as tk
from tkinter import ttk

def setup_theme(font, root):
    style = ttk.Style(root)
    
    # Option 1: Try 'alt' theme
    style.theme_use('clam')
    
    style.configure('.', background='#1e1e1e', foreground='#d4d4d4', fieldbackground='#1e1e1e', font=font)
    style.configure('TFrame', background='#1e1e1e', bordercolor='#1e1e1e')
    style.configure('TLabel', background='#1e1e1e', foreground='#d4d4d4')
    style.configure('TCheckbutton', background='#1e1e1e', bordercolor='#1e1e1e')
    
    # Treeview
    style.configure('Treeview',
                    background='#1e1e1e',
                    foreground='#d4d4d4',
                    fieldbackground='#1e1e1e',
                    bordercolor='#1e1e1e',
                    font=font)
    
    style.map('Treeview',
              background=[('selected', '#0078d7')],
              foreground=[('selected', '#ffffff')])
    
    style.configure('Toolbutton', padding=[8,5,8,5])
    
    # Treeview Heading
    style.map('Treeview.Heading',
              background=[
                  ('active', '#232e23'),
                  ('pressed', '#232e23'),
                  ('!active', '#000000')
              ],
              foreground=[
                  ('active', '#00ff7f'),
                  ('pressed', '#00ff7f'),
                  ('!active', '#d4d4d4')
              ]
    )
    
    # Scrollbars
    style.configure('Vertical.TScrollbar', background='#1e1e1e', troughcolor='#1e1e1e', bordercolor='#1e1e1e')
    style.configure('Horizontal.TScrollbar', background='#1e1e1e', troughcolor='#1e1e1e', bordercolor='#1e1e1e')
    
    style.map('Vertical.TScrollbar',
              background=[('disabled', '#1e1e1e'), ('!disabled', '#000000')],
              troughcolor=[('disabled', '#1e1e1e'), ('!disabled', '#1e1e1e')],
              bordercolor=[('disabled', '#1e1e1e'), ('!disabled', '#1e1e1e')])
    
    style.map('Horizontal.TScrollbar',
              background=[('disabled', '#1e1e1e'), ('!disabled', '#000000')],
              troughcolor=[('disabled', '#1e1e1e'), ('!disabled', '#1e1e1e')],
              bordercolor=[('disabled', '#1e1e1e'), ('!disabled', '#1e1e1e')])
    
    # Notebook & Tabs
    style.configure('TNotebook', background='#1e1e1e', borderwidth=0)
    style.configure('TNotebook.Tab',
                    background='#2a2a2a',
                    foreground='#d4d4d4',
                    padding=[10,5])
    
    style.map('TNotebook.Tab',
              background=[('selected', '#000000')],
              foreground=[('selected', '#00ff7f')])
    
    # Buttons
    style.configure('TButton', background='#2a2a2a', foreground='#d4d4d4', borderwidth=0)
    style.map('TButton',
              background=[('active', '#0078d7')],
              foreground=[('active', '#ffffff')])
    
    # Entry
    style.configure('TEntry', fieldbackground='#1e1e1e', background='#1e1e1e', foreground='#d4d4d4')
    
    style.configure(
        "Neon.Horizontal.TProgressbar",
        troughcolor="#FFFFFF",
        bordercolor='#000000',
        background="#00ff00",
        lightcolor='#00ff00',
        darkcolor='#00ff00',
        thickness=22
    )



# ---- Hover highlight and sort functions ----

def on_treeview_motion(event):
    tree = event.widget
    row_id = tree.identify_row(event.y)
    
    # Restore previous hover row's tags
    if hasattr(tree, '_prev_hover') and tree._prev_hover:
        if tree.exists(tree._prev_hover):
            # Restore original tags from _original_row_tags if available
            original_tags = getattr(tree, '_original_row_tags', {}).get(tree._prev_hover, ())
            tree.item(tree._prev_hover, tags=original_tags)
        tree._prev_hover = None
    
    if row_id:
        # Save original tags if not already saved
        if not hasattr(tree, '_original_row_tags'):
            tree._original_row_tags = {}
        if row_id not in tree._original_row_tags:
            tree._original_row_tags[row_id] = tree.item(row_id, 'tags')
        
        # Add "hover" to whatever tags the row had before
        base_tags = tree._original_row_tags[row_id]
        tags = tuple(set(base_tags) | {"hover"})
        tree.item(row_id, tags=tags)
        tree._prev_hover = row_id

def on_leave(event):
    tree = event.widget
    if hasattr(tree, '_prev_hover') and tree._prev_hover:
        # Restore original tags if we saved them
        original_tags = getattr(tree, '_original_row_tags', {}).get(tree._prev_hover, ())
        tree.item(tree._prev_hover, tags=original_tags)
        tree._prev_hover = None

def sort_treeview(tree, col, reverse):
    data = [(tree.set(k, col), k) for k in tree.get_children("")]
    
    if col.lower() == "prone":
        order = {
            "wrecked": 0,
            "fragile": 1,
            "normal": 2,
            "durable": 3,
            "iron man": 4,
            "ironman": 4,
        }
        
        def rank(val): 
            return order.get(val.lower(), -1)
        
        data.sort(key=lambda t: rank(t[0]), reverse=reverse)
    
    elif "velo" in col.lower():
        def velo_value(val):
            val = str(val).strip()
            if val.endswith("+"):
                try: 
                    return float(val[:-1]) + 1.1
                except: 
                    return -1
            elif "-" in val:
                try: 
                    return float(val.split("-")[-1])
                except: 
                    return -1
            else:
                try: 
                    return float(val)
                except: 
                    return -1
        
        data.sort(key=lambda t: velo_value(t[0]), reverse=reverse)
    
    else:
        try:
            data.sort(
                key=lambda t:
                float(str(t[0]).replace("-", "0").replace("Stars", "").strip()),
                reverse=reverse)
        except ValueError:
            data.sort(key=lambda t: str(t[0]).lower(), reverse=reverse)
    
    for idx, (val, k) in enumerate(data):
        tree.move(k, "", idx)
    
    arrow = " ▲" if not reverse else " ▼"
    for c in tree["columns"]:
        tree.heading(c, text=c)
    tree.heading(col, text=col + arrow, command=lambda: sort_treeview(tree, col, not reverse))
