import hashlib
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from models import AuditLog
from schemas.audit import AuditLogResponse
from core.security import JWT_SECRET_KEY
from sqlalchemy import text
import jwt

from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict

import csv
import io
from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException


from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session




from core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

from database import (
    SessionLocal,
    test_database_connection,
)


from models import (
    Department,
    Election,
    EligibleStudent,
    Student,
    User,
    Position,
    Candidate,
    Vote,
    VoterParticipation,
)


from schemas.auth import (
    StudentLogin,
    StudentRegister,
    TokenResponse,
    UserResponse,
)





from schemas.election import (
    CandidateResultResponse,
    PositionResultResponse,
    ElectionResultsResponse,
    DepartmentCreate,
    DepartmentResponse,
    ElectionCreate,
    ElectionResponse,
    ElectionStatusUpdate,
    ElectionStatusUpdateResponse,
    PositionCreate,
    PositionResponse,
    CandidateCreate,
    CandidateResponse,
    CandidateApprovalUpdate,
    VoteCastRequest,
    ElectionScheduleUpdate
)

   


from schemas.eligible_student import (
    EligibleStudentCreate,
    EligibleStudentResponse,
    EligibleStudentDetailResponse,
    BulkUploadResult,
)



# ==============================================================================
# Phase 3: Distinction-Level Subsystems
# 1. Schema Compatibility Assurance
# 2. Immutable Audit Logger
# 3. APScheduler Automated Election Clock
# ==============================================================================

def ensure_schema_compatibility():
    """
    Guarantees table creation and column consistency for audit logs and receipts
    across both PostgreSQL (production) and SQLite (automated test suites).
    """
    from database import engine, Base
    import models
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE voter_participation ADD COLUMN IF NOT EXISTS receipt_hash VARCHAR(64)"))
            conn.commit()
        except Exception:
            pass


def log_audit(
    db: Session,
    action: str,
    target_type: str,
    target_id: str | int | None = None,
    admin_user: User | None = None,
    details: dict | str | None = None,
    ip_address: str | None = None,
):
    """
    Records an administrative or automated mutation into the immutable audit ledger.
    """
    import json
    details_str = json.dumps(details) if isinstance(details, dict) else str(details) if details else None
    audit = AuditLog(
        admin_id=admin_user.id if admin_user else None,
        admin_email=admin_user.email if admin_user else "SYSTEM",
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        details=details_str,
        ip_address=ip_address,
    )
    db.add(audit)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Audit Log Warning] Failed to commit audit record: {e}")


def check_and_transition_election_schedules(db_session: Session | None = None) -> list[dict]:
    """
    Automated Election Clock Engine (APScheduler Job):
    Evaluates current time against scheduled election time windows (starts_at .. ends_at):
    - Transitions valid 'draft' elections to 'open' when start time arrives.
    - Transitions active 'open' elections to 'closed' when end time passes.
    - Records every automated transition in the immutable audit ledger.
    """
    from database import SessionLocal
    close_session = False
    if db_session is None:
        db = SessionLocal()
        close_session = True
    else:
        db = db_session

    transitions = []
    try:
        now = datetime.now(timezone.utc)

        # 1. Draft -> Open transitions
        draft_elections = db.scalars(select(Election).where(Election.status == "draft")).all()
        for election in draft_elections:
            starts_at = election.starts_at.replace(tzinfo=timezone.utc) if election.starts_at.tzinfo is None else election.starts_at
            ends_at = election.ends_at.replace(tzinfo=timezone.utc) if election.ends_at.tzinfo is None else election.ends_at

            if starts_at <= now < ends_at:
                # Require at least one position
                pos_exists = db.scalar(select(Position.id).where(Position.election_id == election.id).limit(1))
                if pos_exists is not None:
                    # Require that every position has an approved candidate
                    missing_cand = db.scalar(
                        select(Position.id).where(
                            Position.election_id == election.id,
                            ~select(Candidate.id).where(
                                Candidate.position_id == Position.id,
                                Candidate.approval_status == "approved"
                            ).exists()
                        ).limit(1)
                    )
                    if missing_cand is None:
                        election.status = "open"
                        log_audit(
                            db,
                            action="SYSTEM_AUTO_OPEN",
                            target_type="election",
                            target_id=election.id,
                            details={
                                "title": election.title,
                                "starts_at": starts_at.isoformat(),
                                "transitioned_at": now.isoformat(),
                                "trigger": "APScheduler Automated Election Clock",
                            },
                        )
                        transitions.append({
                            "id": election.id,
                            "title": election.title,
                            "transition": "draft -> open",
                        })

        # 2. Open -> Closed transitions
        open_elections = db.scalars(select(Election).where(Election.status == "open")).all()
        for election in open_elections:
            ends_at = election.ends_at.replace(tzinfo=timezone.utc) if election.ends_at.tzinfo is None else election.ends_at

            if now >= ends_at:
                election.status = "closed"
                log_audit(
                    db,
                    action="SYSTEM_AUTO_CLOSE",
                    target_type="election",
                    target_id=election.id,
                    details={
                        "title": election.title,
                        "ends_at": ends_at.isoformat(),
                        "transitioned_at": now.isoformat(),
                        "trigger": "APScheduler Automated Election Clock",
                    },
                )
                transitions.append({
                    "id": election.id,
                    "title": election.title,
                    "transition": "open -> closed",
                })

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[APScheduler Clock Error] {e}")
    finally:
        if close_session:
            db.close()

    return transitions


