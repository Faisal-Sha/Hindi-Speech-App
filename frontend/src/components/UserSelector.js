import React, { useState, useEffect } from 'react';
import './UserSelector.css';

const UserSelector = ({ onUserSelect, currentUser, familyAccount, authToken }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [error, setError] = useState('');
  const [newProfile, setNewProfile] = useState({
    displayName: '',
    preferredLanguage: 'en-US',
    avatarEmoji: '👤'
  });

  // Language options
  const languageOptions = [
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'hi-IN', name: 'हिंदी (Hindi)', flag: '🇮🇳' },
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

  // Load profiles from family account
  useEffect(() => {
    loadProfiles();
  }, [familyAccount]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading profiles from family account...');
      
      const response = await fetch('http://localhost:3001/auth/account', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded profiles:', data.account.profiles);
        setProfiles(data.account.profiles || []);
      } else {
        console.log('⚠️ Failed to load profiles');
        setProfiles([]);
      }
    } catch (error) {
      console.error('❌ Error loading profiles:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelect = async (profile) => {
    try {
      console.log(`👤 Profile selected: ${profile.user_id}`);
      
      // Get full user profile with data counts
      const response = await fetch(`http://localhost:3001/user-profile/${profile.user_id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const userProfile = await response.json();
        console.log('✅ User profile loaded:', userProfile);
        onUserSelect(userProfile);
      } else {
        console.error('❌ Failed to load user profile');
        // Fallback to the basic profile data
        onUserSelect(profile);
      }
    } catch (error) {
      console.error('❌ Error selecting profile:', error);
      // Fallback to the basic profile data
      onUserSelect(profile);
    }
  };

  const handleCreateProfile = async () => {
    try {
      if (!newProfile.displayName.trim()) {
        setError('Profile name is required');
        return;
      }

      if (newProfile.displayName.trim().length < 2) {
        setError('Profile name must be at least 2 characters');
        return;
      }

      if (profiles.length >= (familyAccount?.maxProfiles || 5)) {
        setError(`You can only have ${familyAccount?.maxProfiles || 5} profiles per account`);
        return;
      }

      setLoading(true);
      setError('');

      console.log('⏱️ Creating new profile:', newProfile);

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
        
        // Reload profiles
        await loadProfiles();
        
        // Reset form and close modal
        setShowAddProfile(false);
        setNewProfile({
          displayName: '',
          preferredLanguage: 'en-US',
          avatarEmoji: '👤'
        });
        
        // Auto-select the new profile
        handleProfileSelect(data.profile);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to create profile');
      }
    } catch (error) {
      console.error('❌ Error creating profile:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && profiles.length === 0) {
    return (
      <div className="user-selector-container">
        <div className="loading-screen">
          <div className="loading-spinner">⏳</div>
          <h2 className="loading-text">Loading Profiles...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="user-selector-container">
      <div className="user-selector-content">
        
        {/* Header */}
        <div className="user-selector-header">
          <h1 className="main-title">👨‍👩‍👧‍👦 Choose Profile</h1>
          <p className="tagline">Select a family member to continue</p>
          {familyAccount && (
            <p className="family-name">Welcome to {familyAccount.accountName}</p>
          )}
        </div>

        {/* Profiles Grid */}
        {profiles.length > 0 && (
          <div className="users-grid">
            {profiles.map((profile) => (
              <div
                key={profile.user_id}
                className="user-card"
                onClick={() => handleProfileSelect(profile)}
              >
                {/* Avatar */}
                <div className="user-avatar-section">
                  <div className="user-avatar-large">{profile.avatar_emoji || '👤'}</div>
                  <h3 className="user-display-name">{profile.display_name}</h3>
                  <div className="user-language-info">
                    <span className="language-flag">
                      {languageOptions.find(lang => lang.code === profile.preferred_language)?.flag || '🌐'}
                    </span>
                    <span className="language-name">
                      {languageOptions.find(lang => lang.code === profile.preferred_language)?.name.split('(')[0].trim() || profile.preferred_language}
                    </span>
                  </div>
                </div>

                {/* Last Active */}
                <div className="last-active">
                  Last active: {profile.last_active ? new Date(profile.last_active).toLocaleDateString() : 'Never'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New Profile Button */}
        {profiles.length < (familyAccount?.maxProfiles || 5) && (
          <div className="add-user-section">
            <button
              onClick={() => setShowAddProfile(true)}
              className="add-user-btn"
            >
              ➕ Add New Profile
            </button>
          </div>
        )}

        {/* Add Profile Modal */}
        {showAddProfile && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="modal-title">Create New Profile</h3>
              
              <div className="form-container">
                {/* Display Name */}
                <div className="form-field">
                  <label className="form-label">Profile Name</label>
                  <input
                    type="text"
                    value={newProfile.displayName}
                    onChange={(e) => setNewProfile({...newProfile, displayName: e.target.value})}
                    className="form-input"
                    placeholder="e.g., John, Mom, Dad"
                  />
                </div>

                {/* Language Preference */}
                <div className="form-field">
                  <label className="form-label">Preferred Language</label>
                  <select
                    value={newProfile.preferredLanguage}
                    onChange={(e) => setNewProfile({...newProfile, preferredLanguage: e.target.value})}
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
                        type="button"
                        onClick={() => setNewProfile({...newProfile, avatarEmoji: emoji})}
                        className={`avatar-option ${newProfile.avatarEmoji === emoji ? 'selected' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="error-message">⚠️ {error}</div>
                )}

                {/* Buttons */}
                <div className="form-buttons">
                  <button 
                    onClick={handleCreateProfile} 
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
              Let's create your first family profile. Each profile will have its own lists, schedules, memory, and language preferences.
            </p>
            <button onClick={() => setShowAddProfile(true)} className="add-user-btn primary">
              ➕ Create First Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSelector;