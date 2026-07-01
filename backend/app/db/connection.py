from collections.abc import Generator
from functools import lru_cache

import psycopg
from fastapi import HTTPException, status
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import settings


@lru_cache
def get_pool() -> ConnectionPool:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return ConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=2,
        kwargs={"row_factory": dict_row},
    )


def close_pool() -> None:
    try:
        get_pool().close()
    except RuntimeError:
        pass
    get_pool.cache_clear()


def get_db() -> Generator[psycopg.Connection, None, None]:
    if not settings.database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured",
        )
    with get_pool().connection() as conn:
        yield conn