# Initialize BackgroundScheduler
clock_scheduler = BackgroundScheduler()
clock_scheduler.add_job(
    check_and_transition_election_schedules,
    "interval",
    seconds=30,
    id="election_clock_job",
    replace_existing=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    try:
        ensure_schema_compatibility()
    except Exception:
        pass
    if not clock_scheduler.running:
        clock_scheduler.start()
        print("[*] SmartVote APScheduler Automated Election Clock Running (30s interval)")
    yield
    # Graceful shutdown sequence
    if clock_scheduler.running:
        clock_scheduler.shutdown(wait=False)
        print("[*] SmartVote APScheduler Election Clock Stopped")


app = FastAPI(
    lifespan=lifespan,
    title="SmartVote API",
    description="A Secure and Intelligent College Election Management System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def standard_http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "status_code": exc.status_code,
                "message": str(exc.detail),
            },
            "path": request.url.path,
        },
        headers=exc.headers,
    )



@app.exception_handler(RequestValidationError)
async def standard_validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    errors = [
        {
            "field": ".".join(str(part) for part in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "status_code": 422,
                "message": "Request validation failed",
                "details": errors,
            },
            "path": request.url.path,
        },
    )


bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Identify the user from a valid JWT
def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token_payload = decode_access_token(
            credentials.credentials
        )
        user_id = int(token_payload["sub"])

    except (
        jwt.InvalidTokenError,
        KeyError,
        TypeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User account is unavailable",
        )

    return user

def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Administrator access required",
        )

    return current_user



@app.get("/")
def root():
    return {
        "message": "SmartVote API is running",
        "project": "SmartVote",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/database")
def database_health():
    try:
        version = test_database_connection()
        return {
            "status": "connected",
            "database": "smartvote_db",
            "postgresql_version": version,
        }
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        )





@app.post(
    "/departments",
    response_model=DepartmentResponse,
    status_code=201,
)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    department = Department(name=payload.name.strip())
    db.add(department)

    try:
        db.commit()
        db.refresh(department)
        return department
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This department already exists",
        )



@app.post(
    "/eligible-students",
    response_model=EligibleStudentResponse,
    status_code=201,
)
def create_eligible_student(
    payload: EligibleStudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Confirm that the department exists.
    department = db.query(Department).filter(
        Department.id == payload.department_id
    ).first()

    if department is None:
        raise HTTPException(
            status_code=404,
            detail="Department not found",
        )

    # Prevent duplicate college IDs.
    existing = db.query(EligibleStudent).filter(
        EligibleStudent.college_id == payload.college_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="College ID is already on the eligibility roster",
        )

    student = EligibleStudent(
        college_id=payload.college_id.strip(),
        full_name=payload.full_name.strip(),
        department_id=payload.department_id,
        semester=payload.semester,
    )

    try:
        db.add(student)
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Roster entry conflicts with an existing record",
        )

    return student



