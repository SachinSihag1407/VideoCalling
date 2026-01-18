# Video Consulting Platform

A comprehensive video consulting application featuring a modern React frontend and a robust FastAPI backend. This platform supports real-time video calls via WebRTC, secure authentication, and managing appointments.

## 🚀 Tech Stack

### Frontend
- **Framework:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, Glassmorphism UI
- **Real-time:** WebRTC

### Backend
- **Framework:** FastAPI (Python)
- **Database:** SQLModel (SQLite/SQLAlchemy)
- **Signaling:** WebSockets

---

## 🛠️ Quick Start

### 1. Backend Setup
Navigate to the `backend` directory to start the API server.

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python migrate_db.py
python seed.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*Backend runs on: `http://localhost:8000`*

### 2. Frontend Setup
Open a new terminal and navigate to the `frontend` directory.

```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on: `http://localhost:5173`*

---

## ✨ Features
- **Immersive Dashboard:** Glassmorphism design with real-time stats.
- **Video Calls:** Peer-to-peer video interviews with WebSocket signaling.
- **Authentication:** Secure JWT-based login and registration.
- **Appointment Management:** Schedule and track consultations.

## 📂 Project Structure
- `/backend` - FastAPI server, database models, and API endpoints.
- `/frontend` - React application, UI components, and pages.
