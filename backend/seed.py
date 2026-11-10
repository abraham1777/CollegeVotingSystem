"""
SmartVote PostgreSQL Database Seeder
====================================
Populates the SmartVote database with:
- 5 Academic Departments: MBA, MCA, MCom, MSW, MSc
- Administrator Account (Chief Election Administrator)
- Institutional Student Roster with standard college roll numbers:
  (e.g., 26MCAA01 = 26 year, MCA program, A section, 01 roll number)
- Pre-claimed Student Accounts for live testing
- Departmental Elections across Draft, Open, and Closed statuses
- Standard Contested Positions (President, Vice President, Secretary, etc.)
- Approved Candidates with public manifestos
- Voter Participations & Ballot Audits
"""

import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from database import SessionLocal
from core.security import hash_password
from models import (
    Department,
    User,
    Student,
    EligibleStudent,
    Election,
    Position,
    Candidate,
    Vote,
    VoterParticipation,
    AuditLog,
)


def seed_database():
    db = SessionLocal()
    print("=" * 65)
    print("[*] SmartVote Database Seeder Initializing...")
    print("=" * 65)

    try:
        # 1. Five Core Academic Departments
        print("\n[1/6] Seeding 5 Academic Departments (MBA, MCA, MCom, MSW, MSc)...")
        department_definitions = [
            ("MCA", "Master of Computer Applications (MCA)"),
            ("MBA", "Master of Business Administration (MBA)"),
            ("MCom", "Master of Commerce (MCom)"),
            ("MSW", "Master of Social Work (MSW)"),
            ("MSc", "Master of Science (MSc)"),
        ]

        dept_objs = {}
        for short_name, full_name in department_definitions:
            d = db.scalar(select(Department).where(Department.name == full_name))
            if not d:
                # Also check short name in case it was stored previously
                d = db.scalar(select(Department).where(Department.name == short_name))
            if not d:
                d = Department(name=full_name)
                db.add(d)
                db.flush()
                print(f"  + Added Department: {full_name} (ID: {d.id})")
            else:
                d.name = full_name
                db.flush()
                print(f"  * Existing Department: {full_name} (ID: {d.id})")
            dept_objs[short_name] = d

        # 2. Administrator Account
        print("\n[2/6] Seeding Administrator Account...")
        admin_email = "abraham.admin@test.com"
        admin = db.scalar(select(User).where(User.email == admin_email))
        if not admin:
            admin = User(
                full_name="Chief Election Administrator",
                email=admin_email,
                password_hash=hash_password("AdminPassword123!"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.flush()
            print(f"  + Created Admin: {admin_email} (Pass: AdminPassword123!)")
        else:
            admin.password_hash = hash_password("AdminPassword123!")
            print(f"  * Verified Admin: {admin_email} (Pass: AdminPassword123!)")

        # Also ensure backup admin exists
        backup_admin = db.scalar(select(User).where(User.email == "admin@college.edu"))
        if not backup_admin:
            backup_admin = User(
                full_name="College Election Officer",
                email="admin@college.edu",
                password_hash=hash_password("AdminPassword123!"),
                role="admin",
                is_active=True,
            )
            db.add(backup_admin)
            db.flush()

        # 3. Institutional Student Roster (with 26MCAA01 format)
        print("\n[3/6] Seeding Student Roster with Standard Roll Numbers (26MCAA01 format)...")
        # Format: (college_id, full_name, dept_code, semester, email)
        roster_data = [
            # MCA Department (26MCAAxx)
            ("26MCAA01", "Sreya S", "MCA", 2, "26mcaa01@college.edu"),
            ("26MCAA02", "Rahul Nair", "MCA", 2, "26mcaa02@college.edu"),
            ("26MCAA03", "Arjun Pillai", "MCA", 2, "26mcaa03@college.edu"),
            ("26MCAA04", "Neha Sharma", "MCA", 2, "26mcaa04@college.edu"),
            ("26MCAA05", "Mohammed Farhan", "MCA", 4, "26mcaa05@college.edu"),

            # MBA Department (26MBAAxx)
            ("26MBAA01", "Vikramaditya Rao", "MBA", 2, "26mbaa01@college.edu"),
            ("26MBAA02", "Pooja Menon", "MBA", 2, "26mbaa02@college.edu"),
            ("26MBAA03", "Karthik Varma", "MBA", 2, "26mbaa03@college.edu"),
            ("26MBAA04", "Sneha Thomas", "MBA", 2, "26mbaa04@college.edu"),
            ("26MBAA05", "Rohan Roy", "MBA", 4, "26mbaa05@college.edu"),

            # MCom Department (26MCOMAxx)
            ("26MCOMA01", "Ananya Sen", "MCom", 2, "26mcoma01@college.edu"),
            ("26MCOMA02", "David George", "MCom", 2, "26mcoma02@college.edu"),
            ("26MCOMA03", "Divya Jose", "MCom", 2, "26mcoma03@college.edu"),
            ("26MCOMA04", "Akash Nair", "MCom", 2, "26mcoma04@college.edu"),

            # MSW Department (26MSWAxx)
            ("26MSWA01", "Meera Krishnan", "MSW", 2, "26mswa01@college.edu"),
            ("26MSWA02", "Abhishek Kumar", "MSW", 2, "26mswa02@college.edu"),
            ("26MSWA03", "Lakshmi Priya", "MSW", 2, "26mswa03@college.edu"),
            ("26MSWA04", "Kevin Paul", "MSW", 4, "26mswa04@college.edu"),

            # MSc Department (26MSCAxx)
            ("26MSCA01", "Aditi Deshmukh", "MSc", 2, "26msca01@college.edu"),
            ("26MSCA02", "Harish Balan", "MSc", 2, "26msca02@college.edu"),
            ("26MSCA03", "Ritu Raj", "MSc", 2, "26msca03@college.edu"),
            ("26MSCA04", "Sanjay Menon", "MSc", 4, "26msca04@college.edu"),
        ]

        eligible_map = {}
        for cid, name, dept_code, sem, _ in roster_data:
            dept_id = dept_objs[dept_code].id
            es = db.scalar(select(EligibleStudent).where(EligibleStudent.college_id == cid))
            if not es:
                es = EligibleStudent(
                    college_id=cid,
                    full_name=name,
                    department_id=dept_id,
                    semester=sem,
                )
                db.add(es)
                db.flush()
                print(f"  + Added Roster: {cid} - {name} ({dept_code})")
            else:
                es.full_name = name
                es.department_id = dept_id
                es.semester = sem
                db.flush()
            eligible_map[cid] = es

        # 4. Student Accounts (Claiming Roster Entries)
        print("\n[4/6] Registering Student Accounts & Linking Roster Claims...")
        student_objs = {}
        for cid, name, dept_code, sem, email in roster_data:
            es = eligible_map[cid]
            u = db.scalar(select(User).where(User.email == email))

            if not u:
                u = User(
                    full_name=name,
                    email=email,
                    password_hash=hash_password("Password1234!"),
                    role="student",
                    is_active=True,
                )
                db.add(u)
                db.flush()

                s = Student(
                    user_id=u.id,
                    student_number=cid,
                    department_id=es.department_id,
                    semester=sem,
                )
                db.add(s)
                db.flush()

                es.claimed_by_user_id = u.id
                es.claimed_at = datetime.now(timezone.utc)
                print(f"  + Created Account: {email} / Roll: {cid} (Student ID: {s.id})")
            else:
                s = db.scalar(select(Student).where(Student.user_id == u.id))
                u.password_hash = hash_password("Password1234!")
                if not s:
                    s = Student(
                        user_id=u.id,
                        student_number=cid,
                        department_id=es.department_id,
                        semester=sem,
                    )
                    db.add(s)
                    db.flush()
                else:
                    s.student_number = cid
                    s.department_id = es.department_id
                es.claimed_by_user_id = u.id
                es.claimed_at = datetime.now(timezone.utc)

            student_objs[cid] = s

        # Also support legacy alias logins (sreya@test.com, rahul@test.com) for convenience
        legacy_aliases = [
            ("sreya@test.com", "26MCAA01", "Sreya S"),
            ("rahul@test.com", "26MCAA02", "Rahul Nair"),
            ("ananya@test.com", "26MCOMA01", "Ananya Sen"),
            ("meera@test.com", "26MSWA01", "Meera Krishnan"),
        ]
        for leg_email, cid, leg_name in legacy_aliases:
            lu = db.scalar(select(User).where(User.email == leg_email))
            if not lu:
                lu = User(
                    full_name=leg_name,
                    email=leg_email,
                    password_hash=hash_password("Password1234!"),
                    role="student",
                    is_active=True,
                )
                db.add(lu)
                db.flush()
                # Create student profile pointing to the same department
                ls = Student(
                    user_id=lu.id,
                    student_number=f"{cid}-ALIAS",
                    department_id=dept_objs[cid[2:5] if cid[2:5] in dept_objs else cid[2:6]].id,
                    semester=2,
                )
                db.add(ls)
                db.flush()
                print(f"  + Configured legacy convenience login: {leg_email}")

        # 5. Departmental Elections & Standard Positions
        print("\n[5/6] Seeding Departmental Elections & Standard Position Ballots...")
        now = datetime.now(timezone.utc)

        # 5A. Election 1: MCA Department Student Council 2026 (OPEN for voting)
        el_mca = db.scalar(
            select(Election).where(Election.title == "MCA Department Student Association Elections 2026")
        )
        if not el_mca:
            el_mca = Election(
                title="MCA Department Student Association Elections 2026",
                description="Official election for MCA student council executive leadership, technical symposium coordinators, and laboratory committees.",
                status="open",
                starts_at=now - timedelta(hours=4),
                ends_at=now + timedelta(days=4),
            )
            db.add(el_mca)
            db.flush()
            print(f"  + Created Live Election: #{el_mca.id} - {el_mca.title}")
        else:
            el_mca.status = "open"
            el_mca.starts_at = now - timedelta(hours=4)
            el_mca.ends_at = now + timedelta(days=4)

        # Standard Positions for MCA Election: President & Vice President
        pos_mca_pres = db.scalar(
            select(Position).where(Position.election_id == el_mca.id, Position.title == "President")
        )
        if not pos_mca_pres:
            pos_mca_pres = Position(election_id=el_mca.id, title="President")
            db.add(pos_mca_pres)
            db.flush()

        pos_mca_vp = db.scalar(
            select(Position).where(Position.election_id == el_mca.id, Position.title == "Vice President")
        )
        if not pos_mca_vp:
            pos_mca_vp = Position(election_id=el_mca.id, title="Vice President")
            db.add(pos_mca_vp)
            db.flush()

        # Candidates for MCA President: Sreya (26MCAA01) vs Rahul (26MCAA02)
        cand_sreya = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_mca_pres.id, Candidate.student_id == student_objs["26MCAA01"].id)
        )
        if not cand_sreya:
            cand_sreya = Candidate(
                student_id=student_objs["26MCAA01"].id,
                position_id=pos_mca_pres.id,
                manifesto="Championing 24/7 AI computing lab access, nationwide hackathon sponsorship, and peer-to-peer coding bootcamps.",
                approval_status="approved",
            )
            db.add(cand_sreya)

        cand_rahul = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_mca_pres.id, Candidate.student_id == student_objs["26MCAA02"].id)
        )
        if not cand_rahul:
            cand_rahul = Candidate(
                student_id=student_objs["26MCAA02"].id,
                position_id=pos_mca_pres.id,
                manifesto="Establishing cloud architecture certification sponsorships, software industry alumni mentorship, and tech symposium funding.",
                approval_status="approved",
            )
            db.add(cand_rahul)

        # Candidates for MCA Vice President: Arjun (26MCAA03) vs Neha (26MCAA04)
        cand_arjun = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_mca_vp.id, Candidate.student_id == student_objs["26MCAA03"].id)
        )
        if not cand_arjun:
            cand_arjun = Candidate(
                student_id=student_objs["26MCAA03"].id,
                position_id=pos_mca_vp.id,
                manifesto="Expanding campus open-source development clubs, internship fast-track drives, and departmental sports meets.",
                approval_status="approved",
            )
            db.add(cand_arjun)

        cand_neha = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_mca_vp.id, Candidate.student_id == student_objs["26MCAA04"].id)
        )
        if not cand_neha:
            cand_neha = Candidate(
                student_id=student_objs["26MCAA04"].id,
                position_id=pos_mca_vp.id,
                manifesto="Fostering inclusive women-in-tech workshops, mental health and academic counseling, and campus green tech initiatives.",
                approval_status="approved",
            )
            db.add(cand_neha)

        # 5B. Election 2: MBA Leadership Council 2026 (OPEN for voting)
        el_mba = db.scalar(
            select(Election).where(Election.title == "MBA Executive Leadership Association 2026")
        )
        if not el_mba:
            el_mba = Election(
                title="MBA Executive Leadership Association 2026",
                description="Electing student chairpersons for Corporate Relations, Startup Incubation, Case Study Competitions, and Alumni Networks.",
                status="open",
                starts_at=now - timedelta(hours=2),
                ends_at=now + timedelta(days=5),
            )
            db.add(el_mba)
            db.flush()
            print(f"  + Created Live Election: #{el_mba.id} - {el_mba.title}")
        else:
            el_mba.status = "open"

        pos_mba_pres = db.scalar(
            select(Position).where(Position.election_id == el_mba.id, Position.title == "President")
        )
        if not pos_mba_pres:
            pos_mba_pres = Position(election_id=el_mba.id, title="President")
            db.add(pos_mba_pres)
            db.flush()

        cand_vikram = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_mba_pres.id, Candidate.student_id == student_objs["26MBAA01"].id)
        )
        if not cand_vikram:
            cand_vikram = Candidate(
                student_id=student_objs["26MBAA01"].id,
                position_id=pos_mba_pres.id,
                manifesto="Driving international case competition grants, executive C-suite speaker series, and angel investor networking dinners.",
                approval_status="approved",
            )
            db.add(cand_vikram)

        cand_pooja = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_mba_pres.id, Candidate.student_id == student_objs["26MBAA02"].id)
        )
        if not cand_pooja:
            cand_pooja = Candidate(
                student_id=student_objs["26MBAA02"].id,
                position_id=pos_mba_pres.id,
                manifesto="Bridging placement agency partnerships, ESG investment symposiums, and student-run venture capital funds.",
                approval_status="approved",
            )
            db.add(cand_pooja)

        # 5C. Election 3: MCom Commerce Forum 2026 (DRAFT for administration)
        el_mcom = db.scalar(
            select(Election).where(Election.title == "MCom Commerce & Finance Forum 2026")
        )
        if not el_mcom:
            el_mcom = Election(
                title="MCom Commerce & Finance Forum 2026",
                description="Nomination and balloting for FinTech club governors, Audit advisory delegates, and Taxation study circle heads.",
                status="draft",
                starts_at=now + timedelta(days=3),
                ends_at=now + timedelta(days=7),
            )
            db.add(el_mcom)
            db.flush()
            print(f"  + Created Draft Election: #{el_mcom.id} - {el_mcom.title}")

        pos_mcom_sec = db.scalar(
            select(Position).where(Position.election_id == el_mcom.id, Position.title == "General Secretary")
        )
        if not pos_mcom_sec:
            pos_mcom_sec = Position(election_id=el_mcom.id, title="General Secretary")
            db.add(pos_mcom_sec)
            db.flush()

        cand_ananya = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_mcom_sec.id, Candidate.student_id == student_objs["26MCOMA01"].id)
        )
        if not cand_ananya:
            cand_ananya = Candidate(
                student_id=student_objs["26MCOMA01"].id,
                position_id=pos_mcom_sec.id,
                manifesto="Financial modeling workshops, subsidized CPA/CFA prep resources, and annual inter-collegiate commerce fests.",
                approval_status="approved",
            )
            db.add(cand_ananya)

        # 5D. Election 4: MSW Social Action & Welfare Council 2026 (DRAFT)
        el_msw = db.scalar(
            select(Election).where(Election.title == "MSW Social Welfare & Community Action Council 2026")
        )
        if not el_msw:
            el_msw = Election(
                title="MSW Social Welfare & Community Action Council 2026",
                description="Elections for Rural Development envoys, Public Health coordinators, and Youth Empowerment field directors.",
                status="draft",
                starts_at=now + timedelta(days=4),
                ends_at=now + timedelta(days=8),
            )
            db.add(el_msw)
            db.flush()
            print(f"  + Created Draft Election: #{el_msw.id} - {el_msw.title}")

        pos_msw_rep = db.scalar(
            select(Position).where(Position.election_id == el_msw.id, Position.title == "Department Student Representative")
        )
        if not pos_msw_rep:
            pos_msw_rep = Position(election_id=el_msw.id, title="Department Student Representative")
            db.add(pos_msw_rep)
            db.flush()

        cand_meera = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_msw_rep.id, Candidate.student_id == student_objs["26MSWA01"].id)
        )
        if not cand_meera:
            cand_meera = Candidate(
                student_id=student_objs["26MSWA01"].id,
                position_id=pos_msw_rep.id,
                manifesto="Fieldwork transport subsidies, community counseling hotlines, and NGO partnership conferences.",
                approval_status="approved",
            )
            db.add(cand_meera)

        # 5E. Election 5: MSc Science & Research Council 2026 (DRAFT)
        el_msc = db.scalar(
            select(Election).where(Election.title == "MSc Science & Technology Research Council 2026")
        )
        if not el_msc:
            el_msc = Election(
                title="MSc Science & Technology Research Council 2026",
                description="Electing leaders for Postgraduate research colloquiums, interdisciplinary journal editorial boards, and science colloquiums.",
                status="draft",
                starts_at=now + timedelta(days=6),
                ends_at=now + timedelta(days=10),
            )
            db.add(el_msc)
            db.flush()
            print(f"  + Created Draft Election: #{el_msc.id} - {el_msc.title}")

        pos_msc_chair = db.scalar(
            select(Position).where(Position.election_id == el_msc.id, Position.title == "President")
        )
        if not pos_msc_chair:
            pos_msc_chair = Position(election_id=el_msc.id, title="President")
            db.add(pos_msc_chair)
            db.flush()

        cand_aditi = db.scalar(
            select(Candidate).where(Candidate.position_id == pos_msc_chair.id, Candidate.student_id == student_objs["26MSCA01"].id)
        )
        if not cand_aditi:
            cand_aditi = Candidate(
                student_id=student_objs["26MSCA01"].id,
                position_id=pos_msc_chair.id,
                manifesto="Peer research paper publication grants, wet-lab consumable subsidies, and international research symposium delegations.",
                approval_status="approved",
            )
            db.add(cand_aditi)

        # 6. Commit Database Transaction
        db.commit()
        print("\n[6/6] Database transaction committed successfully!")
        print("=" * 65)
        print("[SUCCESS] SmartVote Seeding Complete! Ready Credentials:")
        print("  - Admin:        abraham.admin@test.com    / AdminPassword123!")
        print("  - MCA Voter:    26mcaa01@college.edu      / Password1234! (or sreya@test.com)")
        print("  - MCA Voter:    26mcaa02@college.edu      / Password1234! (or rahul@test.com)")
        print("  - MBA Voter:    26mbaa01@college.edu      / Password1234!")
        print("  - MCom Voter:   26mcoma01@college.edu     / Password1234! (or ananya@test.com)")
        print("  - MSW Voter:    26mswa01@college.edu      / Password1234! (or meera@test.com)")
        print("  - MSc Voter:    26msca01@college.edu      / Password1234!")
        print("=" * 65)

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seeding failed with error: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
