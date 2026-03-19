from fastapi import APIRouter, Query
from datetime import datetime, timedelta

from database import meals_collection, workouts_collection

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("/daily")
async def daily_summary(
    user_id: str,
    date: str = Query(None, description="YYYY-MM-DD format, defaults to today"),
):
    # Parse date or use today
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    else:
        target_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    date_filter = {
        "user_id": user_id,
        "timestamp": {"$gte": start, "$lt": end},
    }

    # Total calories consumed from meals
    meals_pipeline = [
        {"$match": date_filter},
        {"$group": {
            "_id": None,
            "total_calories_in": {"$sum": "$calories"},
            "total_protein": {"$sum": {"$ifNull": ["$protein_g", 0]}},
            "meal_count": {"$sum": 1},
        }},
    ]

    # Total calories burned from workouts
    workouts_pipeline = [
        {"$match": date_filter},
        {"$group": {
            "_id": None,
            "total_calories_burned": {"$sum": "$calories_burned"},
            "total_duration_min": {"$sum": "$duration_min"},
            "workout_count": {"$sum": 1},
        }},
    ]

    meals_result = await meals_collection.aggregate(meals_pipeline).to_list(1)
    workouts_result = await workouts_collection.aggregate(workouts_pipeline).to_list(1)

    calories_in = meals_result[0]["total_calories_in"] if meals_result else 0
    protein = meals_result[0]["total_protein"] if meals_result else 0
    meal_count = meals_result[0]["meal_count"] if meals_result else 0

    calories_burned = workouts_result[0]["total_calories_burned"] if workouts_result else 0
    duration = workouts_result[0]["total_duration_min"] if workouts_result else 0
    workout_count = workouts_result[0]["workout_count"] if workouts_result else 0

    return {
        "date": start.strftime("%Y-%m-%d"),
        "user_id": user_id,
        "calories_in": calories_in,
        "calories_burned": calories_burned,
        "net_calories": calories_in - calories_burned,
        "protein_g": protein,
        "meals_logged": meal_count,
        "workouts_logged": workout_count,
        "total_workout_min": duration,
    }


@router.get("/weekly")
async def weekly_trend(
    user_id: str,
    start_date: str = Query(None, description="YYYY-MM-DD, defaults to 7 days ago"),
):
    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
    else:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=6)

    days = []
    for i in range(7):
        day_start = start + timedelta(days=i)
        day_end = day_start + timedelta(days=1)

        date_filter = {
            "user_id": user_id,
            "timestamp": {"$gte": day_start, "$lt": day_end},
        }

        # Get meals total
        meals_cursor = meals_collection.aggregate([
            {"$match": date_filter},
            {"$group": {"_id": None, "total": {"$sum": "$calories"}}},
        ])
        meals_data = await meals_cursor.to_list(1)

        # Get workouts total
        workouts_cursor = workouts_collection.aggregate([
            {"$match": date_filter},
            {"$group": {"_id": None, "total": {"$sum": "$calories_burned"}}},
        ])
        workouts_data = await workouts_cursor.to_list(1)

        cal_in = meals_data[0]["total"] if meals_data else 0
        cal_out = workouts_data[0]["total"] if workouts_data else 0

        days.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "calories_in": cal_in,
            "calories_burned": cal_out,
            "net": cal_in - cal_out,
        })

    return {"user_id": user_id, "trend": days}
