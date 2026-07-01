"""Build the Vite frontend into public/ for Vercel static hosting."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
PUBLIC = ROOT / "public"


def main() -> None:
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    subprocess.run([npm, "ci"], cwd=FRONTEND, check=True)
    subprocess.run([npm, "run", "build"], cwd=FRONTEND, check=True)
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    shutil.copytree(FRONTEND / "dist", PUBLIC)
    print(f"Frontend built to {PUBLIC}")


if __name__ == "__main__":
    main()
