FROM python:3.11-slim

WORKDIR /app

# Install build deps for scientific packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY apps/analytics/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy package structure (relative imports need apps/ as a package)
COPY apps/__init__.py apps/__init__.py
COPY apps/analytics/ apps/analytics/

# Railway injects PORT; fall back to 8000 locally
ENV PORT=8000

CMD uvicorn apps.analytics.main:app --host 0.0.0.0 --port $PORT
