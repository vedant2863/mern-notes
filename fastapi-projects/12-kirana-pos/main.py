from fastapi import FastAPI

from config import APP_NAME, APP_VERSION
from routes.products import router as products_router
from routes.cart import router as cart_router
from routes.checkout import router as checkout_router
from routes.reports import router as reports_router

app = FastAPI(title=APP_NAME, version=APP_VERSION)

# Include routers
app.include_router(products_router)
app.include_router(cart_router)
app.include_router(checkout_router)
app.include_router(reports_router)


@app.get("/")
def root():
    return {
        "app": APP_NAME,
        "version": APP_VERSION,
        "docs": "/docs",
        "endpoints": {
            "products": "/products",
            "cart": "/cart",
            "checkout": "/checkout",
            "reports": "/reports",
        },
    }


@app.get("/health")
def health():
    return {"status": "ok"}
