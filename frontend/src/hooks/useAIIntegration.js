import { useState } from 'react';

const useAIIntegration = (accumulatedText, userResponse, currentMode, language) => {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  // Backend API base URL
  const API_BASE = process.env.REACT_APP_API_URL;
  const userId = 'default'; // In a real app, this would come from authentication

  // Text-to-speech function
  const speakText = (text) => {
    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Handle speech events
      utterance.onstart = () => console.log('🔊 Started speaking');
      utterance.onend = () => console.log('🔇 Finished speaking');
      utterance.onerror = (e) => console.error('🔇 Speech error:', e);
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('❌ Speech synthesis error:', error);
    }
  };

  const sendToAI = async (contextData) => {
    // Get the final text from speech or manual input
    const finalText = accumulatedText.trim() || userResponse.trim();
    
    if (finalText === "") {
      console.log('⚠️ No text to send to AI');
      return [];
    }

    // Create user message object
    const userMessage = {
      type: "user", 
      text: finalText,
      timestamp: new Date(),
      mode: currentMode
    };

    // Add user message to chat immediately
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      console.log('🤖 Sending to AI:', {
        message: finalText,
        mode: currentMode,
        language: language,
        contextSize: Object.keys(contextData?.lists || {}).length + 
                    Object.keys(contextData?.schedules || {}).length + 
                    Object.keys(contextData?.memory || {}).length
      });

      // Prepare request data for backend
      const requestData = {
        message: finalText,
        mode: currentMode,
        context: {
          ...contextData,
          language: language
        },
        language: language,
        userId: userId
      };

      // Send to your backend AI endpoint
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }, 
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ AI Response received:', {
        responseLength: data.response?.length || 0,
        actionsCount: data.actions?.length || 0
      });

      // Create AI message object
      const aiMessage = {
        type: "ai",
        text: data.response || "I'm here to help! Could you please try again?",
        timestamp: new Date(),
        mode: currentMode,
        actions: data.actions || []
      };

      // Add AI response to chat
      setMessages(prev => [...prev, aiMessage]);

      // Speak the AI response (unless user is in a different language that doesn't support TTS)
      try {
        speakText(data.response);
      } catch (speechError) {
        console.log('⚠️ Speech synthesis not available or failed:', speechError);
      }

      // Return actions for the parent component to handle
      return data.actions || [];
      
    } catch (error) {
      console.error('❌ AI Integration Error:', error);
      setError(error.message);
      
      // Create error message
      const errorMessage = {
        type: "ai",
        text: `Sorry, I'm having trouble connecting right now. Please check if the backend server is running on ${API_BASE}. Error: ${error.message}`,
        timestamp: new Date(),
        mode: currentMode,
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Clear messages function (useful for testing)
  const clearMessages = () => {
    setMessages([]);
    setError(null);
  };

  // Retry last message function
  const retryLastMessage = async (contextData) => {
    const lastUserMessage = messages.filter(m => m.type === 'user').pop();
    if (lastUserMessage) {
      // Temporarily set the user response to retry
      return await sendToAI(contextData);
    }
  };

  return {
    isLoading,
    messages,
    error,
    sendToAI,
    clearMessages,
    retryLastMessage,
    speakText
  };
};

export default useAIIntegration;