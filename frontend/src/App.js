import React, { useState, useEffect } from 'react';
import './App.css';

// Import your existing components
import Header from './components/Header';
import UserSelector from './components/UserSelector'; // New component
import useDataManagement from './hooks/useDataManagement';
import useSpeechRecognition from './hooks/useSpeechRecognition';

function App() {

  const [currentUser, setCurrentUser] = useState(null);
  const [isSelectingUser, setIsSelectingUser] = useState(true);
  const [currentMode, setCurrentMode] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  
  
  const currentLanguage = currentUser?.preferred_language || 'en-US';
  
  
  const {
    userLists,
    userSchedules,
    userMemory,
    userChats,
    handleAiActions,
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
    
    const welcomeText = welcomeMessages[userProfile.preferred_language] || welcomeMessages['en-US'];
    
    setMessages([{
      type: 'ai',
      text: welcomeText,
      timestamp: new Date(),
      isWelcome: true
    }]);
  };

  const handleSwitchUser = () => {
    setCurrentUser(null);
    setIsSelectingUser(true);
    setMessages([]);
  };

  
  
  const sendMessage = async (messageText) => {
    if (!currentUser) {
      alert('Please select a user first');
      return;
    }

    const trimmedMessage = messageText.trim();
    if (!trimmedMessage) return;

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

      // Prepare context with current data
      const context = {
        lists: userLists,
        schedules: userSchedules,
        memory: userMemory,
        chats: userChats
      };

      // Send to backend with user context
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMessage,
          mode: currentMode,
          context: context,
          language: currentUser.preferred_language,
          userId: currentUser.user_id // Pass the current user ID
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📥 AI Response for ${currentUser.display_name}:`, data);

        
        if (data.actions) {
          console.log('📋 data.actions.length:', data.actions.length);
          console.log('📋 First action (if exists):', data.actions[0]);
        } else {
          console.log('❌ data.actions is falsy');
        }
  
        // Add AI response to conversation
        const aiMessage = {
          type: 'ai',
          text: data.response,
          timestamp: new Date(),
          actions: data.actions || []
        };
  
        setMessages(prev => [...prev, aiMessage]);
  
        // DEBUG: Enhanced action processing check

  
        // Process any actions
        if (data.actions && data.actions.length > 0) {
          console.log(`⚡ Processing ${data.actions.length} actions for user ${currentUser.user_id}`);
          handleAiActions(data.actions);
          
          // Save data changes to backend
          console.log('💾 About to call saveDataChanges...');
          await saveDataChanges(data.actions);
          console.log('✅ saveDataChanges call completed');
        } 
         
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      const errorMessage = {
        type: 'ai',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAILoading(false);
    }
  };

  const saveDataChanges = async (actions) => {
    try {
      if (!currentUser || !actions.length) {
        console.log('⚠️ No user or no actions to save');
        return;
      }
      
      console.log('💾 Saving data changes...');
      console.log('👤 User:', currentUser.user_id);
      console.log('📋 Actions:', actions);
      
      const response = await fetch('http://localhost:3001/save-data-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: actions
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Data save complete: ${result.successful}/${result.processed} actions successful`);
        
        if (result.failed > 0) {
          console.warn(`⚠️ ${result.failed} actions failed:`, result.results.filter(r => !r.success));
        }
        
        // Reload user data to ensure frontend is in sync with backend
        await loadUserData(currentUser.user_id);
        
      } else {
        console.error('❌ Failed to save data changes');
      }
    } catch (error) {
      console.error('❌ Error saving data changes:', error);
    }
  };

  // =====================================
  // INPUT HANDLING
  // =====================================
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText);
    }
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
            <div>Messages: {messages.length}</div>
            <div>Lists: {Object.keys(userLists).length}</div>
            <div>Schedules: {Object.keys(userSchedules).length}</div>
            <div>Memory: {Object.keys(userMemory).length}</div>
            <div>Speech: {accumulatedText.length} chars</div>
          </div>
        )}
      </div>

      {/* Live Speech Display */}
      {isListening && accumulatedText && (
        <div className="live-speech">
          <strong>🎤 Live Speech Recognition:</strong>
          <div className="speech-text">{accumulatedText}</div>
        </div>
      )}

      {/* Messages Container */}
      <div className="content-container">
        <div className="content-title">💬 {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode</div>
        
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Welcome to your AI Assistant!</h3>
            <p>Start a conversation in your preferred language: {currentLanguage}</p>
            <div className="empty-state-hint">
              <small>💡 Try: "Create a shopping list" or "Add meeting to schedule"</small>
            </div>
          </div>
        ) : (
          <div className="messages-container">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.type}-message ${message.isWelcome ? 'welcome' : ''}`}>
                <div className="message-content">
                  <strong>
                    {message.type === 'user' ? `${message.user || currentUser?.display_name}: ` : '🤖 Assistant: '}
                  </strong>
                  {message.text}
                </div>
                
                {message.actions && message.actions.length > 0 && (
                  <div className="message-actions">
                    <small>Actions: {message.actions.map(a => a.type).join(', ')}</small>
                  </div>
                )}
                
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
          <button 
            type="submit" 
            className="send-button"
            disabled={isAILoading || !inputText.trim()}
          >
            {isAILoading ? '⏳' : '📤'}
          </button>
        </form>

        {/* Voice Input Controls */}
        <div className="voice-controls">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`voice-button ${isListening ? 'listening' : ''}`}
            disabled={isAILoading}
          >
            {isListening ? '🔴 Stop' : '🎤 Start'} Voice
          </button>
          
          {accumulatedText && (
            <>
              <button
                onClick={handleSpeechSubmit}
                className="speech-submit-button"
                disabled={isAILoading}
              >
                📤 Send Speech
              </button>
              <button
                onClick={clearText}
                className="clear-speech-button"
              >
                🗑️ Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Data Display Sections */}
      {currentMode === 'lists' && (
        <div className="data-section">
          <h3>📝 Your Lists</h3>
          {Object.keys(userLists).length === 0 ? (
            <div className="empty-state">
              <p>No lists yet. Try saying "Create a shopping list"</p>
            </div>
          ) : (
            <div className="data-items">
              {Object.entries(userLists).map(([listName, list]) => (
                <div key={listName} className="data-item">
                  <h4>{list.name || listName}</h4>
                  <p>{list.items?.length || 0} items</p>
                  <small>Updated: {new Date(list.lastUpdated).toLocaleString()}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentMode === 'schedule' && (
        <div className="data-section">
          <h3>📅 Your Schedules</h3>
          {Object.keys(userSchedules).length === 0 ? (
            <div className="empty-state">
              <p>No schedules yet. Try saying "Add meeting tomorrow"</p>
            </div>
          ) : (
            <div className="data-items">
              {Object.entries(userSchedules).map(([scheduleName, schedule]) => (
                <div key={scheduleName} className="data-item">
                  <h4>{schedule.name || scheduleName}</h4>
                  <p>{schedule.events?.length || 0} events</p>
                  <small>Updated: {new Date(schedule.lastUpdated).toLocaleString()}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentMode === 'memory' && (
        <div className="data-section">
          <h3>🧠 Your Memory</h3>
          {Object.keys(userMemory).length === 0 ? (
            <div className="empty-state">
              <p>No memory items yet. Try saying "Remember my phone number"</p>
            </div>
          ) : (
            <div className="data-items">
              {Object.entries(userMemory).map(([categoryName, category]) => (
                <div key={categoryName} className="data-item">
                  <h4>{category.name || categoryName}</h4>
                  <p>{category.items?.length || 0} items</p>
                  <small>Updated: {new Date(category.lastUpdated).toLocaleString()}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;