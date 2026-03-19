from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models.user import User, UserCreate, UserRead, UserLogin
from security import hash_password, verify_password, create_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserRead)
def register(data: UserCreate, session: Session = Depends(get_session)):
    # Check valid role
    if data.role not in ("worker", "customer"):
        raise HTTPException(status_code=400, detail="Role must be worker or customer")

    # Check duplicate email
    existing = session.exec(select(User).where(User.email == data.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        phone=data.phone,
        city=data.city,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/login")
def login(data: UserLogin, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == data.email)).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token({"user_id": user.id, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}
