// frontend/src/components/Header.js - Updated with Authentication
import React, { useState } from 'react';
import './Header.css';

const Header = ({ 
  currentUser, 
  familyAccount,
  onLogout, 
  onSwitchProfile,
  showStatus, 
  onToggleStatus,
  currentMode,
  onModeChange
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // =====================================
  // PROFILE MENU HANDLERS
  // =====================================
  
  const handleProfileMenuToggle = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleSwitchProfile = () => {
    setShowProfileMenu(false);
    onSwitchProfile();
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    if (window.confirm('Are you sure you want to logout from your family account?')) {
      onLogout();
    }
  };

  // =====================================
  // RENDER
  // =====================================
  
  return (
    <header className="app-header">
      <div className="header-content">
        
        {/* Left Side - Logo and Title */}
        <div className="header-left">
          <div className="app-logo">
            <span className="logo-emoji">🏠</span>
            <div className="logo-text">
              <h1 className="app-title">Family Assistant</h1>
              {familyAccount && (
                <span className="family-name">{familyAccount.accountName}</span>
              )}
            </div>
          </div>
        </div>

        {/* Center - Mode Navigation and Current User Info */}
        <div className="header-center">
          {/* Mode Navigation */}
          {currentUser && (
            <div className="mode-navigation">
              <button
                onClick={() => onModeChange('chat')}
                className={`mode-btn ${currentMode === 'chat' ? 'active' : ''}`}
                title="Chat mode"
              >
                💬 Chat
              </button>
              <button
                onClick={() => onModeChange('lists')}
                className={`mode-btn ${currentMode === 'lists' ? 'active' : ''}`}
                title="Lists mode"
              >
                📝 Lists
              </button>
              <button
                onClick={() => onModeChange('schedules')}
                className={`mode-btn ${currentMode === 'schedules' ? 'active' : ''}`}
                title="Schedules mode"
              >
                📅 Schedules
              </button>
              <button
                onClick={() => onModeChange('memory')}
                className={`mode-btn ${currentMode === 'memory' ? 'active' : ''}`}
                title="Memory mode"
              >
                🧠 Memory
              </button>
            </div>
          )}
          
          {/* Current User Info */}
          {currentUser && (
            <div className="current-user-info">
              <span className="user-avatar">{currentUser.avatar_emoji}</span>
              <div className="user-details">
                <span className="user-name">{currentUser.display_name}</span>
                <span className="user-lang">
                  {getLanguageFlag(currentUser.preferred_language)} 
                  {getLanguageName(currentUser.preferred_language)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Controls and Menu */}
        <div className="header-right">
          
          {/* Status Toggle */}
          <button 
            onClick={onToggleStatus}
            className={`status-btn ${showStatus ? 'active' : ''}`}
            title="Toggle system status"
          >
            📊
          </button>

          {/* Profile Menu */}
          <div className="profile-menu-container">
            <button 
              onClick={handleProfileMenuToggle}
              className="profile-menu-btn"
              title="Profile and account options"
            >
              {currentUser ? (
                <>
                  <span className="profile-avatar">{currentUser.avatar_emoji}</span>
                  <span className="dropdown-arrow">▼</span>
                </>
              ) : (
                <>
                  <span className="family-icon">👨‍👩‍👧‍👦</span>
                  <span className="dropdown-arrow">▼</span>
                </>
              )}
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <div className="profile-dropdown">
                
                {/* Account Info */}
                <div className="dropdown-section">
                  <div className="account-info">
                    <div className="account-name">
                      🏠 {familyAccount?.accountName || 'Family Account'}
                    </div>
                    <div className="account-email">
                      {familyAccount?.email}
                    </div>
                    <div className="profile-count">
                      {familyAccount?.profileCount || 0} / {familyAccount?.maxProfiles || 5} profiles
                    </div>
                  </div>
                </div>

                {/* Current Profile (if selected) */}
                {currentUser && (
                  <div className="dropdown-section">
                    <div className="current-profile-info">
                      <span className="profile-avatar-large">{currentUser.avatar_emoji}</span>
                      <div className="profile-details">
                        <div className="profile-name">{currentUser.display_name}</div>
                        <div className="profile-lang">
                          {getLanguageFlag(currentUser.preferred_language)} 
                          {getLanguageName(currentUser.preferred_language)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Menu Actions */}
                <div className="dropdown-section">
                  <div className="menu-actions">
                    
                    {currentUser && (
                      <button 
                        onClick={handleSwitchProfile}
                        className="menu-action-btn switch-profile"
                      >
                        <span className="action-icon">🔄</span>
                        Switch Profile
                      </button>
                    )}

                    <button 
                      onClick={() => {
                        setShowProfileMenu(false);
                        // Add profile management functionality later
                        alert('Profile management coming soon!');
                      }}
                      className="menu-action-btn manage-profiles"
                    >
                      <span className="action-icon">⚙️</span>
                      Manage Profiles
                    </button>

                    <div className="menu-divider"></div>

                    <button 
                      onClick={handleLogout}
                      className="menu-action-btn logout"
                    >
                      <span className="action-icon">🚪</span>
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showProfileMenu && (
        <div 
          className="dropdown-overlay" 
          onClick={() => setShowProfileMenu(false)}
        />
      )}
    </header>
  );
};

// =====================================
// HELPER FUNCTIONS
// =====================================

const getLanguageFlag = (languageCode) => {
  const flags = {
    'en-US': '🇺🇸',
    'hi-IN': '🇮🇳',
    'es-ES': '🇪🇸',
    'fr-FR': '🇫🇷',
    'de-DE': '🇩🇪'
  };
  return flags[languageCode] || '🌍';
};

const getLanguageName = (languageCode) => {
  const names = {
    'en-US': 'English',
    'hi-IN': 'हिंदी',
    'es-ES': 'Español',
    'fr-FR': 'Français',
    'de-DE': 'Deutsch'
  };
  return names[languageCode] || 'Unknown';
};

export default Header;