from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models.user import User
from models.job import Job
from models.application import Application, ApplicationCreate, ApplicationRead
from dependencies import get_current_user, require_role

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.post("/", response_model=ApplicationRead)
def apply_to_job(
    data: ApplicationCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role("worker")),
):
    """Workers apply to open jobs."""
    job = session.get(Job, data.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.is_open:
        raise HTTPException(status_code=400, detail="Job is no longer open")

    # Check if already applied
    existing = session.exec(
        select(Application).where(
            Application.job_id == data.job_id,
            Application.worker_id == current_user.id,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this job")

    application = Application(
        job_id=data.job_id,
        worker_id=current_user.id,
        message=data.message,
    )
    session.add(application)
    session.commit()
    session.refresh(application)
    return application


@router.get("/job/{job_id}", response_model=list[ApplicationRead])
def get_applicants(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role("customer")),
):
    """Customers view applicants for their job."""
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.posted_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job posting")

    applications = session.exec(
        select(Application).where(Application.job_id == job_id)
    ).all()
    return applications


@router.get("/my", response_model=list[ApplicationRead])
def my_applications(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role("worker")),
):
    """Workers see their own applications."""
    applications = session.exec(
        select(Application).where(Application.worker_id == current_user.id)
    ).all()
    return applications
