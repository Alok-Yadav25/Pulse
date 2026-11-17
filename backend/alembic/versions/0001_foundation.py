"""Foundation revision; feature schemas arrive with their implementation.

Revision ID: 0001_foundation
Revises: None
"""

revision = "0001_foundation"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Establish a revision marker without claiming unbuilt feature tables."""


def downgrade() -> None:
    """No application tables exist in the foundation revision."""
