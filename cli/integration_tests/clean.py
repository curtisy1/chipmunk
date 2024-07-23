"""
Provides methods to test the Clean command in Chipmunk Build CLI Tool
"""

from pathlib import Path
from utls import run_command, print_blue_bold, print_green_bold, get_root

CLEAN_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "clean",
    # We need to set targets explicitly because we need to clean everything expect the build CLI tools
    # binaries to avoid failing on Windows when CLI tool tries to remove it's own binary.
    "core",
    "shared",
    "binding",
    "wrapper",
    "wasm",
    "client",
    "updater",
    "app",
]

# These paths must not exist after clean build is done.
# The paths are relative starting from `chipmunk_root/application`
PATHS_TO_CHECK = [
    # Core
    "apps/indexer/target",
    # Shared
    "platform/dist",
    "platform/node_modules",
    # Binding
    "apps/rustcore/rs-bindings/dist",
    "apps/rustcore/rs-bindings/target",
    # Wrapper
    "apps/rustcore/ts-bindings/dist",
    "apps/rustcore/ts-bindings/node_modules",
    "apps/rustcore/ts-bindings/spec/build",
    "apps/rustcore/ts-bindings/src/native/index.node",
    # Wasm
    "apps/rustcore/wasm-bindings/pkg",
    "apps/rustcore/wasm-bindings/node_modules",
    "apps/rustcore/wasm-bindings/test_output",
    # Client
    "client/dist",
    "client/node_modules",
    # Updater
    "apps/precompiled/updater/target",
    # App
    "holder/dist",
    "holder/node_modules",
]


def get_removed_paths() -> list[Path]:
    """Provides the paths for the directories that must be removed after running the clean command"""
    root_dir = get_root()
    application_dir = root_dir.joinpath("application")
    return [application_dir.joinpath(sub_dir) for sub_dir in PATHS_TO_CHECK]


def run_clean_command():
    """Runs Clean Commands on all targets and insure that all build directories are delted."""
    print_blue_bold("Running clean command...")
    run_command(CLEAN_COMMAND)
    for path in get_removed_paths():
        if path.exists():
            raise AssertionError(f"Path exists after clean. Path: {path}")

    print_green_bold("*** Check for Clean Command Succeeded ***")


if __name__ == "__main__":
    run_clean_command()
