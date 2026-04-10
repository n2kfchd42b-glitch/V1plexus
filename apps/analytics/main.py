"""
PLEXUS Analytics FastAPI application.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.analysis_integrity import router as integrity_router
from .routers.research_output import router as output_router
from .routers.causal import router as causal_router
from .routers.causal_estimation import router as causal_estimation_router
from .routers.analytics_intelligence import router as intelligence_router
from .routers.identity import router as identity_router
from .routers.ledger import router as ledger_router
from .routers.revocation import router as revocation_router
from .routers.pvp import router as pvp_router
from .routers.verify import router as verify_router

app = FastAPI(title="PLEXUS Analytics", version="1.0.0")

_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,https://plexus.science"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(integrity_router)
app.include_router(output_router)
app.include_router(causal_router)
app.include_router(causal_estimation_router)
app.include_router(intelligence_router)
app.include_router(identity_router)
app.include_router(ledger_router)
app.include_router(pvp_router)
app.include_router(verify_router)
app.include_router(revocation_router)


@app.get("/analytics/health")
def health():
    return {"status": "ok"}
