FROM node:22-slim AS dashboard
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/storefront/package.json apps/storefront/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app/services/backend
RUN pip install --no-cache-dir uv
COPY services/backend/pyproject.toml services/backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY services/backend/ ./
COPY --from=dashboard /app/dist /app/dist
RUN useradd --create-home --uid 10001 honor && chown -R honor:honor /app
USER honor
EXPOSE 8000
CMD ["sh", "-c", "exec .venv/bin/uvicorn honor.app:create_app --factory --host 0.0.0.0 --no-access-log --port ${PORT:-8000}"]
