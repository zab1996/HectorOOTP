
from tabulate import tabulate
from gui import build_gui  # or wherever your GUI function is

if __name__ == "__main__":
    try:
        build_gui()
    except Exception as e:
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")