# Video Consulting Platform - Frontend

The modern, responsive web interface for the Video Consulting Platform, built with React and Vite. It features a polished glassmorphism design, real-time video capabilities, and intuitive dashboard management.

## 🚀 Built With
- **Core:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, Lucide React (Icons)
- **Routing:** React Router DOM
- **State/Network:** Axios, React Context API

## 🛠️ Setup & Running

### 1. Prerequisites
Ensure you have Node.js 20+ installed. Navigate to the frontend directory:

```bash
cd frontend
```

### 2. Install Dependencies
Install the required packages using npm:

```bash
npm install
```

### 3. Start Development Server
Run the local development server:

```bash
npm run dev
```

- **Local URL:** `http://localhost:5173`
- **Backend Connection:** Proxies API requests to `http://localhost:8000` (ensure backend is running).

## ✨ Key Features

### 🖥️ Immersive Dashboard
- **Glassmorphism UI:** Modern, translucent aesthetic with smooth animations.
- **Stats Overview:** Real-time metrics for upcoming and past interviews.
- **Quick Actions:** Easy access to schedule new sessions.

### 📹 Video Interview Room
- **WebRTC Integration:** Direct peer-to-peer video calling.
- **Real-time Signaling:** WebSocket connection for seamless call setup.
- **Controls:** Mute, camera toggle, and call termination.

### 🔐 Authentication
- **Secure Login/Registration:** JWT-based session management.
- **Protected Routes:** Ensures only authenticated users access sensitive pages.
