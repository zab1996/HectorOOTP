import tkinter as tk

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
