#!/usr/bin/env python3
"""Run local Postgres, one API worker, and Vite; keep state under .local/."""

from __future__ import annotations

import os
import secrets
import shutil
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = (
    ROOT
    / "backend"
    / ".venv"
    / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
)


def main() -> None:
    """Bootstrap missing development dependencies and own the child-process lifecycle."""
    if not PYTHON.exists():
        subprocess.run(
            [sys.executable, "-m", "venv", str(PYTHON.parent.parent)], check=True
        )
    try:
        subprocess.run(
            [
                str(PYTHON),
                "-c",
                "import pgserver,fastapi,asyncpg,argon2,jwt,numpy,apscheduler,selectolax,h11",
            ],
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        subprocess.run(
            [str(PYTHON), "-m", "pip", "install", "-e", ".[dev,local]"],
            cwd=ROOT / "backend",
            check=True,
        )
    if Path(sys.prefix).resolve() != PYTHON.parent.parent.resolve():
        os.execv(str(PYTHON), [str(PYTHON), __file__])
    import pgserver
    from dotenv import dotenv_values

    env = os.environ.copy()
    config = dict(dotenv_values(ROOT / "backend" / ".env"))
    for key in ["JWT_SECRET", "SALT_SECRET", "CRON_SECRET"]:
        env[key] = env.get(key) or config.get(key) or secrets.token_urlsafe(48)
    env["ALLOWED_ORIGINS"] = (
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
    )
    database = None
    if not env.get("DATABASE_URL"):
        directory = ROOT / ".local" / "postgres"
        directory.parent.mkdir(parents=True, exist_ok=True)
        database = pgserver.get_server(directory, cleanup_mode="stop")
        env["DATABASE_URL"] = database.get_uri()
    env.setdefault("PUBLIC_API_URL", "http://localhost:8000")
    if not (ROOT / "backend" / ".env").exists():
        (ROOT / "backend" / ".env").write_text(
            "\n".join(
                f"{key}={env[key]}"
                for key in [
                    "DATABASE_URL",
                    "JWT_SECRET",
                    "SALT_SECRET",
                    "CRON_SECRET",
                    "ALLOWED_ORIGINS",
                ]
            )
            + "\n"
        )
    candidates = [os.environ.get("PULSE_NODE"), shutil.which("node")]
    candidates += [
        str(path)
        for path in sorted(
            (Path.home() / ".nvm" / "versions" / "node").glob("v22*/bin/node"),
            reverse=True,
        )
    ]
    node = None
    for candidate in filter(None, candidates):
        try:
            subprocess.run([candidate, "--version"], check=True, capture_output=True)
            node = Path(candidate)
            break
        except (OSError, subprocess.CalledProcessError):
            continue
    if node is None:
        raise SystemExit("Install Node 22, then rerun this command.")
    env["PATH"] = str(node.parent) + os.pathsep + env.get("PATH", "")
    npm = shutil.which("npm", path=env["PATH"])
    if not (ROOT / "web" / "node_modules").exists():
        subprocess.run([npm, "ci"], cwd=ROOT / "web", env=env, check=True)
    subprocess.run(
        [str(PYTHON), "-m", "alembic", "upgrade", "head"],
        cwd=ROOT / "backend",
        env=env,
        check=True,
    )
    children = [
        subprocess.Popen(
            [
                str(PYTHON),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
                "--workers",
                "1",
                "--no-access-log",
            ],
            cwd=ROOT / "backend",
            env=env,
        ),
        subprocess.Popen(
            [npm, "run", "dev"],
            cwd=ROOT / "web",
            env={**env, "VITE_API_URL": "http://localhost:8000"},
        ),
    ]

    def stop(signum=None, frame=None):
        for process in children:
            if process.poll() is None:
                process.terminate()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    print(
        "\nPulse: http://localhost:5173\nAPI docs: http://localhost:8000/docs\n"
        "Ctrl+C stops the local services. Data stays in .local/postgres.\n",
        flush=True,
    )
    try:
        children[0].wait()
    finally:
        stop()
        for process in children:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        if database is not None:
            database = None


if __name__ == "__main__":
    main()
