"""
SmartVote: Password Reset Utility
Allows administrators or students to securely reset their password in the PostgreSQL database.
"""

from getpass import getpass
from sqlalchemy import select
from database import SessionLocal
from core.security import hash_password
from models import User


def reset_password(target_email: str | None = None):
    print("=== SmartVote: Password Reset Utility ===")

    if not target_email:
        target_email = input("Enter account email address: ").strip().lower()
    else:
        target_email = target_email.strip().lower()

    if not target_email:
        print("Error: Email address cannot be empty.")
        return False

    db = SessionLocal()

    try:
        user = db.scalar(
            select(User).where(User.email == target_email)
        )

        if not user:
            print(f"Error: No account found with email '{target_email}'.")
            return False

        print(f"Account found: {user.full_name or 'N/A'} (Role: {user.role}, ID: #{user.id})")

        new_password = getpass("Enter new password (minimum 12 characters): ")
        if len(new_password) < 12:
            print("Error: Password must be at least 12 characters long.")
            return False

        confirm_password = getpass("Confirm new password: ")
        if new_password != confirm_password:
            print("Error: Passwords do not match.")
            return False

        user.password_hash = hash_password(new_password)
        db.commit()

        print(f"\nSuccess! Password for '{target_email}' has been reset successfully.")
        print("You can now sign in at http://localhost:3000/login with your new password.")
        return True

    except Exception as error:
        db.rollback()
        print(f"Failed to reset password: {error}")
        return False

    finally:
        db.close()


if __name__ == "__main__":
    import sys
    email_arg = sys.argv[1] if len(sys.argv) > 1 else None
    reset_password(email_arg)

