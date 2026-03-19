from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime

from models.meal import MealCreate, MealResponse, MealUpdate
from database import meals_collection
from dependencies import CommonPagination

router = APIRouter(prefix="/meals", tags=["meals"])


@router.post("/", response_model=MealResponse)
async def log_meal(meal: MealCreate):
    doc = meal.model_dump()
    doc["timestamp"] = datetime.utcnow()

    result = await meals_collection.insert_one(doc)

    return MealResponse(id=str(result.inserted_id), **doc)


@router.get("/", response_model=list[MealResponse])
async def list_meals(
    user_id: str,
    pagination: CommonPagination = Depends(),
):
    cursor = meals_collection.find({"user_id": user_id})
    cursor = cursor.sort("timestamp", -1)
    cursor = cursor.skip(pagination.skip).limit(pagination.limit)

    meals = []
    async for doc in cursor:
        meals.append(MealResponse(id=str(doc["_id"]), **{k: v for k, v in doc.items() if k != "_id"}))
    return meals


@router.get("/{meal_id}", response_model=MealResponse)
async def get_meal(meal_id: str):
    doc = await meals_collection.find_one({"_id": ObjectId(meal_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Meal not found")
    return MealResponse(id=str(doc["_id"]), **{k: v for k, v in doc.items() if k != "_id"})


@router.put("/{meal_id}", response_model=MealResponse)
async def update_meal(meal_id: str, updates: MealUpdate):
    # Only include fields that were actually sent
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await meals_collection.update_one(
        {"_id": ObjectId(meal_id)},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")

    doc = await meals_collection.find_one({"_id": ObjectId(meal_id)})
    return MealResponse(id=str(doc["_id"]), **{k: v for k, v in doc.items() if k != "_id"})


@router.delete("/{meal_id}")
async def delete_meal(meal_id: str):
    result = await meals_collection.delete_one({"_id": ObjectId(meal_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {"message": "Meal deleted"}
