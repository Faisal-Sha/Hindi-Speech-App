import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Import only the essential components
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import ContentDisplay from './components/ContentDisplay';
import VoiceControls from './components/VoiceControls';

// Import enhanced hooks
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useAIIntegration from './hooks/useAIIntegration';
import useDataManagement from './hooks/useDataManagement';

function App() {
  // ===== CORE STATE =====
  const [currentMode, setCurrentMode] = useState('chat');
  const [language, setLanguage] = useState('hi-IN');
  const [backendStatus, setBackendStatus] = useState('checking');

  // ===== CUSTOM HOOKS - Enhanced Logic =====
  const {
    isRecording,
    userResponse,
    accumulatedText,
    speechError,
    startRecording,
    stopRecording,
    clearText
  } = useSpeechRecognition(language);

  const {
    messages,
    isAILoading,
    aiError,
    sendToAI,
    clearMessages
  } = useAIIntegration(accumulatedText, userResponse, currentMode, language, backendStatus);

  const {
    userLists,
    userSchedules,
    userMemory,
    handleAiActions,
    isDataLoading
  } = useDataManagement();

  // ===== BACKEND HEALTH CHECK =====
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

  // ===== HANDLERS =====
  const handleSendToAI = async () => {
    if (!userResponse.trim() && !accumulatedText.trim()) {
      console.log('⚠️ No speech input to send');
      return;
    }

    if (backendStatus !== 'connected') {
      console.log('⚠️ Backend not connected, attempting to reconnect...');
      await checkBackendHealth();
      if (backendStatus !== 'connected') {
        alert('❌ Backend server is not available. Please start the server on localhost:3001');
        return;
      }
    }

    // Send to AI and handle actions
    const actions = await sendToAI();
    
    if (actions && actions.length > 0) {
      handleAiActions(actions);
    }
    
    // Clear text after successful send
    clearText();
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    console.log('🌍 Language changed to:', newLanguage);
  };

  const handleModeChange = (newMode) => {
    setCurrentMode(newMode);
    console.log('🔄 Mode changed to:', newMode);
  };

  // ===== RENDER =====
  return (
    <div className="app">
      {/* Backend Connection Alert */}
      {backendStatus === 'disconnected' && (
        <div className="alert alert-error">
          ❌ Backend server not connected. Please start the server on localhost:3001
          <button onClick={checkBackendHealth} className="retry-btn">
            Retry Connection
          </button>
        </div>
      )}
      {backendStatus === 'checking' && (
          <div className="alert alert-info">
            🔍 Checking backend connection...
          </div>
      )}

      {/* Main App Layout */}
      <Header 
        language={language}
        onLanguageChange={handleLanguageChange}
        currentMode={currentMode}
        onModeChange={handleModeChange}
      />

      <StatusBar 
        isRecording={isRecording}
        isAILoading={isAILoading}
        backendStatus={backendStatus}
        currentMode={currentMode}
        language={language}
        speechError={speechError}
        aiError={aiError}
        accumulatedText={accumulatedText}
        userResponse={userResponse}
      />

      <ContentDisplay 
        currentMode={currentMode}
        messages={messages}
        userLists={userLists}
        userSchedules={userSchedules}
        userMemory={userMemory}
        isDataLoading={isDataLoading}
      />

      <VoiceControls 
        isRecording={isRecording}
        isAILoading={isAILoading}
        backendStatus={backendStatus}
        hasInput={!!(userResponse.trim() || accumulatedText.trim())}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onSendToAI={handleSendToAI}
        onClearMessages={clearMessages}
        onCheckBackend={checkBackendHealth}
      />

      {/* Debug Panel (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-panel">
          <div><strong>🐛 Debug Info:</strong></div>
          <div>Backend: {backendStatus}</div>
          <div>Mode: {currentMode}</div>
          <div>Recording: {isRecording ? 'Yes' : 'No'}</div>
          <div>AI Loading: {isAILoading ? 'Yes' : 'No'}</div>
          <div>Messages: {messages.length}</div>
          <div>Lists: {Object.keys(userLists).length}</div>
          <div>Schedules: {Object.keys(userSchedules).length}</div>
          <div>Memory: {Object.keys(userMemory).length}</div>
          <div>Speech: {accumulatedText.length} chars</div>
        </div>
      )}
    </div>
  );
}

export default App;
