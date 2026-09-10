# AquaYantra Backend

Production-quality backend and ML system for the AquaYantra underwater seabed anomaly sensing platform.

## Architecture

```
Sensor → SensorPacket → Processing Pipeline → ML Anomaly Detection → WebSocket + DB
                              ↓
                     Auto-Calibration Engine
                     (hard-iron / soft-iron / adaptive baseline)
```

### Key Design Principles

- **Never claim mineral identification** — the system detects "magnetic anomalies" and "potential targets," not minerals
- **Adaptive but not self-destructive** — the baseline FREEZES during strong anomalies to prevent "learning away" the target
- **Temporal persistence** — a single noisy sample never creates a detection event; sustained anomalies required
- **Model quality gates** — a worse model cannot automatically replace a better active model

## Tech Stack

| Component | Technology |
|-----------|------------|
| API Framework | FastAPI + Uvicorn |
| Database | PostgreSQL 16 + PostGIS |
| ORM | SQLAlchemy 2.x (async) |
| Cache | Redis 7 |
| ML | scikit-learn (Isolation Forest) |
| Auth | JWT (PyJWT + bcrypt) |
| Logging | structlog (JSON) |
| Migrations | Alembic |

## Quick Start

### 1. Docker Compose (Recommended)

```bash
# Start PostgreSQL + Redis + Backend
docker-compose up -d

# Run migrations
docker-compose exec backend alembic upgrade head

# API docs available at http://localhost:8000/docs
```

### 2. Local Development

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy and edit environment config
cp .env.example .env

# Run migrations (requires PostgreSQL + PostGIS running)
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Run Simulator

```bash
# Normal survey (5 minutes)
python -m simulator.client --scenario NORMAL_SURVEY --duration 300

# Strong anomaly
python -m simulator.client --scenario STRONG_ANOMALY --duration 120

# All scenarios: NORMAL_SURVEY, WEAK_ANOMALY, STRONG_ANOMALY,
#   MULTIPLE_TARGETS, SENSOR_DRIFT, HIGH_NOISE, PACKET_LOSS, SENSOR_FAILURE
```

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login, returns JWT |

### Devices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/devices` | List all devices |
| POST | `/api/v1/devices` | Register a device |
| GET | `/api/v1/devices/{id}` | Get device details |
| PATCH | `/api/v1/devices/{id}` | Update device |

### Readings (Ingestion)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/readings` | Ingest single sensor packet |
| POST | `/api/v1/readings/batch` | Ingest batch of packets |
| GET | `/api/v1/readings` | Query readings |

### Missions & Deployments
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/v1/missions` | List/create missions |
| POST | `/api/v1/deployments` | Create deployment |
| GET | `/api/v1/deployments/{id}/readings` | Deployment readings |
| GET | `/api/v1/deployments/{id}/anomalies` | Deployment anomalies |

### Calibration
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/calibration/{device_id}/status` | Live calibration status |
| POST | `/api/v1/calibration/{device_id}/reset` | Reset calibration |

### ML
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ml/models` | List trained models |
| POST | `/api/v1/ml/train` | Initiate training |
| POST | `/api/v1/ml/models/{id}/activate` | Activate a model |

### Map & Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/map/survey-points` | Survey points for mapping |
| GET | `/api/v1/map/anomalies` | Anomaly locations |
| GET | `/api/v1/analytics/summary` | System-wide analytics |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/system/health` | System health check |
| GET | `/` | Root health endpoint |

### WebSocket
| Path | Description |
|------|-------------|
| `ws://host/ws/devices/{device_id}` | Real-time device monitoring |
| `ws://host/ws/deployments/{deployment_id}` | Real-time deployment monitoring |

## Processing Pipeline (11 Stages)

1. **Data Quality** — score 0-1 based on missing data, range violations, packet gaps
2. **Sensor Health** — detect frozen sensors, impossible values, excessive noise
3. **Validation** — verify raw values against sensor ranges
4. **Calibration** — hard-iron offset + soft-iron matrix correction
5. **Filtering** — median filter + EMA + Butterworth low-pass
6. **Magnetic Processing** — magnitude, rolling stats, SNR, gradient
7. **Feature Engineering** — 18-feature versioned vector for ML
8. **ML Anomaly Detection** — Isolation Forest or statistical model
9. **Confidence Scoring** — multi-factor confidence (≠ anomaly score)
10. **Temporal Detection** — FSM requiring sustained anomalies
11. **Explainability** — human-readable detection reasons

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test suites
pytest tests/test_calibration_acceptance.py -v  # 5-phase calibration acceptance
pytest tests/test_ml_safety.py -v               # ML safety guarantees
pytest tests/test_processing.py -v              # Processing pipeline
pytest tests/test_ml.py -v                      # ML models
pytest tests/test_calibration.py -v             # Calibration unit tests
pytest tests/test_simulator.py -v               # Simulator scenarios
```

## Project Structure

```
backend/
├── app/
│   ├── api/v1/          # REST API endpoints
│   ├── calibration/     # Hard-iron, soft-iron, adaptive baseline, drift
│   ├── core/            # Config, security, logging, middleware, exceptions
│   ├── database/        # SQLAlchemy session, Redis, base model
│   ├── ml/              # Isolation Forest, statistical, confidence, temporal, explainability
│   ├── models/          # 12 ORM models
│   ├── processing/      # Magnetic, filters, quality, health, features, pipeline
│   ├── repositories/    # Data access layer
│   ├── schemas/         # Pydantic request/response schemas
│   ├── sensors/         # Sensor adapter framework
│   ├── services/        # Business logic (ingestion, auth)
│   ├── utils/           # Utilities
│   ├── websocket/       # WebSocket connection manager
│   └── main.py          # FastAPI app factory
├── migrations/          # Alembic database migrations
├── simulator/           # Realistic sensor data simulator
├── tests/               # Test suites
├── docker-compose.yml   # Full stack deployment
├── Dockerfile           # Backend container
├── requirements.txt     # Python dependencies
└── pyproject.toml       # Project configuration
```
