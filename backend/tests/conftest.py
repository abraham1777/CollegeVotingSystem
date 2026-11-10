import os
import sys
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["JWT_SECRET_KEY"] = "test_secret_key_for_smartvote_pytest_suite_32bytes!"

from database import Base
from main import app, get_db
from models import (
    Department,
    User,
    Student,
    EligibleStudent,
    Election,
    Position,
    Candidate,
)
from core.security import hash_password, create_access_token
from fastapi.testclient import TestClient

# SQLite in-memory test database using StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seed_test_data(db_session):
    now = datetime.now(timezone.utc)

    # 1. Department
    dept = Department(name="Computer Science & Engineering")
    db_session.add(dept)
    db_session.flush()

    # 2. Administrator
    admin = User(
        full_name="Election Admin",
        email="admin@test.edu",
        password_hash=hash_password("AdminPass123!"),
        role="admin",
        is_active=True,
    )
    db_session.add(admin)
    db_session.flush()

    # 3. Eligible Student Record 1 (Claimed by Student 1)
    eligible1 = EligibleStudent(
        college_id="TEST-001",
        full_name="Alice Voter",
        department_id=dept.id,
        semester=4,
    )
    db_session.add(eligible1)
    db_session.flush()

    # 4. Student 1 (Alice)
    user_student1 = User(
        full_name="Alice Voter",
        email="alice@test.edu",
        password_hash=hash_password("Password1234!"),
        role="student",
        is_active=True,
    )
    db_session.add(user_student1)
    db_session.flush()

    student1 = Student(
        user_id=user_student1.id,
        student_number="TEST-001",
        department_id=dept.id,
        semester=4,
    )
    db_session.add(student1)
    eligible1.claimed_by_user_id = user_student1.id
    db_session.flush()

    # 5. Student 2 (Candidate Bob)
    eligible2 = EligibleStudent(
        college_id="TEST-002",
        full_name="Bob Candidate",
        department_id=dept.id,
        semester=4,
    )
    db_session.add(eligible2)
    db_session.flush()

    user_student2 = User(
        full_name="Bob Candidate",
        email="bob@test.edu",
        password_hash=hash_password("Password1234!"),
        role="student",
        is_active=True,
    )
    db_session.add(user_student2)
    db_session.flush()

    student2 = Student(
        user_id=user_student2.id,
        student_number="TEST-002",
        department_id=dept.id,
        semester=4,
    )
    db_session.add(student2)
    eligible2.claimed_by_user_id = user_student2.id
    db_session.flush()

    # 6. Student 3 (Candidate Charlie)
    eligible3 = EligibleStudent(
        college_id="TEST-003",
        full_name="Charlie Candidate",
        department_id=dept.id,
        semester=4,
    )
    db_session.add(eligible3)
    db_session.flush()

    user_student3 = User(
        full_name="Charlie Candidate",
        email="charlie@test.edu",
        password_hash=hash_password("Password1234!"),
        role="student",
        is_active=True,
    )
    db_session.add(user_student3)
    db_session.flush()

    student3 = Student(
        user_id=user_student3.id,
        student_number="TEST-003",
        department_id=dept.id,
        semester=4,
    )
    db_session.add(student3)
    eligible3.claimed_by_user_id = user_student3.id
    db_session.flush()

    # 7. Open Election
    open_election = Election(
        title="Active Campus Election",
        description="Live testing election for voting integrity",
        status="open",
        starts_at=now - timedelta(hours=2),
        ends_at=now + timedelta(hours=5),
    )
    db_session.add(open_election)
    db_session.flush()

    pos1 = Position(election_id=open_election.id, title="Department President")
    db_session.add(pos1)
    db_session.flush()

    # Approved candidate (Bob)
    cand_approved = Candidate(
        student_id=student2.id,
        position_id=pos1.id,
        manifesto="Promote open research",
        approval_status="approved",
    )
    db_session.add(cand_approved)

    # Second approved candidate (Charlie)
    cand_approved2 = Candidate(
        student_id=student3.id,
        position_id=pos1.id,
        manifesto="Improve campus sports",
        approval_status="approved",
    )
    db_session.add(cand_approved2)

    # Pending unapproved candidate
    cand_pending = Candidate(
        student_id=student1.id,
        position_id=pos1.id,
        manifesto="Pending platform",
        approval_status="pending",
    )
    db_session.add(cand_pending)
    db_session.flush()

    # Tokens
    student1_token = create_access_token(subject=str(user_student1.id), role=user_student1.role)
    admin_token = create_access_token(subject=str(admin.id), role=admin.role)

    db_session.commit()

    return {
        "admin": admin,
        "admin_token": admin_token,
        "student1": student1,
        "user_student1": user_student1,
        "student1_token": student1_token,
        "student2": student2,
        "student3": student3,
        "open_election": open_election,
        "position1": pos1,
        "cand_approved": cand_approved,
        "cand_approved2": cand_approved2,
        "cand_pending": cand_pending,
    }
