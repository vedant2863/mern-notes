from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class SeverityLevel(str, Enum):
    HEALTHY = "healthy"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class Disease(BaseModel):
    name: str
    confidence: float
    description: str


class Treatment(BaseModel):
    treatment_name: str
    treatment_type: str  # organic, chemical, preventive
    instructions: str
    urgency: str  # immediate, within_week, seasonal


class CropAnalysis(BaseModel):
    id: Optional[str] = None
    image_filename: str
    original_name: str
    upload_date: str = ""
    crop_detected: str = ""
    severity: SeverityLevel = SeverityLevel.HEALTHY
    diseases: list[Disease] = []
    treatments: list[Treatment] = []
    overall_health: str = ""
    additional_notes: str = ""

    def model_post_init(self, __context):
        if not self.upload_date:
            self.upload_date = datetime.now().isoformat()
