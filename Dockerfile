FROM python:3.12-slim

WORKDIR /app

# Copy requirements first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy .env explicitly (optional, only if you *want* it in the image)
COPY .env . 

# Copy everything else
COPY . .

# Debug: list files
RUN echo "Contents of /app:" && ls -la /app

CMD ["python", "main.py"]
