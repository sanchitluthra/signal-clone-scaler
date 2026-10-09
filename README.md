# Signal Clone - Meeting Intelligence Platform

A high-performance, real-time messaging application clone built for the Scaler AI Fullstack Assignment. This project strictly replicates the Signal UI/UX while bringing a custom, powerful backend architecture under the hood.

## 🚀 Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS 3** (Custom Signal-branded Dark Mode)
- **Zustand** (Global state management)
- **Lucide React** (Icons)

### Backend
- **Python 3.12**
- **FastAPI** (High-performance async API)
- **SQLite3 + SQLAlchemy 2.0** (Database & ORM)
- **WebSockets** (Real-time bi-directional events)
- **Pytest** (End-to-End integration testing)

## ✨ Core Features

1. **Pixel-Perfect Signal UI**: A custom-designed, sleek dark mode interface built from scratch without generic UI libraries.
2. **Real-time Messaging**: Instant message delivery via WebSockets.
3. **Typing Indicators**: Real-time "typing..." statuses that automatically expire.
4. **Read Receipts**: Single check (sent), Double check (delivered), Blue double check (read).
5. **Secure Onboarding**: Phone number -> OTP -> Profile setup flow.
6. **Group Chats & DMs**: Supports both one-on-one direct messages and multi-user groups.
7. **Robust Backend**: Comprehensive database schema enforcing data integrity (`ON DELETE CASCADE`), robust error handling, and separation of concerns.

## 🛠️ Setup & Run Instructions

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run the seeding script to populate demo data
python -m app.seed

# Start the FastAPI server
uvicorn app.main:app --reload
```
The backend will be running at `http://localhost:8000`.

### 2. Frontend Setup

In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The frontend will be available at `http://localhost:3000`.

## 🧪 Testing

The backend includes a comprehensive suite of API and WebSocket tests.

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. .venv/bin/pytest
```

## 📱 Using the Demo App

The database is pre-seeded with 8 demo users. You can log in as any of them.

**Demo Login Flow:**
1. Go to `http://localhost:3000`
2. Enter the phone number of a demo user (e.g., `+12345678900` for Alice, `+12345678901` for Bob).
3. The OTP is always `123456`.
4. You will be redirected to the Chat Interface where you can chat in real-time!

## 🎯 Design Decisions

- **Why Zustand?** For a real-time messaging app, Redux is often overkill and Context API can lead to unnecessary re-renders. Zustand provides a fast, sliceable store that is perfect for managing the WebSocket lifecycle and appending messages optimistically.
- **Why FastAPI + WebSockets?** FastAPI's native async support makes handling thousands of concurrent WebSocket connections highly efficient compared to synchronous frameworks.
- **Why Custom UI over Libraries?** To demonstrate strong CSS fundamentals and ensure the UI isn't "just another generic dashboard". The scrollbars, color palettes, and component structures are tailored specifically to match Signal.

---
*Built with ❤️ for Scaler AI*
