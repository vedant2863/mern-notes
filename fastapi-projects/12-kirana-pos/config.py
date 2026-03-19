import os

# PostgreSQL connection
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/kirana_pos",
)

# App settings
APP_NAME = "Kirana POS"
APP_VERSION = "1.0.0"
