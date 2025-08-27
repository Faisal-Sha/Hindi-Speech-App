
// frontend/src/components/UserSelector.js - Updated for Family Authentication

import React, { useState, useEffect } from 'react';
import './UserSelector.css';

const UserSelector = ({ onUserSelect, currentUser, familyAccount, authToken }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [error, setError] = useState('');
  const [newProfile, setNewProfile] = useState({
    displayName: '',
    preferredLanguage: 'en-US',
    avatarEmoji: '👤'
  });

  // Language options for user preference selection
  const languageOptions = [
    { code: 'hi-IN', name: 'हिंदी (Hindi)', flag: '🇮🇳' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
    { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  ];

  // Avatar emoji options
  const avatarOptions = [
    '👨‍💼', '👩‍💼', '🧒', '👧', '👦', '👴', '👵', 
    '👨‍🎓', '👩‍🎓', '👨‍💻', '👩‍💻', '👨‍🍳', '👩‍🍳',
    '🧑‍🎨', '👨‍🔬', '👩‍🔬', '🦸‍♂️', '🦸‍♀️', '🧙‍♂️', '🧙‍♀️'
  ];

  // =====================================
  // LOAD PROFILES FROM FAMILY ACCOUNT
  // =====================================
  
  useEffect(() => {
    if (familyAccount && authToken) {
      loadProfiles();
    }
  }, [familyAccount, authToken]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('🔍 Loading profiles for family account...');
      
      // Get profiles using the authenticated endpoint
      const response = await fetch('http://localhost:3001/auth/profiles', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded profiles:', data.profiles);
        setProfiles(data.profiles || []);
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to load profiles:', errorData);
        setError(errorData.message || 'Failed to load profiles');
      }
      
    } catch (error) {
      console.error('❌ Error loading profiles:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // =====================================
  // PROFILE SELECTION
  // =====================================
  
  const handleProfileSelect = async (profile) => {
    try {
      console.log(`👤 Profile selected: ${profile.user_id}`);
      
      // Get full profile data using the authenticated endpoint
      const response = await fetch(`http://localhost:3001/user-profile/${profile.user_id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const fullProfile = await response.json();
        console.log('✅ Full profile loaded:', fullProfile);
        onUserSelect(fullProfile);
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to load profile details:', errorData);
        setError(errorData.message || 'Failed to load profile');
      }
      
    } catch (error) {
      console.error('❌ Error selecting profile:', error);
      setError('Failed to select profile. Please try again.');
    }
  };

  // =====================================
  // ADD NEW PROFILE
  // =====================================
  
  const handleAddProfile = async () => {
    try {
      console.log('➕ Creating new profile:', newProfile);
      
      // Validation
      if (!newProfile.displayName.trim()) {
        setError('Profile name is required');
        return;
      }
      
      if (newProfile.displayName.trim().length < 2) {
        setError('Profile name must be at least 2 characters');
        return;
      }
      
      // Check if account has reached profile limit
      if (profiles.length >= (familyAccount?.maxProfiles || 5)) {
        setError(`You can only have ${familyAccount?.maxProfiles || 5} profiles per account`);
        return;
      }
      
      setLoading(true);
      setError('');
      
      // Create profile using authenticated endpoint
      const response = await fetch('http://localhost:3001/auth/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          displayName: newProfile.displayName.trim(),
          preferredLanguage: newProfile.preferredLanguage,
          avatarEmoji: newProfile.avatarEmoji
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Profile created successfully:', data.profile);
        
        // Reload profiles to show the new one
        await loadProfiles();
        
        // Close the modal and reset form
        setShowAddProfile(false);
        setNewProfile({
          displayName: '',
          preferredLanguage: 'en-US',
          avatarEmoji: '👤'
        });
        
        // Auto-select the new profile
        onUserSelect(data.profile);
        
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to create profile:', errorData);
        setError(errorData.message || 'Failed to create profile');
      }
      
    } catch (error) {
      console.error('❌ Error creating profile:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setNewProfile(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  // =====================================
  // RENDER
  // =====================================
  
  if (loading && profiles.length === 0) {
    return (
      <div className="user-selector-container">
        <div className="loading-state">
          <div className="loading-spinner">⏳</div>
          <h3>Loading family profiles...</h3>
          <p>Please wait while we load your family's profiles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-selector-container">
      {/* Header */}
      <div className="user-selector-header">
        <h1 className="main-title">👨‍👩‍👧‍👦 Choose Profile</h1>
        <p className="subtitle">Select a family member to continue</p>
        <div className="tagline">
          Welcome to <strong>{familyAccount?.accountName || 'Your Family'}</strong> Assistant
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* Profiles Grid */}
      <div className="users-section">
        {profiles.length > 0 && (
          <div className="users-grid">
            {profiles.map((profile) => (
              <div
                key={profile.user_id}
                onClick={() => handleProfileSelect(profile)}
                className={`user-card ${currentUser?.user_id === profile.user_id ? 'selected' : ''}`}
              >
                <div className="user-avatar-large">{profile.avatar_emoji}</div>
                <div className="user-display-name">{profile.display_name}</div>
                <div className="user-language">
                  {getLanguageFlag(profile.preferred_language)} {getLanguageName(profile.preferred_language)}
                </div>
                <div className="user-stats">
                  📝 {profile.lists_count || 0} lists • 📅 {profile.schedules_count || 0} schedules • 🧠 {profile.memory_count || 0} memories
                </div>
                <div className="user-last-active">
                  Last active: {profile.last_active ? 
                    new Date(profile.last_active).toLocaleDateString() : 'Never'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New Profile Button */}
        <div className="add-user-section">
          {profiles.length < (familyAccount?.maxProfiles || 5) ? (
            <button
              onClick={() => setShowAddProfile(true)}
              className="add-user-btn"
              disabled={loading}
            >
              ➕ Add New Profile
            </button>
          ) : (
            <div className="profile-limit-message">
              <span className="limit-icon">⚠️</span>
              Profile limit reached ({familyAccount?.maxProfiles || 5} max)
            </div>
          )}
        </div>

        {/* Add Profile Modal */}
        {showAddProfile && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="modal-title">Add New Family Profile</h3>
              
              <div className="form-container">
                {/* Display Name */}
                <div className="form-field">
                  <label className="form-label">Profile Name</label>
                  <input
                    type="text"
                    value={newProfile.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    className="form-input"
                    placeholder="e.g., Dad, Mom, Kids, Grandma"
                    maxLength="50"
                  />
                </div>

                {/* Language Preference */}
                <div className="form-field">
                  <label className="form-label">Preferred Language</label>
                  <select
                    value={newProfile.preferredLanguage}
                    onChange={(e) => handleInputChange('preferredLanguage', e.target.value)}
                    className="form-select"
                  >
                    {languageOptions.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Avatar Emoji */}
                <div className="form-field">
                  <label className="form-label">Choose Avatar</label>
                  <div className="avatar-grid">
                    {avatarOptions.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleInputChange('avatarEmoji', emoji)}
                        className={`avatar-option ${newProfile.avatarEmoji === emoji ? 'selected' : ''}`}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="form-buttons">
                  <button 
                    onClick={handleAddProfile} 
                    className="btn-primary"
                    disabled={loading || !newProfile.displayName.trim()}
                  >
                    {loading ? '⏳ Creating...' : 'Create Profile'}
                  </button>
                  <button 
                    onClick={() => {
                      setShowAddProfile(false);
                      setError('');
                      setNewProfile({
                        displayName: '',
                        preferredLanguage: 'en-US',
                        avatarEmoji: '👤'
                      });
                    }} 
                    className="btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Profiles State */}
        {profiles.length === 0 && !showAddProfile && !loading && (
          <div className="no-users-state">
            <div className="welcome-emoji">👋</div>
            <h3 className="welcome-title">Welcome, {familyAccount?.accountName}!</h3>
            <p className="welcome-description">
              Let's create your first family profile. Each profile will have its own lists, 
              schedules, memory, and language preferences.
            </p>
            <button
              onClick={() => setShowAddProfile(true)}
              className="add-user-btn primary"
            >
              ➕ Create First Profile
            </button>
          </div>
        )}
      </div>
    </div>
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

export default UserSelector;