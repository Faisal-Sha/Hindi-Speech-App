import React, { useState, useEffect } from 'react';
import './App.css';
import appService from './services/AppService';

// Import your existing components
import Header from './components/Header';
import UserSelector from './components/UserSelector';
import AuthScreen from './components/AuthScreen';
import ContentDisplay from './components/ContentDisplay';
import useDataManagement from './hooks/useDataManagement';
import { supabase } from './services/supabaseClient';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import appService from './services/AppService';

function App() {

  // =====================================
  // AUTHENTICATION STATE
  // =====================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [familyAccount, setFamilyAccount] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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
  } = useDataManagement(messages, authToken);

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

  // =====================================
  // AUTHENTICATION FUNCTIONS
  // =====================================
  
  // Check if user is already logged in when app loads
  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      console.log('🔍 Checking for existing authentication...');

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log('❌ No active session');
        setIsCheckingAuth(false);
        return;
      }

      const token = session.access_token;

      // Verify token with backend
      const response = await fetch(appService.auth.account, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Existing authentication valid:', data.account);

        // Restore authentication state
        setAuthToken(token);
        setFamilyAccount(data.account);
        setIsAuthenticated(true);

        // If they only have one profile, auto-select it
        if (data.account.profiles && data.account.profiles.length === 1) {
          handleUserSelect(data.account.profiles[0]);
        }

      } else {
        console.log('❌ Session token is invalid');
      }

    } catch (error) {
      console.error('❌ Error checking authentication:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Handle successful authentication (login or signup)
  const handleAuthSuccess = (account, token) => {
    console.log('✅ Authentication successful:', account);

    setAuthToken(token);
    setFamilyAccount(account);
    setIsAuthenticated(true);
    
    // If they only have one profile, auto-select it
    if (account.profiles && account.profiles.length === 1) {
      handleUserSelect(account.profiles[0]);
    } else {
      setIsSelectingUser(true);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out...');
      // Sign out of Supabase
      await supabase.auth.signOut();

      // Clear local state
      setAuthToken(null);
      setFamilyAccount(null);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setIsSelectingUser(true);
      setMessages([]);

      console.log('✅ Logged out successfully');

    } catch (error) {
      console.error('❌ Error during logout:', error);
      setAuthToken(null);
      setFamilyAccount(null);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setIsSelectingUser(true);
    }
  };


  // =====================================
  // LIST ITEM INTERACTION HANDLERS
  // =====================================
  
  /**
   * Handle updates to list items (complete, uncomplete, delete)
   * This function will be passed to ContentDisplay component
   */
  const handleUpdateListItem = async (action) => {
    if (!currentUser) {
      console.error('❌ No user selected');
      return;
    }
  
    try {
      console.log('🔄 Handling list item update:', action);
      await handleAiActions([action], currentUser.user_id);
      console.log('✅ List item updated successfully');
      console.log('💾 About to call saveDataChanges...');
      await saveDataChanges([action]);
      console.log('✅ saveDataChanges call completed');
      
      
    } catch (error) {
      console.error('❌ Error updating list item:', error);
    }
  };


  const handleDeleteList = async (action) => {
    if (!currentUser) {
      console.error('❌ No user selected');
      return;
    }
  
    try {
      console.log('🗑️ Handling list deletion:', action);
      
      // Process the action through AI actions handler
      await handleAiActions([action], currentUser.user_id);
      
      // Also call the backend API directly for immediate effect
      await saveDataChanges([action]);
      
      console.log('✅ List deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting list:', error);
      // You might want to show a user-friendly error message here
    }
  };
  
  /**
   * Handle deleting entire schedules
   */
  const handleDeleteSchedule = async (action) => {
    if (!currentUser) {
      console.error('❌ No user selected');
      return;
    }
  
    try {
      console.log('🗑️ Handling schedule deletion:', action);
      
      // Process the action through AI actions handler
      await handleAiActions([action], currentUser.user_id);
      
      // Also call the backend API directly for immediate effect
      await saveDataChanges([action]);
      
      console.log('✅ Schedule deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting schedule:', error);
    }
  };
  
  /**
   * Handle deleting individual events
   */
  const handleDeleteEvent = async (action) => {
    if (!currentUser) {
      console.error('❌ No user selected');
      return;
    }
  
    try {
      console.log('🗑️ Handling event deletion:', action);
      
      // Process the action through AI actions handler
      await handleAiActions([action], currentUser.user_id);
      
      // Also call the backend API directly for immediate effect
      await saveDataChanges([action]);
      
      console.log('✅ Event deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting event:', error);
    }
  };
  
  /**
   * Handle editing individual events
   */
  const handleEditEvent = async (action) => {
    if (!currentUser) {
      console.error('❌ No user selected');
      return;
    }
  
    try {
      console.log('📝 Handling event edit:', action);
      
      // Process the action through AI actions handler
      await handleAiActions([action], currentUser.user_id);
      
      // Also call the backend API directly for immediate effect
      await saveDataChanges([action]);
      
      console.log('✅ Event edited successfully');
      
    } catch (error) {
      console.error('❌ Error editing event:', error);
    }
  };

  /**
 * Handle memory item updates (edit)
 */
const handleUpdateMemoryItem = async (action) => {
  if (!currentUser) {
    console.error('❌ No user selected');
    return;
  }

  try {
    console.log('📝 Handling memory item update:', action);
    await handleAiActions([action], currentUser.user_id);
    console.log('✅ Memory item updated successfully');
    await saveDataChanges([action]);
    
  } catch (error) {
    console.error('❌ Error updating memory item:', error);
  }
};

/**
 * Handle memory item deletion
 */
const handleDeleteMemoryItem = async (action) => {
  if (!currentUser) {
    console.error('❌ No user selected');
    return;
  }

  try {
    console.log('🗑️ Handling memory item deletion:', action);
    await handleAiActions([action], currentUser.user_id);
    console.log('✅ Memory item deleted successfully');
    await saveDataChanges([action]);
    
  } catch (error) {
    console.error('❌ Error deleting memory item:', error);
  }
};

/**
 * Handle memory category deletion
 */
const handleDeleteMemory = async (action) => {
  if (!currentUser) {
    console.error('❌ No user selected');
    return;
  }

  try {
    console.log('🗑️ Handling memory category deletion:', action);
    await handleAiActions([action], currentUser.user_id);
    console.log('✅ Memory category deleted successfully');
    await saveDataChanges([action]);
    
  } catch (error) {
    console.error('❌ Error deleting memory category:', error);
  }
};
  /**
 * Update local state for list items
 * This mimics the update_list logic from useDataManagement
 */

  // =====================================
  // UPDATED DATA MANAGEMENT WITH AUTH
  // =====================================
  
  // Update your existing data management functions to include auth token
  const authenticatedFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      ...options.headers
    };
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      console.error('❌ Authentication error, logging out');
      handleLogout();
      throw new Error('Authentication failed');
    }
    
    return response;
  };

  // =====================================
  // LOADING STATE
  // =====================================
  
  if (isCheckingAuth) {
    return (
      <div className="loading-screen">
        <div className="loading-container">
          <div className="loading-spinner">⏳</div>
          <h2>Loading Family Assistant...</h2>
          <p>Checking your authentication status</p>
        </div>
      </div>
    );
  }

  // =====================================
  // RENDER AUTHENTICATION FLOW
  // =====================================
  
  // Show authentication screen if not logged in
  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // Show profile selector if logged in but no profile selected
  if (isSelectingUser) {
    return (
      <div className="app">
        <Header 
          language={currentLanguage}
          onLanguageChange={() => {}}
          currentMode={currentMode}
          onModeChange={setCurrentMode}
          currentUser={null}  // No user selected yet
          onSwitchUser={handleSwitchUser}
          familyAccount={familyAccount}  // ADD THIS
          onLogout={handleLogout}  // ADD THIS
          showModeNavigation={false}  // ADD THIS - hide mode buttons on profile page
        />
        <UserSelector 
          onUserSelect={handleUserSelect}
          currentUser={currentUser}
          familyAccount={familyAccount}
          authToken={authToken}
        />
      </div>
    );
  }

  
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
      const response = await fetch(appService.chat, {
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
      
      actions.forEach((action, index) => {
        console.log(`📋 [DEBUG] Action ${index + 1}:`, {
          type: action.type,
          data: action.data,
          dataType: typeof action.data,
          dataKeys: action.data ? Object.keys(action.data) : 'no data'
        });
      });

      
      const response = await fetch(appService.data.saveEnhanced, {
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
        
        // FIXED: Safe handling of failed actions to prevent "malformed array literal" error
        if (result.failed && result.failed > 0) {
          console.warn(`⚠️ ${result.failed} actions failed`);
          
          // SAFE: Check if results exist and has failed items before filtering
          if (result.results && Array.isArray(result.results)) {
            const failedActions = result.results.filter(r => !r.success);
            
            // SAFE: Log each failed action separately to avoid array literal issues
            failedActions.forEach((failedAction, index) => {
              console.warn(`❌ Failed action ${index + 1}:`, {
                type: failedAction.type || 'unknown',
                error: failedAction.error || 'no error message',
                // Don't include the full action data to avoid circular references
              });
            });
          }
        }
        
        // Reload user data to ensure frontend is in sync with backend
        await loadUserData(currentUser.user_id);
        
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to save data changes. Response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error saving data changes:', error);
      
      // SAFE: Log error details without causing additional errors
      console.error('❌ Error details:', {
        message: error.message,
        name: error.name,
        // Don't log the full error object to avoid circular references
      });
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
    return <UserSelector onUserSelect={handleUserSelect} currentUser={currentUser} familyAccount={familyAccount} authToken={authToken}/>;
  }

  // Main app interface
  return (
    <div className="App">
      {/* Enhanced Header with User Info */}
      <Header 
        language={currentLanguage}
        onLanguageChange={() => {}}
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        familyAccount={familyAccount}  // ADD THIS
        onLogout={handleLogout}  // ADD THIS
        showModeNavigation={true}  // ADD THIS
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

      <ContentDisplay
        currentMode={currentMode}
        messages={messages}
        userLists={userLists}
        userSchedules={userSchedules}
        userMemory={userMemory}
        isDataLoading={isDataLoading}
        onUpdateListItem={handleUpdateListItem}
        onDeleteList={handleDeleteList}           
        onDeleteSchedule={handleDeleteSchedule}   
        onDeleteEvent={handleDeleteEvent}         
        onEditEvent={handleEditEvent}
        onUpdateMemoryItem={handleUpdateMemoryItem}
        onDeleteMemoryItem={handleDeleteMemoryItem}
        onDeleteMemory={handleDeleteMemory}
      />


      

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


        {/* Live Speech Display */}
      {isListening && accumulatedText && (
        <div className="live-speech">
          <strong>🎤 Live Speech Recognition:</strong>
          <div className="speech-text">{accumulatedText}</div>
        </div>
      )}

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
            className={`btn ${isListening ? 'recording' : ''}`}
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
    </div>
  );
}

export default App;