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

Installation

Clone the repository
  git clone <your-repo-url>
  cd hindi-voice-assistant

Install dependencies
  npm install

Start the frontend
  npm start

Set up the backend (see Backend Setup section)

Backend Setup
This app requires a backend server to process AI requests. Create a simple Express.js server:

Create a new directory for backend
  mkdir hindi-voice-backend
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

🛠️ Technical Details
Speech Recognition Features

Continuous Mode: Uses continuous: true to keep listening
Interim Results: Shows real-time transcription with interimResults: true
Auto-restart: Automatically restarts if recognition stops unexpectedly
Error Handling: Gracefully handles network issues and silence detection

Browser Compatibility
BrowserSupportNotesChrome✅ FullRecommended browserEdge✅ FullWorks wellSafari⚠️ LimitedBasic functionalityFirefox❌ NoWeb Speech API not supported
🔧 Configuration
Changing Language Settings
To modify speech recognition language, update these lines in App.js:
javascript// For speech recognition input
recognitionRef.current.lang = "hi-IN"; // Hindi (India)

// For text-to-speech output  
utterance.lang = "hi-IN";
Adjusting Speech Rate
Modify the speech rate for AI responses:
javascriptutterance.rate = 0.8; // Slower: 0.1-1.0, Faster: 1.0-2.0
🐛 Troubleshooting
Common Issues
"Your browser does not support speech recognition"

Use Chrome or Edge browser
Ensure you're on HTTPS (required for microphone access)

Recording stops during pauses

This is fixed in the current version with continuous recording
Ensure you're using the latest code

No AI responses

Check that backend server is running on port 3001
Verify the /chat endpoint is working
Check browser console for errors

Microphone not working

Grant microphone permissions when prompted
Check system microphone settings
Ensure no other apps are using the microphone


Made with ❤️ for the Hindi-speaking community.
"Technology should bridge gaps, not create them."
