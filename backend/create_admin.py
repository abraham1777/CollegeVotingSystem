
from getpass import getpass
from sqlalchemy import select

from database import SessionLocal
from models import User
from core.security import hash_password


def create_admin():
    print("=== SmartVote: Create Administrator ===")

    name = input("Enter administrator name: ").strip()
    email = input("Enter administrator email: ").strip().lower()
    password = getpass("Enter administrator password: ")

    if not name or not email or len(password) < 12:
        print("Invalid input. Password must have at least 12 characters.")
        return

    db = SessionLocal()

    try:
        existing_user = db.scalar(
            select(User).where(User.email == email)
        )

        if existing_user:
            print("An account with this email already exists.")
            return

        admin = User(
            full_name=name,
            email=email,
            password_hash=hash_password(password),
            role="admin",
            is_active=True,
        )

        db.add(admin)
        db.commit()

        print(f"Administrator created successfully: {email}")

    except Exception as error:
        db.rollback()
        print(f"Failed to create administrator: {error}")

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
