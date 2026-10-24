import os
from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from honor.models import Base

load_dotenv()
url = os.environ["HONOR_DATABASE_URL"]

if context.is_offline_mode():
    context.configure(
        url=url,
        target_metadata=Base.metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema="honor",
        include_schemas=True,
    )
    with context.begin_transaction():
        context.execute("CREATE SCHEMA IF NOT EXISTS honor")
        context.run_migrations()
else:
    with create_engine(url).connect() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS honor"))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            version_table_schema="honor",
            include_schemas=True,
        )
        with context.begin_transaction():
            context.run_migrations()
