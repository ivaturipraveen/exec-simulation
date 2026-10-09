"""Write the OpenAPI schema to stdout (used to generate frontend types)."""

import contextlib
import json
import sys
import tempfile
from pathlib import Path

from app.core.config import Settings
from app.main import create_app

with tempfile.TemporaryDirectory() as tmp:
    settings = Settings(
        _env_file=None,
        secret_key="openapi",
        data_dir=Path(tmp),
        database_url=f"sqlite:///{tmp}/openapi.db",
        static_dir=Path(tmp) / "none",
    )
    out = sys.stdout
    with contextlib.redirect_stdout(sys.stderr):  # keep startup logs out of the JSON
        schema = create_app(settings).openapi()
    json.dump(schema, out, indent=2, sort_keys=True)
