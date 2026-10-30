#!/usr/bin/env python3
"""Local development launcher for StudyRoom."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import signal
import shutil
import subprocess
import sys
import time


PROJECT_ROOT = Path(__file__).resolve().parent
REQUIRED_ENV_KEYS = {
    "DATABASE_URL",
    "SESSION_SECRET",
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
}
WEB_DEV_PORT = 5173


class LauncherError(RuntimeError):
    """A user-actionable launcher failure."""


def log(message: str) -> None:
    print(f"[StudyRoom] {message}", flush=True)


def run_checked(
    command: list[str],
    *,
    quiet: bool = False,
    environment: dict[str, str] | None = None,
) -> None:
    log(f"Running: {' '.join(command)}")
    result = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        stdout=subprocess.DEVNULL if quiet else None,
        stderr=subprocess.DEVNULL if quiet else None,
        env=environment,
        check=False,
    )
    if result.returncode != 0:
        raise LauncherError(
            f"Command failed with exit code {result.returncode}: {' '.join(command)}"
        )


def require_command(name: str, install_hint: str) -> None:
    if shutil.which(name) is None:
        raise LauncherError(f"{name} is not installed. {install_hint}")


def check_node_version() -> None:
    result = subprocess.run(
        ["node", "--version"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise LauncherError("Unable to determine the installed Node.js version.")

    version = result.stdout.strip().lstrip("v")
    try:
        major = int(version.split(".", 1)[0])
    except ValueError as error:
        raise LauncherError(f"Unrecognized Node.js version: {version}") from error
    if major < 20:
        raise LauncherError(f"Node.js 20 or newer is required; found {version}.")


def configured_environment() -> dict[str, str]:
    """Load root dotenv values with the same precedence as the API."""
    values: dict[str, str] = {}
    for filename in (".env", ".env.local"):
        path = PROJECT_ROOT / filename
        if not path.is_file():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.removeprefix("export ").split("=", 1)
            key = key.strip()
            value = value.strip()
            if key:
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                values[key] = value
    values.update(os.environ)
    return values


def check_environment(*, bootstrap_admin: bool) -> None:
    if not (PROJECT_ROOT / ".env.local").is_file() and not (
        PROJECT_ROOT / ".env"
    ).is_file():
        raise LauncherError(
            "No .env.local or .env file was found. Copy .env.example to "
            ".env.local and replace its placeholder secrets."
        )

    required = set(REQUIRED_ENV_KEYS)
    if bootstrap_admin:
        required.update({"ADMIN_BOOTSTRAP_USERNAME", "ADMIN_BOOTSTRAP_PASSWORD"})
    missing = sorted(required - configured_environment().keys())
    if missing:
        raise LauncherError(
            "Missing required environment variable names: " + ", ".join(missing)
        )


def ensure_dependencies(*, skip_install: bool) -> None:
    if (PROJECT_ROOT / "node_modules").is_dir():
        return
    if skip_install:
        raise LauncherError(
            "node_modules is missing and --skip-install was supplied. Run npm install."
        )
    run_checked(["npm", "install"])


def development_environment() -> dict[str, str]:
    """Allow larger local browser headers without changing production limits."""
    environment = os.environ.copy()
    option = "--max-http-header-size=65536"
    current = environment.get("NODE_OPTIONS", "").strip()
    if "--max-http-header-size" not in current:
        environment["NODE_OPTIONS"] = f"{current} {option}".strip()
    return environment


def listener_pids(port: int) -> set[int]:
    """Return the processes currently listening on a local TCP port."""
    result = subprocess.run(
        ["lsof", "-nP", f"-tiTCP:{port}", "-sTCP:LISTEN"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode not in (0, 1):
        raise LauncherError(f"Unable to inspect development port {port} with lsof.")
    return {int(line) for line in result.stdout.splitlines() if line.isdigit()}


def process_working_directory(pid: int) -> Path | None:
    """Read a process cwd without inspecting or logging its command arguments."""
    result = subprocess.run(
        ["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    for line in result.stdout.splitlines():
        if line.startswith("n/"):
            return Path(line[1:]).resolve()
    return None


def stop_existing_dev_servers() -> None:
    """Stop stale StudyRoom listeners while leaving unrelated processes alone."""
    require_command("lsof", "Install lsof or stop ports 4000 and 5173 manually.")
    environment = configured_environment()
    try:
        api_port = int(environment.get("PORT", "4000"))
    except ValueError as error:
        raise LauncherError("PORT must be a valid integer.") from error

    ports = {api_port, WEB_DEV_PORT}
    owners: dict[int, set[int]] = {}
    for port in ports:
        for pid in listener_pids(port):
            owners.setdefault(pid, set()).add(port)

    if not owners:
        return

    for pid, owned_ports in owners.items():
        working_directory = process_working_directory(pid)
        if working_directory is None or not working_directory.is_relative_to(PROJECT_ROOT):
            port_list = ", ".join(str(port) for port in sorted(owned_ports))
            location = str(working_directory) if working_directory else "unknown directory"
            raise LauncherError(
                f"Port(s) {port_list} are used by PID {pid} from {location}. "
                "Stop that process manually; the launcher will not terminate an "
                "unrelated application."
            )

    for pid, owned_ports in owners.items():
        port_list = ", ".join(str(port) for port in sorted(owned_ports))
        log(f"Stopping stale StudyRoom process {pid} on port(s) {port_list}...")
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        except PermissionError as error:
            raise LauncherError(
                f"Permission denied while stopping StudyRoom process {pid}. "
                f"Run: kill -TERM {pid}"
            ) from error

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if all(not listener_pids(port) for port in ports):
            log("Development ports are ready.")
            return
        time.sleep(0.2)

    remaining = {
        pid
        for port in ports
        for pid in listener_pids(port)
        if pid in owners
    }
    for pid in remaining:
        log(f"StudyRoom process {pid} did not stop gracefully; forcing it to close.")
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except PermissionError as error:
            raise LauncherError(
                f"Permission denied while forcing StudyRoom process {pid} to stop. "
                f"Run: kill -KILL {pid}"
            ) from error

    time.sleep(0.2)
    blocked_ports = sorted(port for port in ports if listener_pids(port))
    if blocked_ports:
        raise LauncherError(
            "Development port(s) are still occupied: "
            + ", ".join(str(port) for port in blocked_ports)
        )
    log("Development ports are ready.")


def docker_environment() -> dict[str, str]:
    """Pass the API's LiveKit credentials to the self-hosted server safely."""
    environment = configured_environment()
    api_key = environment.get("LIVEKIT_API_KEY", "")
    api_secret = environment.get("LIVEKIT_API_SECRET", "")
    if not api_key or not api_secret:
        raise LauncherError("LiveKit API credentials are missing from the environment.")
    environment["LIVEKIT_KEYS"] = f"{api_key}: {api_secret}"
    return environment


