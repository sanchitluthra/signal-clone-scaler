# Signal Clone

A real-time messaging application clone featuring a custom UI, WebSocket integration, and a high-performance FastAPI backend.


(<img width="1278" height="789" alt="Screenshot 2026-10-09 at 2 34 25 PM" src="https://github.com/user-attachments/assets/ef2ad7a4-76e0-4c77-92a5-304034899b06" />

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

<img width="1470" height="801" alt="Screenshot 2026-10-09 at 2 33 16 PM" src="https://github.com/user-attachments/assets/a3ae55c9-f2d3-4b4a-b757-3b8534498cf8" />


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

## 📝 Assumptions / Mocked Data / Notes

To help you easily test the application, the following data has been mocked:
1. **Mocked OTP:** Real SMS verification is bypassed. Any valid phone number will accept **`123456`** as the OTP.
2. **Pre-seeded Users:** The database is automatically seeded with dummy users to avoid empty states. We recommend testing by opening two different browsers (or one normal and one incognito window) and logging in with the two numbers provided above.
3. **Database Reset:** The application uses an ephemeral SQLite database on Render. This means the database automatically resets to a clean state upon every new deployment, ensuring a fresh environment for testing.

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
<img width="1462" height="800" alt="Screenshot 2026-10-09 at 2 33 58 PM" src="https://github.com/user-attachments/assets/83ef03e8-120c-440a-9f26-a139a9ebec69" />
<img width="1470" height="801" alt="Screenshot 2026-10-09 at 2 33 40 PM" src="https://github.com/user-attachments/assets/e4869145-aba3-4488-9cf1-d451ad585ff2" />

