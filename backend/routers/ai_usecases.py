"""AI use-cases endpoint shim. The actual endpoint lives in results.py;
this module exists so the optional-router loader can pick it up if used."""
from fastapi import APIRouter

router = APIRouter(tags=["ai_usecases"])