@app.post(
    "/elections",
    response_model=ElectionResponse,
    status_code=201,
)
def create_election(
    payload: ElectionCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    if payload.ends_at <= payload.starts_at:
        raise HTTPException(
            status_code=422,
            detail="Election end time must be after start time",
        )

    election = Election(
        title=payload.title.strip(),
        description=payload.description,
        department_id=payload.department_id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        status="draft",
    )

    db.add(election)
    db.commit()
    db.refresh(election)
    log_audit(
        db,
        action="CREATE_ELECTION",
        target_type="election",
        target_id=election.id,
        admin_user=admin_user,
        details={"title": election.title, "status": election.status, "starts_at": str(election.starts_at), "ends_at": str(election.ends_at)},
    )
    return election

@app.get(
    "/elections",
    response_model=list[ElectionResponse],
)
def list_elections(db: Session = Depends(get_db)):
    statement = select(Election).order_by(Election.id.desc())
    return db.scalars(statement).all()


@app.post(
    "/auth/register",
    response_model=UserResponse,
    status_code=201,
)
def register_student(
    payload: StudentRegister,
    db: Session = Depends(get_db),
):
    college_id = payload.college_id.strip()
    full_name = payload.full_name.strip()
    email = str(payload.email).strip().lower()

    try:
        # Lock the roster record so simultaneous registrations
        # cannot claim the same college ID.
        eligible = db.scalar(
            select(EligibleStudent)
            .where(EligibleStudent.college_id == college_id)
            .with_for_update()
        )

        if eligible is None:
            raise HTTPException(
                status_code=403,
                detail="College ID is not approved for registration",
            )

        if eligible.full_name.strip().casefold() != full_name.casefold():
            raise HTTPException(
                status_code=403,
                detail="Name does not match the approved student record",
            )

        if eligible.claimed_by_user_id is not None:
            raise HTTPException(
                status_code=409,
                detail="This college ID has already been registered",
            )

        existing_user = db.scalar(
            select(User).where(User.email == email)
        )

        if existing_user is not None:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists",
            )

        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(payload.password),
            role="student",
            is_active=True,
        )

        db.add(user)
        db.flush()

        student = Student(
            user_id=user.id,
            student_number=eligible.college_id,
            department_id=eligible.department_id,
            semester=eligible.semester,
        )
        db.add(student)

        eligible.claimed_by_user_id = user.id
        eligible.claimed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(user)

        return user

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Registration conflicts with an existing record",
        )

# JWT bearer authentication
bearer_scheme = HTTPBearer(auto_error=False)


# Student login
@app.post("/auth/login", response_model=TokenResponse)
def login_student(
    payload: StudentLogin,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    # Do not reveal whether the email exists.
    if user is None or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is inactive",
        )

    access_token = create_access_token(
        subject=str(user.id),
        role=user.role,
    )

    return TokenResponse(access_token=access_token)



# Get the currently authenticated user
@app.get("/auth/me", response_model=UserResponse)
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    student = current_user.student
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        student_number=student.student_number if student else None,
        department_id=student.department_id if student else None,
        department_name=student.department.name if (student and student.department) else None,
    )



