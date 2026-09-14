# syntax=docker/dockerfile:1
FROM python:3.12-slim AS runner

# Keeps Python from writing .pyc files and buffering stdout/stderr — the
# latter matters so `docker compose logs` shows output as it happens.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN groupadd --system django && useradd --system --gid django django

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
# .dockerignore excludes mediafiles/ from the build context (it's runtime
# data, not source) — mkdir'ing it here, owned by django, means the named
# volume docker-compose mounts over it inherits that ownership the first
# time it's populated instead of defaulting to root-owned, which would
# otherwise reject every upload with a permission error.
RUN mkdir -p /app/mediafiles && chmod +x /app/docker-entrypoint.sh && chown -R django:django /app

USER django
EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
