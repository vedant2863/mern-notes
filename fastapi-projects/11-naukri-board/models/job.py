from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Company(BaseModel):
    name: str
    location: str
    website: Optional[str] = None


class JobCreate(BaseModel):
    title: str
    company: Company
    description: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    job_type: str = "full-time"  # full-time, part-time, contract, internship
    skills: list[str] = []
    is_remote: bool = False


class JobResponse(BaseModel):
    id: str
    title: str
    company: Company
    description: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    job_type: str
    skills: list[str]
    is_remote: bool
    created_at: datetime


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    job_type: Optional[str] = None
    skills: Optional[list[str]] = None
    is_remote: Optional[bool] = None
