
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints
from typing import Annotated


CollegeID = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=3,
        max_length=50,
    ),
]

FullName = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=2,
        max_length=150,
    ),
]


class StudentRegister(BaseModel):
    college_id: CollegeID
    full_name: FullName
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class StudentLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    student_number: str | None = None
    department_id: int | None = None
    department_name: str | None = None
