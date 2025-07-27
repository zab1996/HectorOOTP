from gui.core import build_gui

if __name__ == "__main__":
    try:
        build_gui()
    except Exception as e:
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
