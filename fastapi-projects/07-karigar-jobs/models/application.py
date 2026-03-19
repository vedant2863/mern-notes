from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime


class Application(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="job.id")
    worker_id: int = Field(foreign_key="user.id")
    message: str = ""
    applied_at: datetime = Field(default_factory=datetime.utcnow)


class ApplicationCreate(SQLModel):
    job_id: int
    message: str = ""


class ApplicationRead(SQLModel):
    id: int
    job_id: int
    worker_id: int
    message: str
    applied_at: datetime
