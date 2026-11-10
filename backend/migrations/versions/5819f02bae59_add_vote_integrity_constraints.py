
"""add vote integrity constraints

Revision ID: 5819f02bae59
Revises: 1eb233d98195
"""

from typing import Sequence, Union

from alembic import op


revision: str = "5819f02bae59"
down_revision: Union[str, Sequence[str], None] = "1eb233d98195"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure referenced column combinations are unique.
    op.create_unique_constraint(
        "uq_candidates_id_position",
        "candidates",
        ["id", "position_id"],
    )
    op.create_unique_constraint(
        "uq_positions_id_election",
        "positions",
        ["id", "election_id"],
    )

    # A vote's position must belong to its election.
    op.create_foreign_key(
        "fk_vote_position_election",
        "votes",
        "positions",
        ["position_id", "election_id"],
        ["id", "election_id"],
        ondelete="CASCADE",
    )

    # A vote's candidate must belong to that position.
    op.create_foreign_key(
        "fk_vote_candidate_position",
        "votes",
        "candidates",
        ["candidate_id", "position_id"],
        ["id", "position_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_vote_candidate_position",
        "votes",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_vote_position_election",
        "votes",
        type_="foreignkey",
    )
    op.drop_constraint(
        "uq_positions_id_election",
        "positions",
        type_="unique",
    )
    op.drop_constraint(
        "uq_candidates_id_position",
        "candidates",
        type_="unique",
    )
