# SmartVote: Architecture & UML Diagrams

This document contains the complete software engineering specification, Entity-Relationship Diagram (ERD), System Architecture, Sequence Diagrams, and State Machines for the SmartVote College Election Management System.

---

## 1. High-Level System Architecture

```mermaid
graph TD
    subgraph ClientLayer["Frontend Client Tier (Next.js 16 + React 19 + Tailwind CSS v4)"]
        AdminUI["Admin Portal (/login, /elections, /candidates, /roster, /results, /audit)"]
        StudentUI["Student Portal (/student/login, /student/register, /student/vote)"]
        AuthContext["Auth Context & Token Manager (sessionStorage / localStorage)"]
    end

    subgraph APILayer["Backend Application Tier (FastAPI + Python 3.12)"]
        APIRouter["FastAPI HTTP Router & CORS Middleware"]
        AuthGuard["JWT Security & RBAC Guards (require_admin, get_current_user)"]
        
        subgraph Services["Core Subsystems"]
            AuthModule["Auth & Roster Verification Service"]
            ElectionService["Election & Schedule Engine"]
            VotingEngine["Cryptographic Ballot & Participation Decoupler"]
            TallyEngine["Aggregation & Certified Results Engine"]
            ClockEngine["APScheduler Automated Clock Engine (30s Tick)"]
            AuditEngine["Immutable Audit Ledger Logger"]
        end
    end

    subgraph DataLayer["Persistence Tier (PostgreSQL 16)"]
        UserTable["users & students"]
        RosterTable["eligible_students (Pre-approved College IDs)"]
        ElectionTables["elections, positions, candidates"]
        SecretBallotTables["voter_participation (Receipt Hash) & votes (Decoupled Secret Ballots)"]
        AuditTable["audit_logs (Immutable Administrative Ledger)"]
    end

    AdminUI --> AuthContext
    StudentUI --> AuthContext
    AuthContext -->|"Bearer JWT (Authorization Header)"| APIRouter
    APIRouter --> AuthGuard
    AuthGuard --> Services
    ClockEngine -->|"Automated Schedule Transitions"| ElectionService
    Services -->|"Audit Mutations"| AuditEngine
    Services -->|"SQLAlchemy 2.0 ORM"| DataLayer
```

---

## 2. Entity-Relationship Diagram (ERD)

The database schema guarantees cryptographic anonymity and voter privacy by strictly decoupling voter participation timestamps (`voter_participation`) from candidate ballot marks (`votes`), while recording an append-only audit trail (`audit_logs`) of all administrative mutations.

```mermaid
erDiagram
    DEPARTMENTS ||--o{ STUDENTS : "enrolls"
    DEPARTMENTS ||--o{ ELIGIBLE_STUDENTS : "categorizes"
    USERS ||--o| STUDENTS : "identifies"
    USERS ||--o| ELIGIBLE_STUDENTS : "claims"
    ELECTIONS ||--o{ POSITIONS : "defines"
    POSITIONS ||--o{ CANDIDATES : "nominates"
    ELECTIONS ||--o{ VOTER_PARTICIPATION : "tracks_turnout"
    STUDENTS ||--o{ VOTER_PARTICIPATION : "records_participation"
    POSITIONS ||--o{ VOTES : "ballots_for"
    CANDIDATES ||--o{ VOTES : "receives"
    USERS ||--o{ AUDIT_LOGS : "performs"

    DEPARTMENTS {
        int id PK
        string name UK
        timestamp created_at
    }

    USERS {
        int id PK
        string full_name
        string email UK
        string password_hash
        string role "admin | student"
        boolean is_active
        timestamp created_at
    }

    STUDENTS {
        int id PK
        int user_id FK,UK
        string student_number UK
        int department_id FK
        int semester
        timestamp created_at
    }

    ELIGIBLE_STUDENTS {
        int id PK
        string college_id UK
        string full_name
        int department_id FK
        int semester
        int claimed_by_user_id FK,UK
        timestamp claimed_at
        timestamp created_at
    }

    ELECTIONS {
        int id PK
        string title
        string description
        timestamp starts_at
        timestamp ends_at
        string status "draft | open | closed"
        int created_by_user_id FK
        timestamp created_at
    }

    POSITIONS {
        int id PK
        int election_id FK
        string title
        string description
        int max_choices
        timestamp created_at
    }

    CANDIDATES {
        int id PK
        int position_id FK
        int student_id FK
        string manifesto
        string approval_status "pending | approved | rejected"
        int approved_by_user_id FK
        timestamp created_at
    }

    VOTER_PARTICIPATION {
        int id PK
        int election_id FK
        int position_id FK
        int student_id FK
        string receipt_hash UK "SHA-256 Digest"
        timestamp recorded_at
    }

    VOTES {
        int id PK
        int election_id FK
        int position_id FK
        int candidate_id FK
        timestamp cast_at
    }

    AUDIT_LOGS {
        int id PK
        int admin_id FK
        string admin_email
        string action "Index"
        string target_type "Index"
        string target_id
        text details "JSON Payload"
        string ip_address
        timestamp created_at "Index"
    }
```

---

## 3. Sequence Diagram 1: Student Roster Claim & Registration

