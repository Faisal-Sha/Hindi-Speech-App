import './App.css';
import React, { useState, useEffect } from "react";

// Import section components
import Header from './components/Header';
import ModeNavigation from './components/ModeNavigation';
import StatusSection from './components/StatusSection';
import ContentArea from './components/ContentArea';
import Controls from './components/Controls';

// Import custom hooks for logic separation
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useAIIntegration from './hooks/useAIIntegration';
import useDataManagement from './hooks/useDataManagement';

function App() {
  // Core UI state (minimal - most logic moved to hooks)
  const [currentMode, setCurrentMode] = useState('chat');
  const [language, setLanguage] = useState('hi-IN');
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'connected', 'disconnected'

  // Custom hooks handle complex logic cleanly
  const {
    isRecording,
    userResponse, 
    startRecording,
    stopRecording,
    accumulatedText,
    clearText
  } = useSpeechRecognition(language);

  const {
    isLoading: isAILoading,
    sendToAI,
    messages,
    error: aiError,
    clearMessages
  } = useAIIntegration(accumulatedText, userResponse, currentMode, language);

  const {
    userLists,
    userSchedules, 
    userMemory,
    userChats,
    handleAiActions,
    isLoading: isDataLoading,
    loadUserData
  } = useDataManagement(messages);

  // Check backend health on startup
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      console.log('🔍 Checking backend health...');
      const response = await fetch('http://localhost:3001/health');
      
      if (response.ok) {
        const health = await response.json();
        console.log('✅ Backend is healthy:', health);
        setBackendStatus('connected');
      } else {
        throw new Error('Backend responded with error');
      }
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      setBackendStatus('disconnected');
    }
  };

  // Enhanced sendToAI that handles AI actions and provides context
  const handleSendToAI = async () => {
    if (!userResponse.trim() && !accumulatedText.trim()) {
      console.log('⚠️ No speech input to send');
      return;
    }

    if (backendStatus !== 'connected') {
      console.log('⚠️ Backend not connected, attempting to reconnect...');
      await checkBackendHealth();
      if (backendStatus !== 'connected') {
        alert('❌ Backend server is not available. Please make sure it\'s running on http://localhost:3001');
        return;
      }
    }

    try {
      // Prepare context data for AI
      const contextData = {
        lists: userLists,
        schedules: userSchedules,
        memory: userMemory,
        chats: userChats,
        currentMode: currentMode,
        language: language
      };

      console.log('📤 Sending to AI with context:', {
        mode: currentMode,
        listsCount: Object.keys(userLists).length,
        schedulesCount: Object.keys(userSchedules).length,
        memoryCount: Object.keys(userMemory).length
      });

      // Send to AI and get back any actions
      const actions = await sendToAI(contextData);

      clearText();
      
      // Process any actions returned by AI
      if (actions && actions.length > 0) {
        console.log('🎬 Processing AI actions:', actions);
        await handleAiActions(actions);
      }
      
    } catch (error) {
      console.error('❌ Error in handleSendToAI:', error);
    }
  };

  // Handle mode changes
  const handleModeChange = (newMode) => {
    console.log(`🔄 Switching to ${newMode} mode`);
    setCurrentMode(newMode);
  };

  // Handle language changes
  const handleLanguageChange = (newLanguage) => {
    console.log(`🌍 Switching to ${newLanguage} language`);
    setLanguage(newLanguage);
  };

  // Loading state
  const isLoading = isAILoading || isDataLoading;

  return (
    <div className="app">
      {/* Backend Status Indicator */}
      {backendStatus === 'disconnected' && (
        <div style={{
          background: '#ff4444',
          color: 'white',
          padding: '10px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          ⚠️ Backend server disconnected. Please start the server on localhost:3001
          <button 
            onClick={checkBackendHealth}
            style={{ marginLeft: '10px', padding: '5px 10px' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {backendStatus === 'checking' && (
        <div style={{
          background: '#ffa500',
          color: 'white',
          padding: '10px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          🔍 Checking backend connection...
        </div>
      )}

      <Header 
        language={language}
        onLanguageChange={handleLanguageChange}
      />
      
      <ModeNavigation 
        currentMode={currentMode}
        onModeChange={handleModeChange}
      />
      
      <StatusSection 
        isRecording={isRecording}
        userResponse={userResponse}
        currentMode={currentMode}
        backendStatus={backendStatus}
        error={aiError}
      />
      
      <ContentArea 
        currentMode={currentMode}
        messages={messages}
        userLists={userLists}
        userSchedules={userSchedules}
        userMemory={userMemory}
        userChats={userChats}
        isLoading={isDataLoading}
      />
      
      <Controls 
        isRecording={isRecording}
        isLoading={isLoading}
        userResponse={userResponse}
        accumulatedText={accumulatedText}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onSendToAI={handleSendToAI}
        onClearMessages={clearMessages}
        backendStatus={backendStatus}
      />

      {/* Debug Panel (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '12px',
          maxWidth: '300px'
        }}>
          <div><strong>Debug Info:</strong></div>
          <div>Backend: {backendStatus}</div>
          <div>Mode: {currentMode}</div>
          <div>Lists: {Object.keys(userLists).length}</div>
          <div>Schedules: {Object.keys(userSchedules).length}</div>
          <div>Memory: {Object.keys(userMemory).length}</div>
          <div>Messages: {messages.length}</div>
          <div>Recording: {isRecording ? 'Yes' : 'No'}</div>
          <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
}

export default App;