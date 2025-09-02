// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';

// Import your existing components
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import UserSelector from './components/UserSelector';
import ContentDisplay from './components/ContentDisplay';
import useDataManagement from './hooks/useDataManagement';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import { supabase } from './services/supabaseClient';

function App() {
  // =====================================
  // AUTHENTICATION STATE
  // =====================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [familyAccount, setFamilyAccount] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
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
      const response = await fetch('http://localhost:3001/auth/account', {
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
  // USER MANAGEMENT
  // =====================================
  
  // Load user data when user is selected
  useEffect(() => {
    if (currentUser && currentUser.user_id && authToken) {
      console.log(`👤 User selected: ${currentUser.display_name} (${currentUser.user_id})`);
      console.log(`🌍 User's preferred language: ${currentUser.preferred_language}`);
      
      // Load this user's data
      loadUserDataForProfile(currentUser.user_id);
    }
  }, [currentUser, authToken]);

  const loadUserDataForProfile = async (userId) => {
    try {
      await loadUserData(userId, authToken);   
    } catch (error) {
      console.error('❌ Error loading profile data:', error);
      
      // If authentication error, logout
      if (error.message.includes('401') || error.message.includes('403')) {
        handleLogout();
      }
    }
  };


  const handleUserSelect = (userProfile) => {
    console.log('👤 Profile selected:', userProfile);
    setCurrentUser(userProfile);
    setIsSelectingUser(false);
    
    // Clear any existing data when switching profiles
    setMessages([]);
    
    // Send welcome message in profile's preferred language
    const welcomeMessages = {
      'en-US': `Welcome back, ${userProfile.display_name}! How can I help you today?`,
      'hi-IN': `नमस्ते ${userProfile.display_name}! आज मैं आपकी कैसे मदद कर सकता हूँ?`,
      'es-ES': `¡Bienvenido de nuevo, ${userProfile.display_name}! ¿Cómo puedo ayudarte hoy?`,
      'fr-FR': `Bon retour, ${userProfile.display_name}! Comment puis-je vous aider aujourd'hui?`,
      'de-DE': `Willkommen zurück, ${userProfile.display_name}! Wie kann ich Ihnen heute helfen?`
    };
    
    const welcomeText = welcomeMessages[userProfile.preferred_language] || welcomeMessages['en-US'];
    
    setMessages([{
      type: "assistant",
      text: welcomeText,
      timestamp: new Date(),
      mode: 'chat'
    }]);
  };

  const handleSwitchUser = () => {
    console.log('🔄 Switching profile...');
    setCurrentUser(null);
    setIsSelectingUser(true);
    setMessages([]);
  };


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
          currentUser={null}
          familyAccount={familyAccount}
          onLogout={handleLogout}
          onSwitchProfile={handleSwitchUser}
          showStatus={showStatus}
          onToggleStatus={() => setShowStatus(!showStatus)}
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


  // =====================================
  // AI COMMUNICATION - SIMPLIFIED AI-FIRST APPROACH
  // =====================================
  
  const sendMessage = async (messageText) => {
    if (!currentUser) {
      alert('Please select a user first');
      return;
    }
  
    if (!authToken) {
      console.error('❌ No auth token available');
      alert('Authentication required. Please login again.');
      handleLogout();
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
      console.log(`📤 Sending authenticated message from ${currentUser.display_name}: "${trimmedMessage}"`);
  
      // Prepare context with current data
      const context = {
        lists: userLists,
        schedules: userSchedules,
        memory: userMemory,
        chats: userChats
      };
  
      // 🔑 KEY FIX: Include Authorization header with JWT token
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` // 👈 This was missing!
        },
        body: JSON.stringify({
          message: trimmedMessage,
          mode: currentMode,
          context: context,
          language: currentUser.preferred_language,
          userId: currentUser.user_id
        })
      });
  
      if (!response.ok) {
        // Handle different types of auth errors
        if (response.status === 401 || response.status === 403) {
          console.error('❌ Authentication failed - logging out');
          alert('Your session has expired. Please login again.');
          handleLogout();
          return;
        }
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
  
      // Handle AI actions if any were returned
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        console.log('🔄 Processing AI actions:', aiResponse.actions);
        const actionsProcessed = await handleAiActions(aiResponse.actions, currentUser.user_id, authToken);
        
        if (actionsProcessed) {
          console.log('✅ AI actions completed, data updated');
        }
      }
  
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      const errorMessage = {
        type: 'ai',
        text: `Sorry, I'm having trouble right now. ${error.message.includes('401') || error.message.includes('403') ? 'Please login again.' : 'Please try again in a moment.'}`,
        timestamp: new Date(),
        mode: currentMode,
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // If it's an auth error, logout
      if (error.message.includes('401') || error.message.includes('403')) {
        handleLogout();
      }
      
    } finally {
      setIsAILoading(false);
    }
  };
  

  // =====================================
  // MANUAL UI OPERATIONS (Keep these for direct UI interactions)
  // =====================================
  
  // These handle direct UI actions (like clicking edit/delete buttons)
  // They use handleAiActions for immediate UI updates + backend notification
  
  const handleDeleteList = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual list deletion (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ List deletion successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error deleting list:', error);
    }
  };
  
  const handleUpdateListItem = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('📝 Manual list item update (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ List item update successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error updating list item:', error);
    }
  };
  
  const handleDeleteListItem = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual list item deletion (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ List item deletion successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error deleting list item:', error);
    }
  };

  const handleEditEvent = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('📝 Manual event edit (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Event edit successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error editing event:', error);
    }
  };
  
  const handleDeleteEvent = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual event deletion (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Event deletion successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error deleting event:', error);
    }
  };
  
  const handleDeleteSchedule = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual schedule deletion (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Schedule deletion successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error deleting schedule:', error);
    }
  };

  const handleUpdateMemoryItem = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('📝 Manual memory item update (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Memory item update successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error updating memory item:', error);
    }
  };
  
  const handleDeleteMemoryItem = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual memory item deletion (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Memory item deletion successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error deleting memory item:', error);
    }
  };
  
  const handleDeleteMemory = async (smartAction) => {
    if (!currentUser) return;
    try {
      console.log('🗑️ Manual memory deletion (smart action):', smartAction);
      
      // Send directly to backend using the enhanced endpoint
      const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.user_id,
          actions: [smartAction]
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Memory deletion successful:', result);
        // Reload data to reflect changes
        await loadUserData(currentUser.user_id);
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error deleting memory:', error);
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
  currentUser={currentUser}
  familyAccount={familyAccount}
  onLogout={handleLogout}
  onSwitchProfile={handleSwitchUser}
  showStatus={showStatus}
  onToggleStatus={() => setShowStatus(!showStatus)}
  currentMode={currentMode}
  onModeChange={setCurrentMode}
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
        authenticatedFetch={authenticatedFetch}
        authToken={authToken}
        currentLanguage={currentLanguage}
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