Demonstrates how unregistered students authenticate against the pre-approved institutional roster using pessimistic locking (`with_for_update`) to prevent duplicate registrations.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Voter
    participant Frontend as Next.js Client (/student/register)
    participant API as FastAPI (POST /auth/register)
    participant DB as PostgreSQL Database

    Student->>Frontend: Enter College ID, Full Name, Email, Password
    Frontend->>API: POST /auth/register {college_id, full_name, email, password}
    
    rect rgb(240, 248, 255)
        note right of API: Concurrency & Identity Verification
        API->>DB: SELECT * FROM eligible_students WHERE college_id = :id FOR UPDATE
        alt Roster Record Not Found or Name Mismatch
            API-->>Frontend: 403 Forbidden ("Name or College ID not approved")
            Frontend-->>Student: Display validation error
        else Record Already Claimed
            API-->>Frontend: 409 Conflict ("College ID already claimed")
            Frontend-->>Student: Display already registered notification
        else Valid Unclaimed Record
            API->>DB: INSERT INTO users (full_name, email, password_hash, role='student')
            API->>DB: INSERT INTO students (user_id, student_number, department_id, semester)
            API->>DB: UPDATE eligible_students SET claimed_by_user_id = user.id, claimed_at = NOW()
            DB-->>API: Transaction Committed
            API-->>Frontend: 200 OK (User Profile JSON)
            Frontend-->>Student: "Registration Successful! Redirecting to Sign In..."
        end
    end
```

---

## 4. Sequence Diagram 2: Secret Ballot Casting & Cryptographic Receipt Generation

Demonstrates the security architecture that guarantees voter anonymity while providing verifiable proof of casting:
1. Participation is recorded under the student's ID (`voter_participation`) with a **SHA-256 cryptographic receipt hash** to prevent double voting.
2. The ballot mark (`votes`) contains **zero** voter identification, foreign keys, or user references.
3. The voter receives the SHA-256 hash receipt for independent verification.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Authenticated Student
    participant Frontend as Next.js Client (/student/vote)
    participant API as FastAPI (POST /votes)
    participant DB as PostgreSQL Database

    Student->>Frontend: Select Candidate for Position & Confirm Submission
    Frontend->>API: POST /votes (Bearer JWT) {election_id, position_id, candidate_id}

    rect rgb(245, 245, 255)
        note right of API: Authentication & Authorization Verification
        API->>API: Decode JWT & Verify Signature
        API->>API: Enforce role == 'student' (Admins Rejected with 403)
        API->>DB: Verify election is 'open' and within scheduled time window
        API->>DB: Verify candidate belongs to position and approval_status == 'approved'
    end

    rect rgb(255, 250, 240)
        note right of API: Double-Voting Prevention & Decoupled Recording
        API->>DB: SELECT * FROM voter_participation WHERE election_id = :e_id AND position_id = :p_id AND student_id = :s_id FOR UPDATE
        alt Already Participated
            API-->>Frontend: 409 Conflict ("You have already voted in this position")
            Frontend-->>Student: Display warning & lock election interface
        else First Time Ballot
            API->>API: Compute SHA-256 Receipt Hash = H(election_id || pos_id || student_id || timestamp || salt)
            API->>DB: INSERT INTO voter_participation (election_id, position_id, student_id, receipt_hash, recorded_at)
            API->>DB: INSERT INTO votes (election_id, position_id, candidate_id, cast_at)
            DB-->>API: Transaction Committed Atomically
            API-->>Frontend: 200 OK {message, receipt_hash, recorded_at}
            Frontend-->>Student: Display Cryptographic Voter Receipt Card & Copy/Download Hash
        end
    end
```

---

## 5. Sequence Diagram 3: Automated Election Clock Lifecycle (APScheduler)

Demonstrates how APScheduler automatically checks election schedules in the background every 30 seconds and transitions statuses into the immutable audit ledger.

```mermaid
sequenceDiagram
    autonumber
    participant Scheduler as APScheduler Background Engine
    participant Clock as check_and_transition_election_schedules()
    participant DB as PostgreSQL Database
    participant Audit as AuditLog Table

    loop Every 30 Seconds
        Scheduler->>Clock: Trigger Clock Interval Job
        Clock->>DB: Query draft elections where starts_at <= NOW < ends_at
        alt Draft Election has Positions & Approved Candidates
            Clock->>DB: UPDATE elections SET status = 'open' WHERE id = :id
            Clock->>Audit: INSERT INTO audit_logs (actor='SYSTEM_APSCHEDULER', action='AUTO_OPEN_ELECTION')
        end

        Clock->>DB: Query open elections where ends_at <= NOW
        alt Election Expired
            Clock->>DB: UPDATE elections SET status = 'closed' WHERE id = :id
            Clock->>Audit: INSERT INTO audit_logs (actor='SYSTEM_APSCHEDULER', action='AUTO_CLOSE_ELECTION')
        end
        DB-->>Clock: Transaction Committed
    end
```

---

## 6. State Diagram: Election Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft : Administrator creates election
    
    Draft --> Open : Scheduled start reached (APScheduler) OR Admin activates election
    note right of Draft
        - Positions can be added
        - Candidate nominations received & reviewed
        - No votes can be cast
    end note

    Open --> Closed : Scheduled end time reached (APScheduler) OR Admin closes election
    note right of Open
        - Eligible students cast secret ballots
        - Double-voting prevented via voter_participation
        - SHA-256 cryptographic voter receipts issued
        - Ballots cryptographically decoupled
    end note

    Closed --> [*] : Official tallies certified & audit summaries generated
    note right of Closed
        - Voting permanently halted
        - Results tallies computed
        - Certified CSV & PDF audit reports downloadable
        - Public ballot receipts verifiable
    end note
```