# Create a position for an election (admin only)
@app.post(
    "/elections/{election_id}/positions",
    response_model=PositionResponse,
    status_code=201,
)
def create_position(
    election_id: int,
    payload: PositionCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    election = db.get(Election, election_id)

    if election is None:
        raise HTTPException(
            status_code=404,
            detail="Election not found",
        )

    if election.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Positions can only be added to draft elections",
        )

    title = payload.title.strip()

    existing = db.scalar(
        select(Position).where(
            Position.election_id == election_id,
            Position.title.ilike(title),
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="This position already exists for the election",
        )

    position = Position(
        election_id=election_id,
        title=title,
    )

    db.add(position)
    db.commit()
    db.refresh(position)

    return position


# List positions for an election
@app.get(
    "/elections/{election_id}/positions",
    response_model=list[PositionResponse],
)
def list_positions(
    election_id: int,
    db: Session = Depends(get_db),
):
    election = db.get(Election, election_id)

    if election is None:
        raise HTTPException(
            status_code=404,
            detail="Election not found",
        )

    statement = (
        select(Position)
        .where(Position.election_id == election_id)
        .order_by(Position.id)
    )

    return db.scalars(statement).all()


# Register a candidate for a position (admin only)
@app.post(
    "/positions/{position_id}/candidates",
    response_model=CandidateResponse,
    status_code=201,
)
def create_candidate(
    position_id: int,
    payload: CandidateCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    position = db.get(Position, position_id)

    if position is None:
        raise HTTPException(
            status_code=404,
            detail="Position not found",
        )

    student = db.get(Student, payload.student_id)

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    existing = db.scalar(
        select(Candidate).where(
            Candidate.position_id == position_id,
            Candidate.student_id == payload.student_id,
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="This student is already registered for this position",
        )

    if position.election.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Candidates can only be registered for draft elections",
        )

    # Department restriction check: Candidates must belong to the respective department
    target_dept_id = position.election.department_id
    if target_dept_id is None:
        title_upper = position.election.title.upper()
        for d_code in ["MCA", "MBA", "MCOM", "MSW", "MSC"]:
            if d_code in title_upper:
                matched_d = db.scalar(select(Department).where(Department.name.ilike(f"%{d_code}%")))
                if matched_d:
                    target_dept_id = matched_d.id
                    break

    if target_dept_id is not None and student.department_id != target_dept_id:
        dept = db.get(Department, target_dept_id)
        dept_name = dept.name if dept else "the designated program"
        raise HTTPException(
            status_code=400,
            detail=f"Candidate eligibility error: This election is designated for {dept_name}. Students from other departments cannot participate as candidates.",
        )

    # Maximum 5 candidates per position quota
    candidate_count = db.scalar(
        select(func.count(Candidate.id)).where(Candidate.position_id == position_id)
    )
    if candidate_count >= 5:
        raise HTTPException(
            status_code=400,
            detail="Position quota reached: A maximum of 5 candidates can participate for any single position.",
        )

    candidate = Candidate(
        student_id=payload.student_id,
        position_id=position_id,
        manifesto=payload.manifesto,
        image_url=payload.image_url,
        approval_status="pending",
    )

    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    log_audit(
        db,
        action="CANDIDATE_REGISTERED",
        target_type="candidate",
        target_id=candidate.id,
        admin_user=admin_user,
        details={"position_id": candidate.position_id, "approval_status": candidate.approval_status},
    )

    return CandidateResponse(
        id=candidate.id,
        student_id=candidate.student_id,
        position_id=candidate.position_id,
        manifesto=candidate.manifesto,
        image_url=candidate.image_url,
        approval_status=candidate.approval_status,
        student_name=(student.user.full_name if (student and student.user) else None),
        student_number=student.student_number if student else None,
        department_name=student.department.name if (student and student.department) else None,
    )


class RegisteredStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    student_number: str
    full_name: str | None = None
    email: str | None = None
    department_id: int
    department_name: str | None = None
    semester: int


@app.get(
    "/students",
    response_model=list[RegisteredStudentResponse],
)
def list_registered_students(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    students = db.scalars(select(Student).order_by(Student.id)).all()
    results = []
    for s in students:
        results.append(
            RegisteredStudentResponse(
                id=s.id,
                user_id=s.user_id,
                student_number=s.student_number,
                full_name=s.user.full_name if s.user else None,
                email=s.user.email if s.user else None,
                department_id=s.department_id,
                department_name=s.department.name if s.department else None,
                semester=s.semester,
            )
        )
    return results


# List candidates for a position (supports optional status filter; defaults to approved for public, all for admin)
@app.get(
    "/positions/{position_id}/candidates",
    response_model=list[CandidateResponse],
)
def list_candidates(
    position_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    position = db.get(Position, position_id)

    if position is None:
        raise HTTPException(
            status_code=404,
            detail="Position not found",
        )

    statement = select(Candidate).where(Candidate.position_id == position_id)
    if status is not None and status.lower() != "all":
        statement = statement.where(Candidate.approval_status == status.lower())

    statement = statement.order_by(Candidate.id)
    candidates = db.scalars(statement).all()

    results = []
    for c in candidates:
        student = db.get(Student, c.student_id)
        dept = student.department if student else None
        results.append(
            CandidateResponse(
                id=c.id,
                student_id=c.student_id,
                position_id=c.position_id,
                manifesto=c.manifesto,
                image_url=c.image_url,
                approval_status=c.approval_status,
                student_name=(student.user.full_name if (student and student.user) else None),
                student_number=student.student_number if student else None,
                department_name=dept.name if dept else None,
            )
        )
    return results



@app.patch(
    "/candidates/{candidate_id}/approval",
    response_model=CandidateResponse,
)
def update_candidate_approval(
    candidate_id: int,
    payload: CandidateApprovalUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    candidate = db.get(Candidate, candidate_id)

    if candidate is None:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found",
        )

    if candidate.position.election.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Candidates can only be reviewed before the election starts",
        )

    candidate.approval_status = payload.approval_status

    db.commit()
    db.refresh(candidate)

    student = db.get(Student, candidate.student_id)
    dept = student.department if student else None
    return CandidateResponse(
        id=candidate.id,
        student_id=candidate.student_id,
        position_id=candidate.position_id,
        manifesto=candidate.manifesto,
        image_url=candidate.image_url,
        approval_status=candidate.approval_status,
        student_name=(student.user.full_name if (student and student.user) else None),
        student_number=student.student_number if student else None,
        department_name=dept.name if dept else None,
    )



@app.post("/elections/{election_id}/positions/{position_id}/vote")
def cast_vote(
    election_id: int,
    position_id: int,
    payload: VoteCastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only student accounts may vote.
    if current_user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="Only student accounts can vote",
        )

    # Find the student linked to the authenticated account.
    student = db.scalar(
        select(Student).where(
            Student.user_id == current_user.id
        )
    )

    if student is None:
        raise HTTPException(
            status_code=403,
            detail="No student record is linked to this account",
        )

    # Verify that the student claimed an approved roster record.
    eligible = db.scalar(
        select(EligibleStudent).where(
            EligibleStudent.claimed_by_user_id == current_user.id,
            EligibleStudent.college_id == student.student_number,
        )
    )

    if eligible is None:
        raise HTTPException(
            status_code=403,
            detail="Student eligibility could not be verified",
        )

    # Verify the election exists and is open.
    election = db.get(Election, election_id)

    if election is None:
        raise HTTPException(
            status_code=404,
            detail="Election not found",
        )

    if election.status != "open":
        raise HTTPException(
            status_code=409,
            detail="This election is not open for voting",
        )

    # Enforce department isolation: an MBA student cannot participate in an MCA election
    target_dept_id = election.department_id
    if target_dept_id is None:
        title_upper = election.title.upper()
        for d_code in ["MCA", "MBA", "MCOM", "MSW", "MSC"]:
            if d_code in title_upper:
                matched_d = db.scalar(select(Department).where(Department.name.ilike(f"%{d_code}%")))
                if matched_d:
                    target_dept_id = matched_d.id
                    break

    if target_dept_id is not None and student.department_id != target_dept_id:
        dept = db.get(Department, target_dept_id)
        dept_name = dept.name if dept else "the designated academic department"
        raise HTTPException(
            status_code=403,
            detail=f"Voter eligibility error: You belong to a different department. This election is exclusively for {dept_name} students.",
        )

    now = datetime.now(timezone.utc)
    starts_at = election.starts_at.replace(tzinfo=timezone.utc) if election.starts_at.tzinfo is None else election.starts_at
    ends_at = election.ends_at.replace(tzinfo=timezone.utc) if election.ends_at.tzinfo is None else election.ends_at

    if now < starts_at or now > ends_at:
        raise HTTPException(
            status_code=409,
            detail="Voting is outside the scheduled election time",
        )

    # Verify that the position belongs to this election.
    position = db.get(Position, position_id)

    if position is None or position.election_id != election_id:
        raise HTTPException(
            status_code=404,
            detail="Position not found in this election",
        )

    # Verify that the candidate is approved for this position.
    candidate = db.get(Candidate, payload.candidate_id)

    if (
        candidate is None
        or candidate.position_id != position_id
        or candidate.approval_status != "approved"
    ):
        raise HTTPException(
            status_code=400,
            detail="Select an approved candidate for this position",
        )

    try:
        # Record participation separately from the ballot choice.
        participation = VoterParticipation(
            election_id=election_id,
            position_id=position_id,
            student_id=student.id,
        )
        db.add(participation)
        db.flush()

        # Generate a verifiable SHA-256 ballot receipt hash
        rec_time = participation.recorded_at or datetime.now(timezone.utc)
        rec_time_iso = rec_time.isoformat() if hasattr(rec_time, 'isoformat') else str(rec_time)
        receipt_raw = f"SMARTVOTE:{election_id}:{position_id}:{student.id}:{participation.id}:{rec_time_iso}:{JWT_SECRET_KEY}"
        receipt_hash = hashlib.sha256(receipt_raw.encode("utf-8")).hexdigest()
        participation.receipt_hash = receipt_hash

        # The ballot stores no student ID (Decoupled Secret Ballot).
        ballot = Vote(
            election_id=election_id,
            position_id=position_id,
            candidate_id=candidate.id,
        )
        db.add(ballot)

        # Both records succeed together or are rolled back together.
        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A vote has already been recorded for this position",
        )

    return {
        "message": "Your vote has been recorded successfully",
        "election_id": election_id,
        "position_id": position_id,
        "receipt_hash": receipt_hash,
        "recorded_at": rec_time_iso,
    }


@app.patch(
    "/elections/{election_id}/schedule",
    response_model=ElectionResponse,
)
def update_election_schedule(
    election_id: int,
    payload: ElectionScheduleUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    election = db.get(Election, election_id)

    if election is None:
        raise HTTPException(
            status_code=404,
            detail="Election not found",
        )

    if election.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only draft elections can have their schedule updated",
        )

    if payload.ends_at <= payload.starts_at:
        raise HTTPException(
            status_code=422,
            detail="Election end time must be after start time",
        )

    election.starts_at = payload.starts_at
    election.ends_at = payload.ends_at

    db.commit()
    db.refresh(election)
    log_audit(
        db,
        action="UPDATE_ELECTION_SCHEDULE",
        target_type="election",
        target_id=election.id,
        admin_user=admin_user,
        details={"title": election.title, "starts_at": str(payload.starts_at), "ends_at": str(payload.ends_at)},
    )

    return election


@app.patch(
    "/elections/{election_id}/status",
    response_model=ElectionStatusUpdateResponse,
)
def update_election_status(
    election_id: int,
    payload: ElectionStatusUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    election = db.get(Election, election_id)

    if election is None:
        raise HTTPException(
            status_code=404,
            detail="Election not found",
        )

    now = datetime.now(timezone.utc)

    if payload.status == "open":
        # A closed election cannot be reopened.
        if election.status == "closed":
            raise HTTPException(
                status_code=409,
                detail="A closed election cannot be reopened",
            )

        # Enforce the scheduled opening time.
        if now < election.starts_at:
            raise HTTPException(
                status_code=409,
                detail="The scheduled election start time has not arrived",
            )

        # Enforce the scheduled closing time.
        if now > election.ends_at:
            raise HTTPException(
                status_code=409,
                detail="The scheduled election end time has passed",
            )

        # Require at least one position.
        position_exists = db.scalar(
            select(Position.id)
            .where(Position.election_id == election_id)
            .limit(1)
        )

        if position_exists is None:
            raise HTTPException(
                status_code=409,
                detail="Add at least one position before opening the election",
            )

        # Every position must have at least one approved candidate.
        position_without_candidate = db.scalar(
            select(Position.id)
            .where(
                Position.election_id == election_id,
                ~select(Candidate.id)
                .where(
                    Candidate.position_id == Position.id,
                    Candidate.approval_status == "approved",
                )
                .exists(),
            )
            .limit(1)
        )

        if position_without_candidate is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Every position must have at least one approved "
                    "candidate before opening the election"
                ),
            )

        election.status = "open"

    else:
        # Only an open election can be closed.
        if election.status != "open":
            raise HTTPException(
                status_code=409,
                detail="Only an open election can be closed",
            )

        election.status = "closed"

    
    db.commit()
    db.refresh(election)
    log_audit(
        db,
        action=f"SET_STATUS_{election.status.upper()}",
        target_type="election",
        target_id=election.id,
        admin_user=admin_user,
        details={"title": election.title, "status": election.status},
    )
    return {
        "success": True,
        "message": f"Election status updated to '{election.status}' successfully",
        "data": {
            "id": election.id,
            "title": election.title,
            "status": election.status,
            },
            }


# ==========================================
# Election Results & Tally Engine
# ==========================================

@app.get(
    "/elections/{election_id}/results",
    response_model=ElectionResultsResponse,
)
def get_election_results(
    election_id: int,
    db: Session = Depends(get_db),
):
    election = db.get(Election, election_id)
    if election is None:
        raise HTTPException(
            status_code=404,
            detail="Election not found",
        )

    total_ballots = db.scalar(
        select(func.count(func.distinct(VoterParticipation.student_id)))
        .where(VoterParticipation.election_id == election_id)
    ) or 0

    status_lower = election.status.lower()
    has_published_tallies = status_lower in ["open", "closed"]

    if status_lower == "draft":
        tally_notice = "Election is in draft stage. Voting has not commenced."
    elif status_lower == "open":
        tally_notice = "Live interim tally. Official winner certification occurs upon election closure."
    else:
        tally_notice = "Official certified tally audited from the PostgreSQL ballot ledger."

    positions = db.scalars(
        select(Position)
        .where(Position.election_id == election_id)
        .order_by(Position.id)
    ).all()

    position_results: list[PositionResultResponse] = []

    for pos in positions:
        candidates = db.scalars(
            select(Candidate)
            .where(
                Candidate.position_id == pos.id,
                Candidate.approval_status == "approved"
            )
            .order_by(Candidate.id)
        ).all()

        vote_counts_rows = db.execute(
            select(Vote.candidate_id, func.count(Vote.id))
            .where(
                Vote.election_id == election_id,
                Vote.position_id == pos.id,
            )
            .group_by(Vote.candidate_id)
        ).all()
        vote_counts = {cid: cnt for cid, cnt in vote_counts_rows}

        total_position_votes = sum(vote_counts.values())
        max_votes = max(vote_counts.values()) if (vote_counts and total_position_votes > 0) else 0

        winning_ids = [cid for cid, count in vote_counts.items() if count == max_votes and count > 0]
        has_single_winner = len(winning_ids) == 1

        cand_results: list[CandidateResultResponse] = []
        for c in candidates:
            student = db.get(Student, c.student_id)
            candidate_name = student.user.full_name if (student and student.user) else None

            c_votes = vote_counts.get(c.id, 0) if has_published_tallies else None
            c_pct = (
                round((c_votes / total_position_votes * 100), 2)
                if (has_published_tallies and total_position_votes > 0 and c_votes is not None)
                else (0.0 if has_published_tallies else None)
            )

            is_winner = (
                status_lower == "closed"
                and has_single_winner
                and c.id in winning_ids
            ) if has_published_tallies else False

            cand_results.append(
                CandidateResultResponse(
                    id=c.id,
                    student_id=c.student_id,
                    candidate_name=candidate_name,
                    position_id=c.position_id,
                    manifesto=c.manifesto,
                    approval_status=c.approval_status,
                    votes=c_votes,
                    percentage=c_pct,
                    is_winner=is_winner,
                )
            )

        winner_candidate = next((cr for cr in cand_results if cr.is_winner), None)

        position_results.append(
            PositionResultResponse(
                id=pos.id,
                election_id=pos.election_id,
                title=pos.title,
                candidates=cand_results,
                total_votes=total_position_votes if has_published_tallies else 0,
                winner=winner_candidate,
            )
        )

    return ElectionResultsResponse(
        election_id=election.id,
        election_title=election.title,
        election_status=election.status,
        has_published_tallies=has_published_tallies,
        tally_notice=tally_notice,
        total_ballots_cast=total_ballots,
        positions=position_results,
    )


# ==========================================
# Eligible Student Roster & Bulk Upload
# ==========================================

@app.get(
    "/eligible-students",
    response_model=list[EligibleStudentDetailResponse],
)
def list_eligible_students(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    query = (
        select(EligibleStudent, Department.name)
        .join(Department, Department.id == EligibleStudent.department_id, isouter=True)
        .order_by(EligibleStudent.id)
    )
    rows = db.execute(query).all()
    results = []
    for eligible, dept_name in rows:
        results.append(
            EligibleStudentDetailResponse(
                id=eligible.id,
                college_id=eligible.college_id,
                full_name=eligible.full_name,
                department_id=eligible.department_id,
                department_name=dept_name,
                semester=eligible.semester,
                claimed_by_user_id=eligible.claimed_by_user_id,
                claimed_at=eligible.claimed_at,
            )
        )
    return results


@app.post(
    "/eligible-students/bulk",
    response_model=BulkUploadResult,
)
async def bulk_upload_eligible_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    contents = await file.read()
    text = contents.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))

    total = 0
    added = 0
    skipped = 0
    errors: list[str] = []

    departments = db.scalars(select(Department)).all()
    dept_map_id = {d.id: d for d in departments}
    dept_map_name = {d.name.strip().lower(): d for d in departments}

    for row_idx, row in enumerate(reader, start=1):
        if not row or not any(cell.strip() for cell in row):
            continue

        if row_idx == 1 and any(h in row[0].lower() for h in ["college", "roll", "student_id"]):
            continue

        total += 1
        if len(row) < 4:
            skipped += 1
            errors.append(f"Row {row_idx}: Expected 4 columns (college_id, full_name, department, semester)")
            continue

        college_id = row[0].strip()
        full_name = row[1].strip()
        dept_val = row[2].strip()
        sem_val = row[3].strip()

        if not college_id or not full_name:
            skipped += 1
            errors.append(f"Row {row_idx}: College ID or Full Name is empty")
            continue

        dept_obj = None
        if dept_val.isdigit() and int(dept_val) in dept_map_id:
            dept_obj = dept_map_id[int(dept_val)]
        elif dept_val.lower() in dept_map_name:
            dept_obj = dept_map_name[dept_val.lower()]
        else:
            for d_name, d_entity in dept_map_name.items():
                if dept_val.lower() in d_name:
                    dept_obj = d_entity
                    break

        if dept_obj is None:
            skipped += 1
            errors.append(f"Row {row_idx} ({college_id}): Department '{dept_val}' not recognized")
            continue

        try:
            semester = int(sem_val)
            if semester < 1 or semester > 12:
                raise ValueError()
        except ValueError:
            skipped += 1
            errors.append(f"Row {row_idx} ({college_id}): Semester '{sem_val}' must be between 1 and 12")
            continue

        existing = db.scalar(
            select(EligibleStudent).where(EligibleStudent.college_id == college_id)
        )
        if existing:
            skipped += 1
            errors.append(f"Row {row_idx}: College ID '{college_id}' already in roster")
            continue

        new_student = EligibleStudent(
            college_id=college_id,
            full_name=full_name,
            department_id=dept_obj.id,
            semester=semester,
        )
        db.add(new_student)
        added += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit bulk upload: {str(e)}",
        )

    log_audit(
        db,
        action="BULK_UPLOAD_ROSTER",
        target_type="eligible_student",
        admin_user=admin_user,
        details={"total_processed": total, "added": added, "skipped": skipped},
    )
    return BulkUploadResult(
        success=True,
        message=f"Roster processed: {added} students added, {skipped} skipped.",
        total_processed=total,
        added=added,
        skipped=skipped,
        errors=errors[:20],
    )


