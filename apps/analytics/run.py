"""
Entry point for running the PLEXUS analytics service locally.
Run from the project root: python3 apps/analytics/run.py
"""
import sys
import os

# Ensure the project root is on the path so relative imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "apps.analytics.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["apps/analytics"],
    )
