FROM python:3.12-slim

WORKDIR /workspace

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY apps/data-service/pyproject.toml apps/data-service/pyproject.toml
RUN pip install --no-cache-dir -e apps/data-service

COPY . .

WORKDIR /workspace/apps/data-service

EXPOSE 8010

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]

