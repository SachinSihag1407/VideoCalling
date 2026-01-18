# Video Consulting Platform - Backend

A robust FastAPI backend serving a video consulting application with real-time WebRTC signaling, appointment management, and secure authentication.

## 🚀 Built With
- **Framework:** FastAPI (Python)
- **Database:** SQLModel (SQLite managed via SQLAlchemy)
- **Real-time:** WebSockets (for WebRTC signaling)
- **Auth:** OAuth2 with JWT tokens

## 🛠️ Setup & Running

### 1. Environment Setup
Navigate to the backend directory and set up your Python environment:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Database Initialization
Initialize the database and (optionally) seed it with test data:

```bash
# Create tables
python migrate_db.py

# Add test users and appointments
python seed.py
```

### 3. Start the Server
Run the FastAPI development server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **API Root:** `http://localhost:8000`
- **Interactive Docs:** `http://localhost:8000/docs`
- **WebSocket Endpoint:** `ws://localhost:8000/ws`

## Key Features
- **User Authentication:** Login/Register with JWT.
- **Appointment Scheduling:** Book and manage consultation slots.
- **Video Signaling:** WebSocket-based signaling server for P2P connections.
- **Medical Records:** Consent forms and simple storage logic.
