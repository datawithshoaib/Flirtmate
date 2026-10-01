"""Start the Flirtmate API and web app together from the repository root."""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
API_PORT = int(os.environ.get("FLIRTMATE_API_PORT", "8001"))


def python_command() -> str:
    """Return the backend virtual environment interpreter."""
    if os.name == "nt":
        candidate = BACKEND / ".venv" / "Scripts" / "python.exe"
    else:
        candidate = BACKEND / ".venv" / "bin" / "python"
    return str(candidate)


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        process.send_signal(signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> int:
    if not (BACKEND / "app" / "main.py").is_file() or not (FRONTEND / "package.json").is_file():
        print("Couldn't find the backend and frontend. Run this file from the Flirtmate project.", file=sys.stderr)
        return 1

    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        print("Node.js and npm are required. Install Node.js 20+, then try again.", file=sys.stderr)
        return 1
    if not (FRONTEND / "node_modules").is_dir():
        print("Frontend packages are missing. Run `npm install` in the frontend folder first.", file=sys.stderr)
        return 1

    py = python_command()
    if not Path(py).is_file():
        print("Backend virtual environment is missing. Create it at `backend/.venv` and install `backend/requirements.txt`.", file=sys.stderr)
        return 1

    processes: list[tuple[str, subprocess.Popen[bytes]]] = []
    try:
        api = subprocess.Popen(
            [py, "-m", "uvicorn", "app.main:app", "--reload", "--port", str(API_PORT)],
            cwd=BACKEND,
        )
        processes.append(("API", api))

        if os.name == "nt":
            web = subprocess.Popen(
                [npm, "run", "dev"],
                cwd=FRONTEND,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            )
        else:
            web = subprocess.Popen([npm, "run", "dev"], cwd=FRONTEND)
        processes.append(("Web app", web))

        print("Flirtmate is starting:")
        print("  Web app: http://localhost:3000")
        print(f"  API:     http://localhost:{API_PORT}/docs")
        print("Press Ctrl+C to stop both servers.\n")

        while True:
            for name, process in processes:
                code = process.poll()
                if code is not None:
                    print(f"{name} stopped with exit code {code}.", file=sys.stderr)
                    return code or 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping Flirtmate...")
        return 0
    except FileNotFoundError as exc:
        print(f"Couldn't start a server: {exc}", file=sys.stderr)
        return 1
    finally:
        for _, process in reversed(processes):
            stop_process(process)


if __name__ == "__main__":
    raise SystemExit(main())
