import './App.css';
import React, {useState, useRef, useEffect} from "react";


function App() {
  const [isRecording, setIsRecording]  = useState(false);
  const [userResponse, setUserResponse] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const recognitionRef = useRef(null);
  const [accumulatedText, setAccumulatedText] = useState("");

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.lang = "hi-IN"; //Hindi

      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 1;

      //if it hears something
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        //process all results
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        setAccumulatedText(finalTranscript);

        setUserResponse(finalTranscript + interimTranscript);
        
        
      };
        
        recognitionRef.current.onend = () => {
          console.log("🎤 Recognition ended. isRecording:", isRecording);

          if (isRecording) {
            console.log("🔄 Restarting recognition...");
            setTimeout(() => {
              if (recognitionRef.current && isRecording) {
                try {
                  recognitionRef.current.start();
                } catch (error) {
                  console.log("❌ Failed to restart:", error);
                }
              }
            }, 100);
          } else {
            console.log("✅ Not restarting - recording is stopped");
          }
        }

        recognitionRef.current.onerror = (event) => {
          console.log('Speech recognition error:', event.error);
          if (event.error === 'no-speech' && isRecording) {
            setTimeout(() => {
              if (recognitionRef.current && isRecording) {
                recognitionRef.current.start();
              }
            }, 100);
          }
        }

      } else {
        alert("Your browser does not support speech recognition");
      }
    }, []);

  function startRecording() {
    console.log("🎬 Starting recording...");
    if (recognitionRef.current) {
      setIsRecording(true);
      setUserResponse("");
      setAccumulatedText("");

      recognitionRef.current.start();
    }

  }

  function stopRecording() {
    console.log("🛑 Stopping recording...");
    setIsRecording(false);
    if (recognitionRef.current) {
      
      try {
        // FIXED: Use stop() instead of abort(), and DON'T destroy the object
        recognitionRef.current.stop();
        console.log("✅ Recording stopped successfully");
        
        // Set final response after a brief delay to ensure state is updated
        setTimeout(() => {
          setUserResponse(accumulatedText.trim());
        }, 100);
        
      } catch (error) {
        console.log("❌ Error stopping recording:", error);
      }
      
    }

  }

  function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "hi-IN";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }

  async function sendToAi() {
    const finalText = accumulatedText.trim() || userResponse.trim();
    if (finalText === "") return;
    const userMessage = {
      type: "user", 
      text: finalText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:3001/chat", {
        method: 'POST',
        headers:{ 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ message: finalText })
      })
      
      const data = await response.json();
      setAiResponse(data.response);

      const aiMessage = {
        type: "ai",
        text: data.response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage]);

      speakText(data.response);

      
    } catch (error) {
      
      console.log(error);
      alert("Error connecting to AI. Please try again.");
      

    }

    setIsLoading(false);
    setUserResponse("");
    setAccumulatedText("");
  }

  return (
      <div className = "app" >

        {/*Header section*/}
        <div className = "header" >
          <h1>Hindi Voice Assistant</h1>
          <h2>हिंदी वॉयस असिस्टेंट</h2>
          <p>Talk to me in Hindi!</p>
        </div>
        
        {/*Status section*/}
        <div className = "status-section">
          <div className = {`status-item ${isRecording? "recording-active": ""}`}>
            <span className="status-label">Recording Status: </span>
              <span className = "status-value">{isRecording? " 🔴 Recording..." : " ⚪ Ready to listen"}</span>
          </div>

          <div className= "status-item">
            <span className="status-label">You said: </span>
              <span className="status-value">{userResponse || " Nothing yet"} </span>
          </div>

        </div>
        

        {/*chat history*/}
        <div className = "message-container">
          {(messages.length === 0) ? (
            <div className = "no-messages">
              <p>💬 Your conversation will appear here...</p>
              <p>आपकी बातचीत यहाँ दिखाई देगी...</p>
            </div>
            ) : (
            messages.map((msg, index) => (
              <div key = {index} className={`message ${msg.type}`}>
                <div className = "message-sender">
                  {msg.type === "user" ? "👤 You" : "🤖 AI Assistant"}
                </div>
                <div className = "message-text">{msg.text}</div>
              </div>
            )
            )
          )}
        </div>
        
        {/*Control buttons*/}
        <div className = "controls">
          <button className = "btn btn-record" onClick = {isRecording ? stopRecording : startRecording}>
            {isRecording?  "🔴 Stop" : "🎤 Start Recording" }</button>
          <button className = "btn btn-send"onClick = {sendToAi} disabled={userResponse === "" || isLoading}> {isLoading ? "⏳ Sending..." : "📤 Send to AI"}</button>
        </div>

        


        
      </div>



    
  );
}

export default App;
