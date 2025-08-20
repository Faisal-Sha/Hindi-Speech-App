// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';

// Import your existing components
import Header from './components/Header';
import UserSelector from './components/UserSelector';
import ContentDisplay from './components/ContentDisplay';
import useDataManagement from './hooks/useDataManagement';
import useSpeechRecognition from './hooks/useSpeechRecognition';

function App() {
  // =====================================
  // STATE MANAGEMENT
  // =====================================
  const [currentUser, setCurrentUser] = useState(null);
  const [isSelectingUser, setIsSelectingUser] = useState(true);
  const [currentMode, setCurrentMode] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  
  const currentLanguage = currentUser?.preferred_language || 'en-US';
  
  // Use your existing hooks
  const {
    userLists,
    userSchedules,
    userMemory,
    userChats,
    handleAiActions, // ✅ Now this exists!
    isLoading: isDataLoading,
    loadUserData
  } = useDataManagement(messages);

  const {
    isRecording: isListening,     
    accumulatedText,             
    startRecording: startListening, 
    stopRecording: stopListening, 
    clearText        
  } = useSpeechRecognition(currentLanguage);

  // =====================================
  // USER MANAGEMENT
  // =====================================
  
  // Load user data when user is selected
  useEffect(() => {
    if (currentUser && currentUser.user_id) {
      console.log(`👤 User selected: ${currentUser.display_name} (${currentUser.user_id})`);
      console.log(`🌍 User's preferred language: ${currentUser.preferred_language}`);
      
      // Load this user's data
      loadUserDataForUser(currentUser.user_id);
    }
  }, [currentUser]);

  const loadUserDataForUser = async (userId) => {
    try {
      await loadUserData(userId);   
    } catch (error) {
      console.error('❌ Error in loadUserDataForUser:', error);
    }
  };

  const handleUserSelect = (userProfile) => {
    console.log('👤 User selected:', userProfile);
    setCurrentUser(userProfile);
    setIsSelectingUser(false);
    
    // Clear any existing data when switching users
    setMessages([]);
    
    // Send welcome message in user's preferred language
    const welcomeMessages = {
      'en-US': `Welcome back, ${userProfile.display_name}! How can I help you today?`,
      'hi-IN': `नमस्ते ${userProfile.display_name}! आज मैं आपकी कैसे मदद कर सकता हूँ?`,
      'es-ES': `¡Bienvenido de nuevo, ${userProfile.display_name}! ¿Cómo puedo ayudarte hoy?`,
      'fr-FR': `Bon retour, ${userProfile.display_name}! Comment puis-je vous aider aujourd'hui?`,
      'de-DE': `Willkommen zurück, ${userProfile.display_name}! Wie kann ich Ihnen heute helfen?`
    };
    
    const welcomeMessage = {
      type: 'ai',
      text: welcomeMessages[userProfile.preferred_language] || welcomeMessages['en-US'],
      timestamp: new Date(),
      isWelcome: true
    };
    
    setMessages([welcomeMessage]);
  };

  const handleSwitchUser = () => {
    setCurrentUser(null);
    setIsSelectingUser(true);
    setMessages([]);
  };

  // =====================================
  // AI COMMUNICATION - SIMPLIFIED AI-FIRST APPROACH
  // =====================================
  
  const sendMessage = async (messageText) => {
    if (!currentUser) {
      alert('Please select a user first');
      return;
    }

    const trimmedMessage = messageText.trim();
    if (!trimmedMessage) return;

    // Clear speech input
    clearText();
    setInputText('');

    // Add user message to conversation
    const userMessage = {
      type: 'user',
      text: trimmedMessage,
      timestamp: new Date(),
      user: currentUser.display_name
    };

    setMessages(prev => [...prev, userMessage]);
    setIsAILoading(true);

    try {
      console.log(`📤 Sending message from ${currentUser.display_name}: "${trimmedMessage}"`);

      // Prepare context with current data (for AI context, not local processing)
      const context = {
        lists: userLists,
        schedules: userSchedules,
        memory: userMemory,
        chats: userChats
      };

      // Send to backend - AI will handle EVERYTHING
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMessage,
          mode: currentMode,
          context: context,
          language: currentUser.preferred_language,
          userId: currentUser.user_id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const aiResponse = await response.json();
      console.log('🤖 AI Response received:', aiResponse);

      // Add AI response to chat
      const aiMessage = {
        type: 'ai',
        text: aiResponse.response || "I'm here to help!",
        timestamp: new Date(),
        mode: currentMode,
        actions: aiResponse.actions || []
      };
      setMessages(prev => [...prev, aiMessage]);

      // 🔑 KEY FIX: Reload data if actions were processed
      if (aiResponse.actionResults && aiResponse.actionResults.length > 0) {
        console.log('🔄 Actions were processed, reloading user data...');
        
        // Wait a moment for backend to complete processing
        setTimeout(async () => {
          await loadUserData(currentUser.user_id);
          console.log('✅ Data refreshed after AI actions');
        }, 500);
      }

      

    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      const errorMessage = {
        type: 'ai',
        text: `Sorry, I'm having trouble right now. Error: ${error.message}`,
        timestamp: new Date(),
        mode: currentMode,
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAILoading(false);
      // Clear input
      clearText();
      setInputText('');
    }
  };

  // =====================================
  // MANUAL UI OPERATIONS (Keep these for direct UI interactions)
  // =====================================
  
  // These handle direct UI actions (like clicking edit/delete buttons)
  // They use handleAiActions for immediate UI updates + backend notification
  
  const handleDeleteList = async (action) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual list deletion:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error deleting list:', error);
    }
  };

  const handleUpdateListItem = async (action) => {
    if (!currentUser) return;
    try {
      console.log('📝 Manual list item update:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error updating list item:', error);
    }
  };

  const handleDeleteListItem = async (action) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual list item deletion:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error deleting list item:', error);
    }
  };

  const handleDeleteSchedule = async (action) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual schedule deletion:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error deleting schedule:', error);
    }
  };

  const handleDeleteEvent = async (action) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual event deletion:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error deleting event:', error);
    }
  };

  const handleEditEvent = async (action) => {
    if (!currentUser) return;
    try {
      console.log('📝 Manual event edit:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error editing event:', error);
    }
  };

  const handleUpdateMemoryItem = async (action) => {
    if (!currentUser) return;
    try {
      console.log('📝 Manual memory item update:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error updating memory item:', error);
    }
  };

  const handleDeleteMemoryItem = async (action) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual memory item deletion:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error deleting memory item:', error);
    }
  };

  const handleDeleteMemory = async (action) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual memory category deletion:', action);
      await handleAiActions([action], currentUser.user_id);
      // Also notify backend for persistence
      await notifyBackendOfAction(action);
    } catch (error) {
      console.error('❌ Error deleting memory category:', error);
    }
  };

  // Helper function to notify backend of manual UI actions
  const notifyBackendOfAction = async (action) => {
    try {
      await fetch('http://localhost:3001/save-data-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [action]
        })
      });
    } catch (error) {
      console.error('❌ Error notifying backend:', error);
    }
  };

  // =====================================
  // INPUT HANDLING
  // =====================================
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isAILoading) return;
    sendMessage(inputText);
  };

  const handleSpeechSubmit = () => {
    if (accumulatedText.trim()) {
      sendMessage(accumulatedText);
    }
  };

  // =====================================
  // RENDER
  // =====================================
  
  // Show user selection if no user is selected
  if (isSelectingUser) {
    return <UserSelector onUserSelect={handleUserSelect} currentUser={currentUser} />;
  }

  // Main app interface
  return (
    <div className="App">
      {/* Enhanced Header with User Info */}
      <Header 
        language={currentLanguage}
        onLanguageChange={() => {}} // Language is now controlled by user profile
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
      />

      {/* User Info Bar */}
      <div className="user-info-bar">
        <div className="user-info-left">
          <span className="user-avatar">{currentUser?.avatar_emoji}</span>
          <span className="user-name">{currentUser?.display_name}</span>
          <span className="user-language">({currentUser?.preferred_language})</span>
        </div>
        <button onClick={handleSwitchUser} className="switch-user-button">
          Switch User
        </button>
      </div>

      {/* Status Display */}
      <div className="status-section">
        <button
          onClick={() => setShowStatus(!showStatus)}
          className="status-toggle"
        >
          📊 {showStatus ? 'Hide' : 'Show'} Status
        </button>
        
        {showStatus && (
          <div className="status-row">
            <div>Listening: {isListening ? 'Yes' : 'No'}</div>
            <div>AI Loading: {isAILoading ? 'Yes' : 'No'}</div>
            <div>Mode: {currentMode}</div>
            <div>Language: {currentLanguage}</div>
            <div>Lists: {Object.keys(userLists).length}</div>
            <div>Schedules: {Object.keys(userSchedules).length}</div>
            <div>Memory: {Object.keys(userMemory).length}</div>
          </div>
        )}
      </div>

      {/* Content Display */}
      <ContentDisplay
        currentMode={currentMode}
        messages={messages}
        userLists={userLists}
        userSchedules={userSchedules}
        userMemory={userMemory}
        isDataLoading={isDataLoading}
        // List action handlers
        onUpdateListItem={handleUpdateListItem}
        onDeleteListItem={handleDeleteListItem}
        onDeleteList={handleDeleteList}
        // Schedule action handlers
        
        onUpdateEvent={handleEditEvent}
        onDeleteEvent={handleDeleteEvent}
        onDeleteSchedule={handleDeleteSchedule}
        // Memory action handlers
        onUpdateMemoryItem={handleUpdateMemoryItem}
        onDeleteMemoryItem={handleDeleteMemoryItem}
        onDeleteMemory={handleDeleteMemory}
      />

      {/* Input Section */}
      <div className="input-section">
        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Type your message in ${currentLanguage}...`}
            className="message-input"
            disabled={isAILoading}
          />
          <button type="submit" disabled={isAILoading || !inputText.trim()}>
            {isAILoading ? '⏳' : '📤'}
          </button>
        </form>

        {/* Speech Controls */}
        <div className="speech-controls">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`speech-button ${isListening ? 'listening' : ''}`}
            disabled={isAILoading}
          >
            {isListening ? '🛑 Stop' : '🎤 Speak'}
          </button>
          
          {accumulatedText && (
            <div className="speech-preview">
              <p>"{accumulatedText}"</p>
              <button onClick={handleSpeechSubmit} disabled={isAILoading}>
                Send Speech
              </button>
              <button onClick={clearText}>Clear</button>
            </div>
          )}
        </div>
      </div>

      {/* Loading States */}
      {isAILoading && (
        <div className="loading-overlay">
          <div className="loading-message">
            🤖 AI is processing your request...
          </div>
        </div>
      )}
    </div>
  );
}

export default App;