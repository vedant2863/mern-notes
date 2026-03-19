from fastapi import APIRouter, HTTPException
from bson import ObjectId

from models import PollCreate, PollResponse, VoteRequest
from database import polls_collection
from websocket_manager import manager

router = APIRouter(prefix="/polls", tags=["polls"])


@router.post("/", response_model=PollResponse)
async def create_poll(poll: PollCreate):
    # Build votes dict — each option starts at 0
    votes = {option: 0 for option in poll.options}

    doc = {
        "question": poll.question,
        "options": poll.options,
        "votes": votes,
    }
    result = await polls_collection.insert_one(doc)

    return PollResponse(
        id=str(result.inserted_id),
        question=poll.question,
        options=poll.options,
        votes=votes,
    )


@router.get("/{poll_id}", response_model=PollResponse)
async def get_poll(poll_id: str):
    poll = await polls_collection.find_one({"_id": ObjectId(poll_id)})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    return PollResponse(
        id=str(poll["_id"]),
        question=poll["question"],
        options=poll["options"],
        votes=poll["votes"],
    )


@router.post("/{poll_id}/vote", response_model=PollResponse)
async def vote_on_poll(poll_id: str, vote: VoteRequest):
    # Check poll exists
    poll = await polls_collection.find_one({"_id": ObjectId(poll_id)})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    # Check option is valid
    if vote.option not in poll["options"]:
        raise HTTPException(status_code=400, detail="Invalid option")

    # Increment vote count using dot notation
    field = f"votes.{vote.option}"
    await polls_collection.update_one(
        {"_id": ObjectId(poll_id)},
        {"$inc": {field: 1}},
    )

    # Fetch updated poll
    updated = await polls_collection.find_one({"_id": ObjectId(poll_id)})

    # Broadcast to all WebSocket clients watching this poll
    await manager.broadcast(poll_id, {
        "type": "vote_update",
        "votes": updated["votes"],
    })

    return PollResponse(
        id=str(updated["_id"]),
        question=updated["question"],
        options=updated["options"],
        votes=updated["votes"],
    )
