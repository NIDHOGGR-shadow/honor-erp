from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import Request


def database(url: str):
    engine = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=0)
    return engine, sessionmaker(engine, expire_on_commit=False)


def session(request: Request):
    with request.app.state.sessions() as db:
        yield db