def check_docker() -> None:
    require_command("docker", "Install and start Docker Desktop.")
    result = subprocess.run(
        ["docker", "info"],
        cwd=PROJECT_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode != 0:
        raise LauncherError("Docker is not running. Start Docker Desktop and try again.")


def wait_for_postgres(timeout_seconds: int = 60) -> None:
    log("Waiting for PostgreSQL to accept connections...")
    deadline = time.monotonic() + timeout_seconds
    consecutive_successes = 0

    while time.monotonic() < deadline:
        result = subprocess.run(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                "postgres",
                "pg_isready",
                "-U",
                "studyroom",
                "-d",
                "studyroom",
            ],
            cwd=PROJECT_ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        consecutive_successes = consecutive_successes + 1 if result.returncode == 0 else 0
        if consecutive_successes >= 2:
            log("PostgreSQL is ready.")
            return
        time.sleep(1)

    raise LauncherError(
        "PostgreSQL did not become ready within 60 seconds. "
        "Inspect it with: docker compose logs postgres"
    )


def wait_for_livekit(timeout_seconds: int = 45) -> None:
    """Require LiveKit to accept the same credentials used by the API."""
    log("Waiting for LiveKit and verifying its API credentials...")
    deadline = time.monotonic() + timeout_seconds

    while time.monotonic() < deadline:
        result = subprocess.run(
            ["npm", "run", "livekit:check", "--silent"],
            cwd=PROJECT_ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if result.returncode == 0:
            log("LiveKit is ready and its credentials match the API.")
            return
        time.sleep(1)

    raise LauncherError(
        "LiveKit did not accept the configured credentials within 45 seconds. "
        "Inspect it with: docker compose logs --tail=100 livekit"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare and run the StudyRoom development environment."
    )
    parser.add_argument(
        "--skip-install",
        action="store_true",
        help="Do not install npm dependencies when node_modules is missing.",
    )
    parser.add_argument(
        "--skip-docker",
        action="store_true",
        help="Do not start local PostgreSQL and LiveKit containers.",
    )
    parser.add_argument(
        "--bootstrap-admin",
        action="store_true",
        help="Create or update the administrator using the private environment values.",
    )
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Prepare infrastructure and migrations without starting the dev servers.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    os.chdir(PROJECT_ROOT)

    try:
        require_command("node", "Install Node.js 20 or newer.")
        require_command("npm", "Install npm with Node.js 20 or newer.")
        check_node_version()
        check_environment(bootstrap_admin=args.bootstrap_admin)
        ensure_dependencies(skip_install=args.skip_install)

        if not args.prepare_only:
            stop_existing_dev_servers()

        if not args.skip_docker:
            check_docker()
            run_checked(
                ["docker", "compose", "up", "-d", "postgres"],
                environment=docker_environment(),
            )
            run_checked(
                ["docker", "compose", "up", "-d", "--force-recreate", "livekit"],
                environment=docker_environment(),
            )
            wait_for_postgres()
            wait_for_livekit()
        else:
            log("Skipping Docker; configured external services must already be reachable.")

        run_checked(["npm", "run", "db:migrate"])
        if args.bootstrap_admin:
            run_checked(["npm", "run", "admin:bootstrap"])

        if args.prepare_only:
            log("Preparation complete.")
            return 0

        log("Starting web and API development servers. Press Ctrl+C to stop them.")
        return subprocess.run(
            ["npm", "run", "dev"],
            cwd=PROJECT_ROOT,
            env=development_environment(),
        ).returncode
    except KeyboardInterrupt:
        log("Stopped.")
        return 130
    except LauncherError as error:
        print(f"[StudyRoom] ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
