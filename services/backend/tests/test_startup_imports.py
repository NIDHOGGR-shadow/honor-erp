"""Keep optional native/WASM libraries outside the core API startup graph."""

import subprocess
import sys


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
