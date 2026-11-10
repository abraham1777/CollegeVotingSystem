
from pydantic import BaseModel, ConfigDict, Field


class EligibleStudentCreate(BaseModel):
    college_id: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=150)
    department_id: int = Field(gt=0)
    semester: int = Field(ge=1, le=12)


class EligibleStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    college_id: str
    full_name: str
    department_id: int
    semester: int
    claimed_by_user_id: int | None

from datetime import datetime

class EligibleStudentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    college_id: str
    full_name: str
    department_id: int
    department_name: str | None = None
    semester: int
    claimed_by_user_id: int | None = None
    claimed_at: datetime | None = None

class BulkUploadResult(BaseModel):
    success: bool
    message: str
    total_processed: int
    added: int
    skipped: int
    errors: list[str] = []
