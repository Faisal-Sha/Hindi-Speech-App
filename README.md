Hindi Voice Assistant 🎤

हिंदी वॉयस असिस्टेंट

A React-based voice assistant application designed for Hindi speakers. Built for my grandmother and anyone who prefers speaking in Hindi over typing.

✨ Features

Continuous Recording: Record long conversations without interruption
Real-time Speech Display: See your words appear in real-time as you speak
Hindi Speech Recognition: Optimized for Hindi language input and output
AI Integration: Send your recorded speech to an AI assistant for responses
Text-to-Speech: Hear AI responses spoken back in Hindi
Conversation History: Keep track of your entire conversation

🚀 Getting Started
Prerequisites

Node.js (version 14 or higher)
A modern web browser that supports Web Speech API (Chrome, Edge, Safari)
Microphone access

### Docker Setup

Run the entire application (frontend, backend, and PostgreSQL database) using Docker.

#### Development environment

1. Copy the backend environment template and update any secrets:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Start all services with live-reload support:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```
3. Visit the app at [http://localhost:3000](http://localhost:3000). The backend API will be exposed on port `3001` and PostgreSQL on `5432`.

#### Production build

1. Provide the required environment variables (for example by exporting them or using a `.env` file next to the compose file).
2. Build and start the containers:
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```
3. The production-ready frontend will be available at [http://localhost:8080](http://localhost:8080) and the backend API remains reachable on port `3001`.

To stop the stack use `docker compose ... down` with the same compose file that was used to start it. The PostgreSQL data will persist in the named Docker volume `postgres-data`.

### Manual setup

Install dependencies
  npm install

Start the frontend
  npm start


Backend Setup
This app requires a backend server to process AI requests. Create a simple Express.js server:

  cd hindi-voice-backend
  npm init -y

Install backend dependencies
  npm install express cors

Start the backend
  node server.js


🎯 How to Use

Grant Microphone Permission: When prompted, allow microphone access
Start Recording: Click the "🎤 Start Recording" button
Speak Naturally: Talk in Hindi - take pauses, think between sentences
Stop Recording: Click "🔴 Stop Recording" when finished
Send to AI: Click "📤 Send to AI" to get a response
Listen to Response: The AI response will be spoken back to you


Made with ❤️ for the Hindi-speaking community.
"Technology should bridge gaps, not create them."
