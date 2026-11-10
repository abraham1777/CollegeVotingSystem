from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admin_id: int | None = None
    admin_email: str
    action: str
    target_type: str
    target_id: str | None = None
    details: str | None = None
    ip_address: str | None = None
    created_at: datetime


class AuditLogFilter(BaseModel):
    action: str | None = None
    target_type: str | None = None
    limit: int = 50
    offset: int = 0

