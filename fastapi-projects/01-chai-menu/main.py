from fastapi import FastAPI, HTTPException, Query
from data import menu_items
from models import MenuItem, MenuResponse

app = FastAPI(
    title="Chai Point Menu API",
    description="Read-only menu API for kiosk displays and mobile apps",
)


@app.get("/")
def root():
    return {"message": "Welcome to Chai Point Menu API"}


# List all items, optionally filter by category
@app.get("/menu", response_model=MenuResponse)
def get_menu(category: str | None = Query(None, description="Filter by: chai, snacks, combos")):
    if category:
        filtered = [item for item in menu_items if item["category"] == category.lower()]
        if not filtered:
            raise HTTPException(status_code=404, detail=f"No items found in category: {category}")
        return MenuResponse(count=len(filtered), items=filtered)

    return MenuResponse(count=len(menu_items), items=menu_items)


# Get single item by ID
@app.get("/menu/{item_id}", response_model=MenuItem)
def get_item(item_id: int):
    for item in menu_items:
        if item["id"] == item_id:
            return item

    raise HTTPException(status_code=404, detail=f"Menu item with id {item_id} not found")
