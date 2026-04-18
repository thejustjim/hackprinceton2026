from .schemas import ManufacturerResult, ScoreBreakdown, SearchRequest, SearchResult, TransportMode


COUNTRY_BASELINES = {
    "Portugal": {"manufacturing": 16.0, "grid": 5.0, "climate": 3.0},
    "China": {"manufacturing": 28.0, "grid": 15.0, "climate": 6.0},
    "Bangladesh": {"manufacturing": 22.0, "grid": 13.0, "climate": 7.5},
    "Vietnam": {"manufacturing": 24.0, "grid": 11.5, "climate": 6.0},
    "Germany": {"manufacturing": 18.0, "grid": 7.0, "climate": 2.5},
    "Mexico": {"manufacturing": 21.0, "grid": 10.5, "climate": 4.0},
    "India": {"manufacturing": 26.0, "grid": 14.0, "climate": 7.0},
}

TRANSPORT_FACTORS = {
    TransportMode.sea: 6.0,
    TransportMode.air: 34.0,
    TransportMode.rail: 11.0,
    TransportMode.road: 16.0,
}


def build_search_result(search_id: str, payload: SearchRequest) -> SearchResult:
    manufacturers: list[ManufacturerResult] = []

    for index, country in enumerate(payload.countries, start=1):
        baseline = COUNTRY_BASELINES.get(
            country,
            {"manufacturing": 24.0, "grid": 11.0, "climate": 5.0},
        )
        certification_bonus = -2.0 if payload.certifications else 2.5
        transport_score = TRANSPORT_FACTORS[payload.transport_mode] + (index * 1.2)
        total = (
            baseline["manufacturing"]
            + baseline["grid"]
            + baseline["climate"]
            + transport_score
            + certification_bonus
        )

        manufacturers.append(
            ManufacturerResult(
                id=f"{search_id}-{index}",
                manufacturerName=f"{country} Sustainable Manufacturing Co.",
                country=country,
                location=f"{country} logistics hub",
                sustainabilityUrl=f"https://example.com/{country.lower()}",
                certifications=payload.certifications,
                score=ScoreBreakdown(
                    manufacturing=baseline["manufacturing"],
                    transport=transport_score,
                    grid=baseline["grid"],
                    certifications=certification_bonus,
                    climateRisk=baseline["climate"],
                    total=round(total, 1),
                ),
            )
        )

    ranked_results = sorted(manufacturers, key=lambda item: item.score.total)
    summary = (
        f"{payload.product} to {payload.destination_country} by "
        f"{payload.transport_mode.value} freight"
    )
    return SearchResult(id=search_id, summary=summary, results=ranked_results)

