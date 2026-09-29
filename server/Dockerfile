FROM python:3.11-slim

WORKDIR /app

COPY req_utf8.txt .
RUN pip install --no-cache-dir -r req_utf8.txt

COPY . .

EXPOSE 8000

CMD ["python", "-m", "daphne", "-b", "0.0.0.0", "-p", "8000", "core.asgi:application"]
