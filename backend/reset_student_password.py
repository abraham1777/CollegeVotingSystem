
from getpass import getpass

from sqlalchemy import select

from database import SessionLocal
from core.security import hash_password
from models import User


def main():
    email = "test.student@example.com"
    new_password = getpass("Enter a new password: ")

    if len(new_password) < 12:
        print("Use a password with at least 12 characters.")
        return

    db = SessionLocal()

    try:
        user = db.scalar(
            select(User).where(User.email == email)
        )

        if user is None:
            print("Student account not found.")
            return

        user.password_hash = hash_password(new_password)
        db.commit()

        print("Password reset successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
