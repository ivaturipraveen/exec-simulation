from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_spa_serving_and_traversal_guard(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>app</title>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "secret.txt").write_text("TOP-SECRET")
    settings = Settings(
        _env_file=None,
        secret_key="s",
        data_dir=tmp_path,
        static_dir=dist,
        database_url=f"sqlite:///{tmp_path / 'db.sqlite'}",
    )
    with TestClient(create_app(settings)) as client:
        assert "<title>app</title>" in client.get("/team/invest").text  # SPA fallback
        assert client.get("/assets/app.js").text == "console.log(1)"
        assert client.get("/api/missing").json()["error"]["code"] == "not_found"
        for path in ("/..%2fsecret.txt", "/%2e%2e/secret.txt", "/../secret.txt"):
            assert "TOP-SECRET" not in client.get(path).text
