"""Initial monitoring schema, frozen for reproducible PostgreSQL migrations.

Revision ID: 0002_monitoring
Revises: 0001_foundation
"""

from alembic import op

revision = "0002_monitoring"
down_revision = "0001_foundation"
branch_labels = None
depends_on = None
DDL = [
    """
CREATE TABLE monitor_gaps (
	id VARCHAR(36) NOT NULL,
	started_at TIMESTAMP WITH TIME ZONE NOT NULL,
	ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
	reason VARCHAR(100) NOT NULL,
	PRIMARY KEY (id)
)

""",
    """CREATE INDEX ix_monitor_gaps_started_at ON monitor_gaps (started_at)""",
    """
CREATE TABLE service_state (
	key VARCHAR(100) NOT NULL,
	value TEXT NOT NULL,
	PRIMARY KEY (key)
)

""",
    """
CREATE TABLE users (
	id VARCHAR(36) NOT NULL,
	email VARCHAR(254) NOT NULL,
	password_hash TEXT NOT NULL,
	demo BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (email)
)

""",
    """
CREATE TABLE sites (
	id VARCHAR(36) NOT NULL,
	owner_id VARCHAR(36) NOT NULL,
	name VARCHAR(60) NOT NULL,
	url TEXT NOT NULL,
	slug VARCHAR(80) NOT NULL,
	site_key VARCHAR(64) NOT NULL,
	interval_s INTEGER NOT NULL,
	status VARCHAR(20) NOT NULL,
	last_checked_at TIMESTAMP WITH TIME ZONE,
	next_check_at TIMESTAMP WITH TIME ZONE NOT NULL,
	failures INTEGER NOT NULL,
	successes INTEGER NOT NULL,
	public_status BOOLEAN NOT NULL,
	"group" VARCHAR(40) NOT NULL,
	tags JSON NOT NULL,
	assertions JSON NOT NULL,
	events_date VARCHAR(10) NOT NULL,
	events_today INTEGER NOT NULL,
	demo BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE,
	UNIQUE (slug),
	UNIQUE (site_key)
)

""",
    """CREATE INDEX ix_sites_next_check_at ON sites (next_check_at)""",
    """CREATE INDEX ix_sites_owner_id ON sites (owner_id)""",
    """
CREATE TABLE alert_channels (
	id VARCHAR(36) NOT NULL,
	site_id VARCHAR(36) NOT NULL,
	type VARCHAR(20) NOT NULL,
	target TEXT NOT NULL,
	enabled BOOLEAN NOT NULL,
	cooldown_s INTEGER NOT NULL,
	last_sent TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
)

""",
    """CREATE INDEX ix_alert_channels_site_id ON alert_channels (site_id)""",
    """
CREATE TABLE checks (
	id VARCHAR(36) NOT NULL,
	site_id VARCHAR(36) NOT NULL,
	ts TIMESTAMP WITH TIME ZONE NOT NULL,
	ok BOOLEAN NOT NULL,
	status_code INTEGER,
	dns_ms FLOAT NOT NULL,
	tcp_ms FLOAT NOT NULL,
	tls_ms FLOAT NOT NULL,
	ttfb_ms FLOAT NOT NULL,
	total_ms FLOAT NOT NULL,
	bytes INTEGER NOT NULL,
	redirects INTEGER NOT NULL,
	error_type VARCHAR(60),
	tls_days_left INTEGER,
	maintenance BOOLEAN NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
)

""",
    """CREATE INDEX ix_checks_site_ts ON checks (site_id, ts)""",
    """
CREATE TABLE deployments (
	id VARCHAR(36) NOT NULL,
	site_id VARCHAR(36) NOT NULL,
	ts TIMESTAMP WITH TIME ZONE NOT NULL,
	version VARCHAR(100) NOT NULL,
	notes VARCHAR(1000) NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
)

""",
    """CREATE INDEX ix_deployments_site_ts ON deployments (site_id, ts)""",
    """
CREATE TABLE incidents (
	id VARCHAR(36) NOT NULL,
	site_id VARCHAR(36) NOT NULL,
	started_at TIMESTAMP WITH TIME ZONE NOT NULL,
	resolved_at TIMESTAMP WITH TIME ZONE,
	cause VARCHAR(100) NOT NULL,
	peak_latency_ms FLOAT NOT NULL,
	notes TEXT NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
)

""",
    """CREATE INDEX ix_incidents_site_ts ON incidents (site_id, started_at)""",
    """
CREATE TABLE maintenance_windows (
	id VARCHAR(36) NOT NULL,
	site_id VARCHAR(36) NOT NULL,
	title VARCHAR(100) NOT NULL,
	starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
	ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
)

""",
    """CREATE INDEX ix_maintenance_windows_site_id ON maintenance_windows (site_id)""",
    """
CREATE TABLE rollups (
	id VARCHAR(36) NOT NULL,
	site_id VARCHAR(36) NOT NULL,
	bucket TIMESTAMP WITH TIME ZONE NOT NULL,
	resolution VARCHAR(10) NOT NULL,
	data JSON NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
)

""",
    """CREATE UNIQUE INDEX ix_rollup_unique ON rollups (site_id, bucket, resolution)""",
    """
CREATE TABLE rum_events (
	id VARCHAR(36) NOT NULL,
	site_id VARCHAR(36) NOT NULL,
	ts TIMESTAMP WITH TIME ZONE NOT NULL,
	event_type VARCHAR(20) NOT NULL,
	visitor_hash VARCHAR(64) NOT NULL,
	session_hash VARCHAR(64) NOT NULL,
	path VARCHAR(512) NOT NULL,
	referrer_host VARCHAR(253) NOT NULL,
	device VARCHAR(12) NOT NULL,
	tz VARCHAR(80) NOT NULL,
	timings JSON NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
)

""",
    """CREATE INDEX ix_rum_site_ts ON rum_events (site_id, ts)""",
    """
CREATE TABLE site_profiles (
	site_id VARCHAR(36) NOT NULL,
	data JSON NOT NULL,
	fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (site_id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
)

""",
    """
CREATE TABLE alert_log (
	id VARCHAR(36) NOT NULL,
	site_id VARCHAR(36) NOT NULL,
	channel_id VARCHAR(36) NOT NULL,
	group_key VARCHAR(160) NOT NULL,
	ts TIMESTAMP WITH TIME ZONE NOT NULL,
	status VARCHAR(20) NOT NULL,
	attempts INTEGER NOT NULL,
	payload JSON NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE,
	FOREIGN KEY(channel_id) REFERENCES alert_channels (id) ON DELETE CASCADE
)

""",
    """CREATE INDEX ix_alert_log_site_id ON alert_log (site_id)""",
]


def upgrade() -> None:
    """Create the frozen monitoring schema and its indexes."""
    for statement in DDL:
        op.execute(statement)


def downgrade() -> None:
    """Drop site-owned tables before their parents."""
    op.drop_table("alert_log")
    op.drop_table("site_profiles")
    op.drop_table("rum_events")
    op.drop_table("rollups")
    op.drop_table("maintenance_windows")
    op.drop_table("incidents")
    op.drop_table("deployments")
    op.drop_table("checks")
    op.drop_table("alert_channels")
    op.drop_table("sites")
    op.drop_table("users")
    op.drop_table("service_state")
    op.drop_table("monitor_gaps")
