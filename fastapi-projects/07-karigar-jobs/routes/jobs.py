from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Optional

from database import get_session
from models.user import User
from models.job import Job, JobCreate, JobRead
from dependencies import get_current_user, require_role

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/", response_model=list[JobRead])
def list_jobs(
    location: Optional[str] = Query(default=None),
    min_pay: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
):
    """Anyone can browse open jobs."""
    query = select(Job).where(Job.is_open == True)

    if location:
        query = query.where(Job.location.contains(location))
    if min_pay:
        query = query.where(Job.pay >= min_pay)

    return session.exec(query).all()


@router.post("/", response_model=JobRead)
def create_job(
    data: JobCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role("customer")),
):
    """Only customers can post jobs."""
    job = Job(**data.model_dump(), posted_by=current_user.id)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}/close", response_model=JobRead)
def close_job(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role("customer")),
):
    """Customer closes a job when they find a worker."""
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.posted_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job posting")

    job.is_open = False
    session.add(job)
    session.commit()
    session.refresh(job)
    return job
