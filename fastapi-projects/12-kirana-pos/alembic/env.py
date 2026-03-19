from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Import our models so Alembic can detect them
from database import Base
from models.db_models import Product, Sale

config = context.config
fileConfig(config.config_file_name)

# This is the metadata Alembic will use to generate migrations
target_metadata = Base.metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode — generates SQL without connecting."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode — connects to the database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
