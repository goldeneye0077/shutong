FROM python:3.12-slim

WORKDIR /workspace

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY apps/backend/pyproject.toml apps/backend/pyproject.toml
RUN pip install --no-cache-dir -e apps/backend

COPY . .

WORKDIR /workspace/apps/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

