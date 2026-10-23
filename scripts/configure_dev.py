"""Write ignored, local-only Docker settings with random secrets. Never prints credentials."""
from pathlib import Path
import secrets

target = Path(__file__).resolve().parents[1] / ".env"
if target.exists():
    raise SystemExit("A .env already exists. Review it instead of overwriting credentials.")
password = secrets.token_urlsafe(32)
secret = secrets.token_urlsafe(48)
content = f"""# LOCAL DEVELOPMENT ONLY. Never use for live customer records.
POSTGRES_USER=honor
POSTGRES_DB=honor
POSTGRES_PASSWORD={password}
HONOR_DATABASE_URL=postgresql+psycopg://honor:{password}@db:5432/honor
HONOR_ENVIRONMENT=development
HONOR_AUTH_PROVIDER=development
HONOR_SESSION_SECRET={secret}
HONOR_PAYMENT_PROVIDER=sandbox
HONOR_COOKIE_SECURE=false
HONOR_APP_ORIGIN=http://localhost:8000
HONOR_ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
"""
target.write_text(content)
target.chmod(0o600)
print("Local configuration created with random credentials. Start with: docker compose -f compose.dev.yaml up --build")
