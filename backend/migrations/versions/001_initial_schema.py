"""Initial schema — all 12 entities.

Revision ID: 001
Revises: None
Create Date: 2024-01-01
"""

from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable PostGIS
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # Users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(50), nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Devices
    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("device_serial", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("firmware_version", sa.String(50), nullable=True),
        sa.Column("hardware_version", sa.String(50), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Sensors
    op.create_table(
        "sensors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("sensor_type", sa.String(100), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("serial_number", sa.String(100), nullable=True),
        sa.Column("configuration", postgresql.JSON, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("calibration_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.String, server_default="now()"),
    )

    # Missions
    op.create_table(
        "missions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("operator", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="planned", index=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Deployments
    op.create_table(
        "deployments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("mission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("missions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("deployment_number", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.String(50), nullable=False, server_default="planned", index=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_location", geoalchemy2.Geography("POINT", srid=4326), nullable=True),
        sa.Column("end_location", geoalchemy2.Geography("POINT", srid=4326), nullable=True),
        sa.Column("maximum_depth", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Sensor Readings (high-volume)
    op.create_table(
        "sensor_readings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("deployment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deployments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sequence", sa.Integer, nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("depth", sa.Float, nullable=True),
        sa.Column("magnetometer_x", sa.Float, nullable=True),
        sa.Column("magnetometer_y", sa.Float, nullable=True),
        sa.Column("magnetometer_z", sa.Float, nullable=True),
        sa.Column("magnetic_magnitude", sa.Float, nullable=True),
        sa.Column("magnetic_baseline", sa.Float, nullable=True),
        sa.Column("magnetic_deviation", sa.Float, nullable=True),
        sa.Column("anomaly_score", sa.Float, nullable=True),
        sa.Column("detection_confidence", sa.Float, nullable=True),
        sa.Column("turbidity", sa.Float, nullable=True),
        sa.Column("pressure", sa.Float, nullable=True),
        sa.Column("battery_voltage", sa.Float, nullable=True),
        sa.Column("battery_percent", sa.Float, nullable=True),
        sa.Column("sensor_health", sa.String(50), nullable=True),
        sa.Column("data_quality", sa.Float, nullable=True),
        sa.Column("raw_payload", postgresql.JSON, nullable=True),
    )
    op.create_index("ix_readings_device_ts", "sensor_readings", ["device_id", "timestamp"])
    op.create_index("ix_readings_deployment_ts", "sensor_readings", ["deployment_id", "timestamp"])
    op.create_index("ix_readings_anomaly", "sensor_readings", ["anomaly_score"])
    op.create_index("ix_readings_timestamp", "sensor_readings", ["timestamp"])

    # Survey Points
    op.create_table(
        "survey_points",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("deployment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("depth", sa.Float, nullable=True),
        sa.Column("anomaly_score", sa.Float, nullable=True, index=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("target_status", sa.String(50), nullable=True),
        sa.Column("environmental_context", postgresql.JSON, nullable=True),
        sa.Column("geometry", geoalchemy2.Geography("POINT", srid=4326), nullable=False),
    )
    op.create_index("ix_survey_geom", "survey_points", ["geometry"], postgresql_using="gist")

    # Detection Events
    op.create_table(
        "detection_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("deployment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("end_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", geoalchemy2.Geography("POINT", srid=4326), nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("depth", sa.Float, nullable=True),
        sa.Column("anomaly_score", sa.Float, nullable=False, index=True),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("peak_strength", sa.Float, nullable=True),
        sa.Column("mean_strength", sa.Float, nullable=True),
        sa.Column("duration_seconds", sa.Float, nullable=True),
        sa.Column("sample_count", sa.Integer, nullable=True),
        sa.Column("feature_vector", postgresql.JSON, nullable=True),
        sa.Column("classification", sa.String(100), nullable=True),
        sa.Column("explanation", postgresql.JSON, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="detected"),
    )
    op.create_index("ix_detection_location", "detection_events", ["location"], postgresql_using="gist")

    # Calibration Profiles
    op.create_table(
        "calibration_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("sensor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sensors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("hard_iron_offset_x", sa.Float, nullable=False, server_default="0"),
        sa.Column("hard_iron_offset_y", sa.Float, nullable=False, server_default="0"),
        sa.Column("hard_iron_offset_z", sa.Float, nullable=False, server_default="0"),
        sa.Column("soft_iron_matrix", postgresql.JSON, nullable=True),
        sa.Column("axis_scale_x", sa.Float, nullable=False, server_default="1"),
        sa.Column("axis_scale_y", sa.Float, nullable=False, server_default="1"),
        sa.Column("axis_scale_z", sa.Float, nullable=False, server_default="1"),
        sa.Column("axis_alignment", postgresql.JSON, nullable=True),
        sa.Column("baseline", sa.Float, nullable=True),
        sa.Column("noise_level", sa.Float, nullable=True),
        sa.Column("temperature_compensation", postgresql.JSON, nullable=True),
        sa.Column("calibration_quality", sa.Float, nullable=True),
        sa.Column("calibration_status", sa.String(50), nullable=False, server_default="uncalibrated"),
        sa.Column("sample_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean, nullable=False, server_default="false", index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ML Models
    op.create_table(
        "ml_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("model_type", sa.String(100), nullable=False, index=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("feature_schema", postgresql.JSON, nullable=True),
        sa.Column("feature_version", sa.String(50), nullable=True),
        sa.Column("training_samples", sa.Integer, nullable=True),
        sa.Column("training_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dataset_version", sa.String(100), nullable=True),
        sa.Column("parameters", postgresql.JSON, nullable=True),
        sa.Column("metrics", postgresql.JSON, nullable=True),
        sa.Column("model_hash", sa.String(64), nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="training", index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Predictions
    op.create_table(
        "predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("deployment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deployments.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ml_models.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("anomaly_score", sa.Float, nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("prediction", sa.String(100), nullable=False),
        sa.Column("explanation", postgresql.JSON, nullable=True),
        sa.Column("feature_values", postgresql.JSON, nullable=True),
    )

    # System Logs
    op.create_table(
        "system_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("level", sa.String(20), nullable=False, server_default="INFO", index=True),
        sa.Column("component", sa.String(100), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("metadata", postgresql.JSON, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("system_logs")
    op.drop_table("predictions")
    op.drop_table("ml_models")
    op.drop_table("calibration_profiles")
    op.drop_table("detection_events")
    op.drop_table("survey_points")
    op.drop_table("sensor_readings")
    op.drop_table("deployments")
    op.drop_table("missions")
    op.drop_table("sensors")
    op.drop_table("devices")
    op.drop_table("users")
