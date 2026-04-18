from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class TransportMode(str, Enum):
    sea = "sea"
    air = "air"
    rail = "rail"
    road = "road"


class SearchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product: str
    quantity: int = Field(ge=1)
    destination_country: str = Field(alias="destinationCountry")
    countries: list[str]
    transport_mode: TransportMode = Field(alias="transportMode")
    certifications: list[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    search_id: str = Field(alias="searchId")


class ScoreBreakdown(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    manufacturing: float
    transport: float
    grid: float
    certifications: float
    climate_risk: float = Field(alias="climateRisk")
    total: float


class ManufacturerResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    manufacturer_name: str = Field(alias="manufacturerName")
    country: str
    location: str
    sustainability_url: str | None = Field(alias="sustainabilityUrl")
    certifications: list[str]
    score: ScoreBreakdown


class SearchResult(BaseModel):
    id: str
    summary: str
    results: list[ManufacturerResult]


class MemoRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    search_id: str = Field(alias="searchId")


class MemoResponse(BaseModel):
    title: str
    body: str
