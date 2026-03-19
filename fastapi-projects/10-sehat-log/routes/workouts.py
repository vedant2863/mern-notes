from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime

from models.workout import WorkoutCreate, WorkoutResponse, WorkoutUpdate
from database import workouts_collection
from dependencies import CommonPagination

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("/", response_model=WorkoutResponse)
async def log_workout(workout: WorkoutCreate):
    doc = workout.model_dump()
    doc["timestamp"] = datetime.utcnow()

    result = await workouts_collection.insert_one(doc)

    return WorkoutResponse(id=str(result.inserted_id), **doc)


@router.get("/", response_model=list[WorkoutResponse])
async def list_workouts(
    user_id: str,
    pagination: CommonPagination = Depends(),
):
    cursor = workouts_collection.find({"user_id": user_id})
    cursor = cursor.sort("timestamp", -1)
    cursor = cursor.skip(pagination.skip).limit(pagination.limit)

    workouts = []
    async for doc in cursor:
        workouts.append(WorkoutResponse(
            id=str(doc["_id"]),
            **{k: v for k, v in doc.items() if k != "_id"},
        ))
    return workouts


@router.get("/{workout_id}", response_model=WorkoutResponse)
async def get_workout(workout_id: str):
    doc = await workouts_collection.find_one({"_id": ObjectId(workout_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Workout not found")
    return WorkoutResponse(id=str(doc["_id"]), **{k: v for k, v in doc.items() if k != "_id"})


@router.put("/{workout_id}", response_model=WorkoutResponse)
async def update_workout(workout_id: str, updates: WorkoutUpdate):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await workouts_collection.update_one(
        {"_id": ObjectId(workout_id)},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Workout not found")

    doc = await workouts_collection.find_one({"_id": ObjectId(workout_id)})
    return WorkoutResponse(id=str(doc["_id"]), **{k: v for k, v in doc.items() if k != "_id"})


@router.delete("/{workout_id}")
async def delete_workout(workout_id: str):
    result = await workouts_collection.delete_one({"_id": ObjectId(workout_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"message": "Workout deleted"}
