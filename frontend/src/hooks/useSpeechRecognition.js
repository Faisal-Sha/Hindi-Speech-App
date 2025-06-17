
import { useState, useRef, useEffect } from 'react';

const useSpeechRecognition = (language) => {
  const [isRecording, setIsRecording] = useState(false);
  const [userResponse, setUserResponse] = useState("");
  const [accumulatedText, setAccumulatedText] = useState("");
  const recognitionRef = useRef(null);
  const isStoppingRef = useRef(false); // NEW: Track if we're intentionally stopping

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.lang = language;
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event) => {
        // FIXED: Only process results if we're actively recording
        if (!isRecording || isStoppingRef.current) {
          console.log('🔇 Ignoring speech results - not recording');
          return;
        }

        let finalTranscript = "";
        let interimTranscript = "";

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
        console.log("🎤 Recognition ended");
        
        // FIXED: Only restart if we're still supposed to be recording AND not intentionally stopping
        if (isRecording && !isStoppingRef.current) {
          console.log("🔄 Restarting recognition...");
          setTimeout(() => {
            if (recognitionRef.current && isRecording && !isStoppingRef.current) {
              try {
                recognitionRef.current.start();
              } catch (error) {
                console.log("❌ Failed to restart:", error);
              }
            }
          }, 100);
        } else {
          console.log("🛑 Recognition properly stopped");
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        
        // FIXED: Don't restart on errors if we're intentionally stopping
        if (event.error === 'no-speech' && isRecording && !isStoppingRef.current) {
          setTimeout(() => {
            if (recognitionRef.current && isRecording && !isStoppingRef.current) {
              recognitionRef.current.start();
            }
          }, 100);
        }
      };

      // FIXED: Stop speech synthesis when starting to record (prevents feedback)
      recognitionRef.current.onstart = () => {
        console.log("🎤 Recognition started");
        // Cancel any ongoing speech synthesis to prevent feedback
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          console.log("🔇 Cancelled AI speech to prevent feedback");
        }
      };
    }
  }, [language, isRecording]);

  const startRecording = () => {
    console.log("🎬 Starting recording...");
    if (recognitionRef.current) {
      // FIXED: Cancel any ongoing AI speech first
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        console.log("🔇 Stopped AI speech before recording");
      }

      setIsRecording(true);
      isStoppingRef.current = false; // Reset the stopping flag
      setUserResponse("");
      setAccumulatedText("");
      
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.log("❌ Error starting recording:", error);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    console.log("🛑 Stopping recording...");
    
    // FIXED: Set flags BEFORE stopping to prevent restart
    setIsRecording(false);
    isStoppingRef.current = true; // Prevent restart
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        
        // FIXED: Set final text after a short delay to ensure we get the last result
        setTimeout(() => {
          const finalText = accumulatedText.trim();
          setUserResponse(finalText);
          console.log(`✅ Final recorded text: "${finalText}"`);
          
          // Reset stopping flag after processing
          setTimeout(() => {
            isStoppingRef.current = false;
          }, 500);
        }, 200);
      } catch (error) {
        console.log("❌ Error stopping recording:", error);
        isStoppingRef.current = false;
      }
    }
  };

  // FIXED: Clear text function for after sending
  const clearText = () => {
    setUserResponse("");
    setAccumulatedText("");
    console.log("🧹 Cleared speech text");
  };

  return {
    isRecording,
    userResponse,
    accumulatedText,
    startRecording,
    stopRecording,
    clearText // NEW: Add this to clear text after sending
  };
};

export default useSpeechRecognition;