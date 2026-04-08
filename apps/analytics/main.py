"""
PLEXUS Analytics FastAPI application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.analysis_integrity import router as integrity_router
from .routers.research_output import router as output_router
from .routers.causal import router as causal_router

app = FastAPI(title="PLEXUS Analytics", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(integrity_router)
app.include_router(output_router)
app.include_router(causal_router)
