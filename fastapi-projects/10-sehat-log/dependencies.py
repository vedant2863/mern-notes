from fastapi import Query
from database import db


class CommonPagination:
    """Reusable pagination dependency."""

    def __init__(
        self,
        skip: int = Query(0, ge=0, description="Records to skip"),
        limit: int = Query(10, ge=1, le=100, description="Max records to return"),
    ):
        self.skip = skip
        self.limit = limit


async def get_db():
    """Database dependency — returns the db instance."""
    return db
