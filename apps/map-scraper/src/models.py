from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class SourceSchool:
    """A government-school row extracted from the supplied Ministry PDF."""

    sequence: int
    school_id: str
    census_no: int
    name: str
    address: str
    contact: str
    province: str
    district: str
    zone: str
    division: str
    medium: str
    sex: str
    government_type: str
    school_category: str
    grade_span: str
    difficulty: str
    total_students: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class MapSchool:
    """A school result returned by Google Maps."""

    name: str
    latitude: float | None
    longitude: float | None
    address: str | None = None
    place_id: str | None = None
    url: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SchoolRecord:
    """The normalized record consumed by the web application."""

    id: str
    en: str
    si: str
    lat: float | None
    lng: float | None
    gender_type: str
    school_type: str
    district_id: str
    ds_id: str
    source_school_id: str
    source_name: str
    address: str
    zone: str
    division: str
    map_url: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "en": self.en,
            "si": self.si,
            "lat": self.lat,
            "lng": self.lng,
            "genderType": self.gender_type,
            "schoolType": self.school_type,
            "districtId": self.district_id,
            "dsId": self.ds_id,
            "source": {
                "schoolId": self.source_school_id,
                "name": self.source_name,
                "address": self.address,
                "zone": self.zone,
                "division": self.division,
            },
            "mapUrl": self.map_url,
        }
