
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from typing import Annotated

from pydantic import StringConstraints

from typing import Literal



class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ElectionCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    department_id: int | None = None
    starts_at: datetime
    ends_at: datetime


class ElectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    department_id: int | None = None
    status: str
    starts_at: datetime
    ends_at: datetime


class ElectionStatusUpdateData(BaseModel):
    id: int
    title: str
    status: str


class ElectionStatusUpdateResponse(BaseModel):
    success: bool
    message: str
    data: ElectionStatusUpdateData



PositionTitle = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=2,
        max_length=100,
    ),
]


class PositionCreate(BaseModel):
    title: PositionTitle


class PositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    election_id: int
    title: str


class CandidateCreate(BaseModel):
    student_id: int = Field(gt=0)
    manifesto: str | None = Field(
        default=None,
        max_length=5000,
    )
    image_url: str | None = Field(
        default=None,
        max_length=500,
    )


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    position_id: int
    manifesto: str | None
    image_url: str | None = None
    approval_status: str
    student_name: str | None = None
    student_number: str | None = None
    department_name: str | None = None

class CandidateApprovalUpdate(BaseModel):
    approval_status: Literal["approved", "rejected"]



class VoteCastRequest(BaseModel):
    candidate_id: int = Field(gt=0)


class ElectionStatusUpdate(BaseModel):
    status: Literal["open", "closed"]


class ElectionScheduleUpdate(BaseModel):
    starts_at: datetime
    ends_at: datetime

class CandidateResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    candidate_name: str | None = None
    position_id: int
    manifesto: str | None = None
    approval_status: str
    votes: int | None = None
    percentage: float | None = None
    is_winner: bool | None = None


class PositionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    election_id: int
    title: str
    candidates: list[CandidateResultResponse]
    total_votes: int = 0
    winner: CandidateResultResponse | None = None


class ElectionResultsResponse(BaseModel):
    election_id: int
    election_title: str
    election_status: str
    has_published_tallies: bool
    tally_notice: str
    total_ballots_cast: int
    positions: list[PositionResultResponse]
