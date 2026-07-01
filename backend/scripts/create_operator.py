#!/usr/bin/env python3
"""Create an operator account with email/password."""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.auth import hash_password  # noqa: E402
from app.config import settings  # noqa: E402


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python scripts/create_operator.py <email> <password> [full_name]")
        sys.exit(1)

    if not settings.database_url:
        print("ERROR: DATABASE_URL is not set")
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    password = sys.argv[2]
    full_name = sys.argv[3] if len(sys.argv) > 3 else email.split("@")[0]

    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        existing = conn.execute(
            "SELECT id FROM operators WHERE email = %s",
            (email,),
        ).fetchone()
        if existing:
            print(f"Operator already exists: {email}")
            sys.exit(1)

        row = conn.execute(
            """
            INSERT INTO operators (email, full_name, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id, email, full_name
            """,
            (email, full_name, hash_password(password)),
        ).fetchone()
        conn.commit()

    print(f"Created operator {row['email']} ({row['id']})")


if __name__ == "__main__":
    main()
