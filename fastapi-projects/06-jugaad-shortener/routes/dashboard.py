from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from database import get_session
from models import ShortURL

router = APIRouter(tags=["Dashboard"])
templates = Jinja2Templates(directory="templates")


@router.get("/dashboard")
def show_dashboard(
    request: Request,
    session: Session = Depends(get_session),
):
    urls = session.exec(select(ShortURL)).all()
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "urls": urls},
    )


@router.get("/create")
def show_create_form(request: Request):
    return templates.TemplateResponse(
        "create.html",
        {"request": request},
    )
