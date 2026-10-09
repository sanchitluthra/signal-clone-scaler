# Signal Clone

A real-time messaging application clone featuring a custom UI, WebSocket integration, and a high-performance FastAPI backend.

*(Add your main application screenshot here)*
![Main Chat Interface](./screenshots/main.png)

## 🚀 Features

### Core Features
- **Real-time Messaging**: Instant message delivery via WebSockets.
- **Typing Indicators**: Live typing statuses.
- **Read Receipts**: Sent, Delivered, and Read statuses.
- **Group Chats & DMs**: Supports both 1-on-1 and multi-user groups.
- **Secure Onboarding**: Phone number -> OTP -> Profile setup flow.

### Bonus Features Included
- **Message Reactions**: React to messages with emojis.
- **Replies/Quotes**: Reply directly to specific messages in the chat.
- **Media Attachments**: Send and receive images and files.
- **Disappearing Messages**: Set self-destruct timers for conversations.

*(Add a screenshot showing the bonus features here - e.g., a message with a reaction, an image attachment, and a reply)*
![Bonus Features](./screenshots/features.png)

## 💻 Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Zustand
- **Backend**: Python 3.12, FastAPI, SQLite3 (SQLAlchemy), WebSockets

## 🌐 Live Demo

- **Frontend Application:** [https://signal-clone-scaler-gold.vercel.app/](https://signal-clone-scaler-gold.vercel.app/)
- **Backend API:** [https://signal-clone-scaler-r0pq.onrender.com/api](https://signal-clone-scaler-r0pq.onrender.com/api)

**Demo Login Instructions:**
- **Aarav Mehta:** `+15550000001` (Use this for Browser 1)
- **Rohan Verma:** `+15550000003` (Use this for Browser 2 to test chat)
- **OTP for all accounts:** `123456`

## 🛠️ Local Setup Instructions

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Seed the database with demo users
python -m app.seed

# Start the server
uvicorn app.main:app --reload
```

### 2. Frontend Setup

In a new terminal:
```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:3000`.
