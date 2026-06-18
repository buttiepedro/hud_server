from typing import Any, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class CollectorResult(BaseModel, Generic[T]):
    available: bool = True
    error: str | None = None
    data: T