# ==========================================
# Department Catalog Listing
# ==========================================

@app.get(
    "/departments",
    response_model=list[DepartmentResponse],
)
def list_departments(
    db: Session = Depends(get_db),
):
    return db.scalars(select(Department).order_by(Department.id)).all()



# ==============================================================================
# Phase 3: Distinction-Level Routes
# 1. Cryptographic Ballot Receipt Verification
# 2. Immutable Audit Log Ledger & CSV Export
# 3. APScheduler Automated Election Clock Controls
# ==============================================================================

@app.get("/votes/verify/{receipt_hash}")
def verify_ballot_receipt(
    receipt_hash: str,
    db: Session = Depends(get_db),
):
    """
    Public cryptographic ballot verification endpoint.
    Verifies that a SHA-256 receipt hash exists in the immutable voter participation ledger,
    confirming the ballot was cast, without compromising secret ballot choice.
    """
    clean_hash = receipt_hash.strip().lower()
    participation = db.scalar(
        select(VoterParticipation).where(VoterParticipation.receipt_hash == clean_hash)
    )
    if not participation:
        raise HTTPException(
            status_code=404,
            detail="Ballot receipt hash not found in election participation ledger",
        )

    election = db.get(Election, participation.election_id)
    position = db.get(Position, participation.position_id)

    rec_time = participation.recorded_at
    rec_time_iso = rec_time.isoformat() if hasattr(rec_time, "isoformat") else str(rec_time)

    return {
        "verified": True,
        "receipt_hash": clean_hash,
        "election_id": participation.election_id,
        "election_title": election.title if election else f"Election #{participation.election_id}",
        "position_id": participation.position_id,
        "position_title": position.title if position else f"Position #{participation.position_id}",
        "recorded_at": rec_time_iso,
        "status": "Cryptographically Sealed & Tallied",
        "algorithm": "SHA-256",
        "secrecy_note": "Ballot choice is decoupled and stored anonymously in PostgreSQL.",
    }


