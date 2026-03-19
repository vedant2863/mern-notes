from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Contract(BaseModel):
    id: Optional[str] = None
    filename: str
    original_name: str
    upload_date: str = ""
    text_content: str = ""
    page_count: int = 0
    word_count: int = 0
    status: str = "uploaded"  # uploaded, analyzing, analyzed, error

    def model_post_init(self, __context):
        if not self.upload_date:
            self.upload_date = datetime.now().isoformat()


class ClauseAnalysis(BaseModel):
    clause_title: str
    clause_text: str
    explanation: str
    is_standard: bool


class RiskFlag(BaseModel):
    risk_title: str
    description: str
    risk_level: RiskLevel
    recommendation: str
    clause_reference: str = ""


class AnalysisResult(BaseModel):
    id: Optional[str] = None
    contract_id: str
    analysis_date: str = ""
    summary: str = ""
    contract_type: str = ""
    key_clauses: list[ClauseAnalysis] = []
    risk_flags: list[RiskFlag] = []
    overall_risk_level: RiskLevel = RiskLevel.LOW
    recommendations: list[str] = []

    def model_post_init(self, __context):
        if not self.analysis_date:
            self.analysis_date = datetime.now().isoformat()
