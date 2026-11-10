"""
SmartVote: User Role Promotion Utility
Allows promoting a user to 'admin' role in the PostgreSQL database.
"""

import sys
from sqlalchemy import select
from database import SessionLocal
from models import User


def promote_user(email: str | None = None):
    print("=== SmartVote: Promote Account to Administrator ===")

    if not email:
        email = input("Enter user email to promote to admin: ").strip().lower()
    else:
        email = email.strip().lower()

    if not email:
        print("Error: Email cannot be empty.")
        return False

    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == email))

        if not user:
            print(f"Error: No account found with email '{email}'.")
            return False

        if user.role == "admin":
            print(f"Notice: '{email}' is already an administrator.")
            return True

        old_role = user.role
        user.role = "admin"
        db.commit()

        print(f"\nSuccess! '{email}' ({user.full_name}) promoted from '{old_role}' to 'admin'.")
        print("You can now sign in at http://localhost:3000/login with full administrative access.")
        return True

    except Exception as e:
        db.rollback()
        print(f"Failed to promote user: {e}")
        return False

    finally:
        db.close()


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    promote_user(target)

