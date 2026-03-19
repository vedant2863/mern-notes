import asyncio
import random

from models import PlaceOfInterest


# Simulated places data by destination
PLACES_DATABASE = {
    "goa": [
        PlaceOfInterest(
            name="Basilica of Bom Jesus",
            category="Heritage",
            description="UNESCO World Heritage Site, 16th century church with Baroque architecture",
            rating=4.6,
            estimated_time_hours=1.5,
            entry_fee=0,
        ),
        PlaceOfInterest(
            name="Dudhsagar Falls",
            category="Nature",
            description="Four-tiered waterfall on the Mandovi River, one of India's tallest",
            rating=4.7,
            estimated_time_hours=4.0,
            entry_fee=400,
        ),
        PlaceOfInterest(
            name="Fort Aguada",
            category="Heritage",
            description="17th century Portuguese fort with lighthouse and panoramic sea views",
            rating=4.3,
            estimated_time_hours=2.0,
            entry_fee=0,
        ),
        PlaceOfInterest(
            name="Anjuna Flea Market",
            category="Shopping",
            description="Famous Wednesday market with handicrafts, clothes, and street food",
            rating=4.1,
            estimated_time_hours=3.0,
        ),
        PlaceOfInterest(
            name="Calangute Beach",
            category="Beach",
            description="Queen of Beaches - the largest and most popular beach in North Goa",
            rating=4.2,
            estimated_time_hours=3.0,
        ),
    ],
    "manali": [
        PlaceOfInterest(
            name="Rohtang Pass",
            category="Nature",
            description="High mountain pass at 3,978m with stunning snow views",
            rating=4.8,
            estimated_time_hours=6.0,
            entry_fee=550,
        ),
        PlaceOfInterest(
            name="Solang Valley",
            category="Adventure",
            description="Adventure sports hub - paragliding, skiing, and zorbing",
            rating=4.5,
            estimated_time_hours=4.0,
            entry_fee=200,
        ),
        PlaceOfInterest(
            name="Hadimba Temple",
            category="Heritage",
            description="Ancient cave temple surrounded by cedar forest, built in 1553",
            rating=4.4,
            estimated_time_hours=1.5,
            entry_fee=0,
        ),
        PlaceOfInterest(
            name="Old Manali",
            category="Culture",
            description="Charming village with cafes, shops, and the Manu Temple",
            rating=4.3,
            estimated_time_hours=3.0,
        ),
    ],
    "jaipur": [
        PlaceOfInterest(
            name="Amber Fort",
            category="Heritage",
            description="Majestic hilltop fort with artistic Hindu elements and mirror palace",
            rating=4.7,
            estimated_time_hours=3.0,
            entry_fee=500,
        ),
        PlaceOfInterest(
            name="Hawa Mahal",
            category="Heritage",
            description="Palace of Winds - iconic pink sandstone facade with 953 windows",
            rating=4.5,
            estimated_time_hours=1.5,
            entry_fee=200,
        ),
        PlaceOfInterest(
            name="City Palace",
            category="Heritage",
            description="Royal palace complex blending Rajasthani and Mughal architecture",
            rating=4.4,
            estimated_time_hours=2.5,
            entry_fee=700,
        ),
        PlaceOfInterest(
            name="Nahargarh Fort",
            category="Heritage",
            description="Fort on Aravalli Hills with stunning sunset views over the city",
            rating=4.3,
            estimated_time_hours=2.0,
            entry_fee=200,
        ),
    ],
}

# Default places for unknown destinations
DEFAULT_PLACES = [
    PlaceOfInterest(
        name="Local Heritage Walk",
        category="Culture",
        description="Guided walking tour through the historic old town area",
        rating=4.2,
        estimated_time_hours=2.0,
        entry_fee=300,
    ),
    PlaceOfInterest(
        name="Central Market",
        category="Shopping",
        description="Bustling local market with traditional crafts and street food",
        rating=4.0,
        estimated_time_hours=2.5,
    ),
    PlaceOfInterest(
        name="Sunset Point",
        category="Nature",
        description="Popular viewpoint for stunning sunset photographs",
        rating=4.4,
        estimated_time_hours=1.5,
    ),
]


async def fetch_places(destination: str) -> list[PlaceOfInterest]:
    """Fetch places of interest for a destination."""
    # Simulate network delay
    await asyncio.sleep(random.uniform(0.4, 1.2))

    dest_key = destination.lower()
    places = PLACES_DATABASE.get(dest_key, DEFAULT_PLACES)

    return places
