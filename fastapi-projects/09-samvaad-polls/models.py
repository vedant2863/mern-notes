from pydantic import BaseModel
from typing import Optional


# MongoDB document structure for a poll
# {
#   "_id": ObjectId,
#   "question": "Best programming language?",
#   "options": ["Python", "JavaScript", "Go", "Rust"],
#   "votes": {"Python": 0, "JavaScript": 0, "Go": 0, "Rust": 0}
# }


class PollCreate(BaseModel):
    question: str
    options: list[str]


class PollResponse(BaseModel):
    id: str
    question: str
    options: list[str]
    votes: dict[str, int]


class VoteRequest(BaseModel):
    option: str
