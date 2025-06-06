# SPDX-License-Identifier: Apache-2.0
"""
Update DynamicFieldsEnum to include all deprecated fields

Revision ID: 24aa37164e72
Revises: ed4cc2ef6b0f
Create Date: 2025-01-14 15:19:26.813044
"""

from alembic import op
from alembic_postgresql_enum import ColumnType, TableReference

revision = "24aa37164e72"
down_revision = "ed4cc2ef6b0f"


def upgrade():
    op.execute(
        "ALTER TYPE public.release_dynamic_fields ADD VALUE IF NOT EXISTS 'Requires'"
    )
    op.execute(
        "ALTER TYPE public.release_dynamic_fields ADD VALUE IF NOT EXISTS 'Provides'"
    )
    op.execute(
        "ALTER TYPE public.release_dynamic_fields ADD VALUE IF NOT EXISTS 'Obsoletes'"
    )


def downgrade():
    op.sync_enum_values(
        enum_schema="public",
        enum_name="release_dynamic_fields",
        new_values=[
            "Platform",
            "Supported-Platform",
            "Summary",
            "Description",
            "Description-Content-Type",
            "Keywords",
            "Home-Page",
            "Download-Url",
            "Author",
            "Author-Email",
            "Maintainer",
            "Maintainer-Email",
            "License",
            "License-Expression",
            "License-File",
            "Classifier",
            "Requires-Dist",
            "Requires-Python",
            "Requires-External",
            "Project-Url",
            "Provides-Extra",
            "Provides-Dist",
            "Obsoletes-Dist",
        ],
        affected_columns=[
            TableReference(
                table_schema="public",
                table_name="releases",
                column_name="dynamic",
                column_type=ColumnType.ARRAY,
            )
        ],
        enum_values_to_rename=[],
    )
