"""Keep optional native/WASM libraries outside the core API startup graph."""

import subprocess
import sys
from pathlib import Path


def test_core_api_import_does_not_initialize_pdf_or_development_hashing():
    # Other tests intentionally generate PDFs/hash passwords, so use a fresh interpreter.
    result = subprocess.run(
        [sys.executable, "-c", (
            "import sys; import honor.worker_adapter; "
            "unexpected=[m for m in ('reportlab','PIL','argon2','_argon2_cffi_bindings') if m in sys.modules]; "
            "assert not unexpected, unexpected"
        )],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr


def test_worker_entry_does_not_import_the_application_during_snapshot():
    entry = Path(__file__).resolve().parents[3] / "deploy/cloudflare-api/src/entry.py"
    result = subprocess.run(
        [sys.executable, "-c", (
            "import runpy,sys,types; "
            "workers=types.ModuleType('workers'); "
            "workers.Response=object; workers.WorkerEntrypoint=object; workers.asgi=object(); "
            "sys.modules['workers']=workers; runpy.run_path(sys.argv[1]); "
            "assert not any(m in sys.modules for m in ('honor','sqlalchemy','fastapi','cryptography'))"
        ), str(entry)],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
