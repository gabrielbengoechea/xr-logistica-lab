# Imagen del backend. Se construye desde la raíz del repo para incluir /models:
#   docker build -f backend/Dockerfile -t xrlab-api .
#   docker run -p 8000:8000 -v xrlab-datos:/app/backend/data xrlab-api
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
COPY backend/data/inventory.json backend/data/inventory.json
COPY models models
WORKDIR /app/backend
ENV XRLAB_MODELS_DIR=/app/models
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
