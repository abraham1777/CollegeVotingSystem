
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Election(Base):
    __tablename__ = "elections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    positions: Mapped[list["Position"]] = relationship(
        back_populates="election",
        cascade="all, delete-orphan",
    )


class Position(Base):
    __tablename__ = "positions"

    __table_args__ = (
        UniqueConstraint(
            "id",
            "election_id",
            name="uq_positions_id_election",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    election_id: Mapped[int] = mapped_column(
        ForeignKey("elections.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)

    election: Mapped["Election"] = relationship(
        back_populates="positions"
    )
    candidates: Mapped[list["Candidate"]] = relationship(
        back_populates="position"
    )


class Candidate(Base):
    __tablename__ = "candidates"

    __table_args__ = (
        UniqueConstraint(
            "id",
            "position_id",
            name="uq_candidates_id_position",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
    )
    position_id: Mapped[int] = mapped_column(
        ForeignKey("positions.id", ondelete="CASCADE"),
        nullable=False,
    )
    manifesto: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    approval_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )

    position: Mapped["Position"] = relationship(
        back_populates="candidates"
    )
