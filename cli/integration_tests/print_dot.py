"""
Provides methods to test the Print-dot commands in Chipmunk Build CLI Tool
"""

from utls import run_command, print_green_bold, print_blue_bold

PRINT_DOT_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "print-dot",
]

PRINT_DOT_ALL_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "print-dot",
    "-a",
]


def run_print_dot_commands():
    """Runs print dot commands for both targets and tasks"""
    print_blue_bold("Running General Print Dot command...")
    run_command(PRINT_DOT_COMMAND)
    print_green_bold("*** General Print Dot command Succeeded ***")

    print_blue_bold("Running All Print Dot command...")
    run_command(PRINT_DOT_ALL_COMMAND)
    print_green_bold("*** All Print Dot command Succeeded ***")


if __name__ == "__main__":
    run_print_dot_commands()
