import httpx
import json
import base64
from config import GEMINI_API_KEY


GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

CROP_ANALYSIS_PROMPT = """You are an expert agricultural scientist specializing in crop disease detection.
Analyze this image of a crop/plant and provide a detailed disease assessment.

Provide your analysis as a JSON object with exactly this structure:
{
    "crop_detected": "Name of the crop or plant visible in the image",
    "severity": "healthy" or "mild" or "moderate" or "severe" or "critical",
    "diseases": [
        {
            "name": "Disease name",
            "confidence": 0.0 to 1.0,
            "description": "Brief description of the disease and visible symptoms"
        }
    ],
    "treatments": [
        {
            "treatment_name": "Name of treatment",
            "treatment_type": "organic" or "chemical" or "preventive",
            "instructions": "Step by step treatment instructions",
            "urgency": "immediate" or "within_week" or "seasonal"
        }
    ],
    "overall_health": "One sentence summary of plant health",
    "additional_notes": "Any other observations or recommendations"
}

Rules:
- If the plant looks healthy, set severity to "healthy" and diseases to empty array
- Be specific about disease symptoms you can see
- Provide at least one treatment per disease found
- Include both organic and chemical treatment options when possible
- If the image is not a plant/crop, set crop_detected to "not_a_plant" and explain in additional_notes
- Return ONLY the JSON object, no other text
"""


async def analyze_crop_image(image_bytes: bytes, content_type: str) -> dict:
    """Send image to Gemini Vision for crop disease analysis."""

    # Encode image to base64
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Map content type to Gemini mime type
    mime_type = content_type
    if mime_type == "image/jpg":
        mime_type = "image/jpeg"

    # Call Gemini API with multimodal input
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            json={
                "contents": [
                    {
                        "parts": [
                            {"text": CROP_ANALYSIS_PROMPT},
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": image_b64,
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 4096,
                },
            },
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()

    # Extract text response
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]

    # Clean up markdown code blocks if present
    raw_text = raw_text.strip()
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    if raw_text.startswith("```"):
        raw_text = raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]
    raw_text = raw_text.strip()

    # Parse JSON
    analysis = json.loads(raw_text)
    return analysis
