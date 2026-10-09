"""App settings, read from environment variables with local-dev defaults."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'signal.db'}")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
SEED_ON_STARTUP = os.getenv("SEED_ON_STARTUP", "true").lower() == "true"

# Phone verification is mocked: every number accepts this code.
MOCK_OTP = "123456"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
