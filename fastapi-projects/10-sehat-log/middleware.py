import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from config import RATE_LIMIT_PER_MINUTE


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Logs how long each request takes."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        # Add timing header to response
        response.headers["X-Process-Time"] = f"{duration:.4f}"
        print(f"{request.method} {request.url.path} - {duration:.4f}s")
        return response


class SimpleRateLimiter(BaseHTTPMiddleware):
    """Basic rate limiter by client IP address."""

    def __init__(self, app, max_requests: int = RATE_LIMIT_PER_MINUTE):
        super().__init__(app)
        self.max_requests = max_requests
        # IP -> list of timestamps
        self.requests: dict[str, list[float]] = {}

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        now = time.time()

        # Initialize if new IP
        if client_ip not in self.requests:
            self.requests[client_ip] = []

        # Remove timestamps older than 60 seconds
        self.requests[client_ip] = [
            t for t in self.requests[client_ip]
            if now - t < 60
        ]

        # Check rate limit
        if len(self.requests[client_ip]) >= self.max_requests:
            return Response(
                content='{"detail": "Rate limit exceeded. Try again later."}',
                status_code=429,
                media_type="application/json",
            )

        # Record this request
        self.requests[client_ip].append(now)

        response = await call_next(request)
        return response
