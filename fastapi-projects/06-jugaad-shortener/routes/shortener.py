from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from database import get_session
from models import ShortURL, ShortURLCreate, ShortURLRead

router = APIRouter(tags=["Shortener"])


def increment_clicks(short_code: str, session_factory):
    """Background task to update click count."""
    from sqlmodel import Session
    with Session(session_factory) as session:
        url = session.exec(
            select(ShortURL).where(ShortURL.short_code == short_code)
        ).first()
        if url:
            url.click_count += 1
            session.add(url)
            session.commit()


@router.post("/shorten", response_model=ShortURLRead)
def create_short_url(
    data: ShortURLCreate,
    session: Session = Depends(get_session),
):
    short_url = ShortURL(original_url=data.original_url)
    session.add(short_url)
    session.commit()
    session.refresh(short_url)
    return short_url


@router.get("/stats/{code}", response_model=ShortURLRead)
def get_stats(code: str, session: Session = Depends(get_session)):
    url = session.exec(
        select(ShortURL).where(ShortURL.short_code == code)
    ).first()
    if not url:
        raise HTTPException(status_code=404, detail="Short URL not found")
    return url


@router.get("/{code}")
def redirect_to_url(
    code: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    url = session.exec(
        select(ShortURL).where(ShortURL.short_code == code)
    ).first()
    if not url:
        raise HTTPException(status_code=404, detail="Short URL not found")

    # Log the click in the background so redirect is fast
    from database import engine
    background_tasks.add_task(increment_clicks, code, engine)

    return RedirectResponse(url=url.original_url, status_code=307)