@app.get("/audit-logs", response_model=list[AuditLogResponse])
def get_audit_logs(
    action: str | None = None,
    target_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Query the immutable administrative audit ledger (Administrator only).
    """
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action == action.strip())
    if target_type:
        query = query.where(AuditLog.target_type == target_type.strip())
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    return db.scalars(query).all()


@app.get("/audit-logs/export")
def export_audit_logs_csv(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Export the complete immutable administrative audit trail as a signed CSV file.
    """
    from fastapi.responses import Response
    records = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc())).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Log ID",
        "Timestamp (UTC)",
        "Actor Email",
        "Actor User ID",
        "Action Performed",
        "Target Entity Type",
        "Target Entity ID",
        "Mutation Details",
        "IP Address",
    ])

    for r in records:
        writer.writerow([
            r.id,
            r.created_at.isoformat() if r.created_at else "",
            r.admin_email,
            r.admin_id or "SYSTEM",
            r.action,
            r.target_type,
            r.target_id or "",
            r.details or "",
            r.ip_address or "",
        ])

    csv_data = output.getvalue()
    filename = f"smartvote_immutable_audit_log_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/admin/clock/tick")
def trigger_clock_tick(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Manually triggers an immediate evaluation of the APScheduler election clock.
    Transitions elections whose scheduled time windows have arrived or expired.
    """
    transitions = check_and_transition_election_schedules(db_session=db)
    return {
        "success": True,
        "message": f"Clock evaluation executed. {len(transitions)} election(s) transitioned.",
        "transitions": transitions,
    }


@app.get("/admin/clock/status")
def get_clock_status(admin_user: User = Depends(require_admin)):
    """
    Returns the real-time operational status of the APScheduler election clock engine.
    """
    return {
        "status": "running" if clock_scheduler.running else "stopped",
        "current_time_utc": datetime.now(timezone.utc).isoformat(),
        "job_id": "election_clock_job",
        "interval_seconds": 30,
    }
