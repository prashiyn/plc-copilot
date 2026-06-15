FROM python:3.12-slim

WORKDIR /app/automation

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY api/ ./api/
COPY plc_automation/ ./plc_automation/
COPY plc_file_handler/ ./plc_file_handler/
COPY samples/ ./samples/

ENV PATH="/app/automation/.venv/bin:$PATH"
ENV PYTHONPATH=/app/automation
ENV UPLOAD_DIR=/tmp/automation-uploads

RUN mkdir -p /tmp/automation-uploads

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
