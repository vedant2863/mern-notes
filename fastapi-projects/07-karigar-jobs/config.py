from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "karigar-super-secret-key-change-me"
    ALGORITHM: str = "HS256"
    TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
