#!/usr/bin/env python3
"""Apply SQL migrations from db/migrations/ in order."""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT = BACKEND_DIR.parent
MIGRATIONS_DIR = ROOT / "db" / "migrations"

sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings  # noqa: E402


def main() -> None:
    if not settings.database_url:
        print("ERROR: DATABASE_URL is not set")
        sys.exit(1)

    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        print(f"No migrations found in {MIGRATIONS_DIR}")
        sys.exit(1)

    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename text PRIMARY KEY,
                applied_at timestamptz DEFAULT now()
            )
            """
        )

        for path in files:
            applied = conn.execute(
                "SELECT 1 FROM schema_migrations WHERE filename = %s",
                (path.name,),
            ).fetchone()
            if applied:
                print(f"skip  {path.name}")
                continue

            sql = path.read_text(encoding="utf-8")
            print(f"apply {path.name}")
            conn.execute(sql)
            conn.execute(
                "INSERT INTO schema_migrations (filename) VALUES (%s)",
                (path.name,),
            )

    print("Migrations complete.")


if __name__ == "__main__":
    main()
