
import React, { useState, useEffect } from 'react';
import './UserSelector.css'; // We'll create this separate CSS file

const UserSelector = ({ onUserSelect, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    userId: '',
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

  // Load existing users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading user profiles...');
      
      const response = await fetch('http://localhost:3001/users');
      if (response.ok) {
        const usersData = await response.json();
        console.log('✅ Loaded users:', usersData);
        setUsers(usersData);
      } else {
        console.log('⚠️ No users found, will show add user form');
        setUsers([]);
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (userId) => {
    try {
      console.log(`👤 User selected: ${userId}`);
      
      // Get full user profile
      const response = await fetch(`http://localhost:3001/user-profile/${userId}`);
      if (response.ok) {
        const userProfile = await response.json();
        console.log('✅ User profile loaded:', userProfile);
        onUserSelect(userProfile);
      } else {
        console.error('❌ Failed to load user profile');
      }
    } catch (error) {
      console.error('❌ Error selecting user:', error);
    }
  };

  const handleAddUser = async () => {
    // Validation
    if (!newUser.userId.trim() || !newUser.displayName.trim()) {
      alert('Please fill in both User ID and Display Name');
      return;
    }
    
    try {
      console.log('➕ Creating new user:', newUser);
      
      const response = await fetch('http://localhost:3001/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        const createdUser = await response.json();
        console.log('✅ User created:', createdUser);
        
        // Reload users and select the new one
        await loadUsers();
        setShowAddUser(false);
        setNewUser({ userId: '', displayName: '', preferredLanguage: 'en-US', avatarEmoji: '👤' });
        
        // Auto-select the new user
        handleUserSelect(createdUser.user_id);
      } else {
        const errorData = await response.json();
        alert(`Error creating user: ${errorData.error}`);
      }
    } catch (error) {
      console.error('❌ Error creating user:', error);
      alert('Failed to create user. Please try again.');
    }
  };

  const handleDeleteUser = async (userId, displayName) => {
    if (window.confirm(`Are you sure you want to delete ${displayName}? This will permanently delete all their data.`)) {
      try {
        const response = await fetch(`http://localhost:3001/delete-user/${userId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          console.log(`✅ User ${userId} deleted`);
          loadUsers(); // Reload the user list
        } else {
          const errorData = await response.json();
          alert(`Error deleting user: ${errorData.error}`);
        }
      } catch (error) {
        console.error('❌ Error deleting user:', error);
        alert('Failed to delete user. Please try again.');
      }
    }
  };

  if (loading) {
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
          <h1 className="main-title">🤖 Personal AI Assistant</h1>
          <h2 className="subtitle">व्यक्तिगत एआई सहायक</h2>
          <p className="tagline">Who's using the assistant today?</p>
        </div>

        {/* User Profiles Grid */}
        {users.length > 0 && (
          <div className="users-grid">
            {users.map((user) => (
              <div
                key={user.user_id}
                className="user-card"
                onClick={() => handleUserSelect(user.user_id)}
              >
                {/* Delete button */}
                <button
                  className="delete-user-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteUser(user.user_id, user.display_name);
                  }}
                >
                  ×
                </button>

                {/* Avatar */}
                <div className="user-avatar-section">
                  <div className="user-avatar-large">{user.avatar_emoji}</div>
                  <h3 className="user-display-name">{user.display_name}</h3>
                  <div className="user-language-info">
                    <span className="language-flag">
                      {languageOptions.find(lang => lang.code === user.preferred_language)?.flag || '🌐'}
                    </span>
                    <span className="language-name">
                      {languageOptions.find(lang => lang.code === user.preferred_language)?.name.split('(')[0].trim() || user.preferred_language}
                    </span>
                  </div>
                </div>

                {/* User Stats */}
                <div className="user-stats">
                  <div className="stat-item">📝 {user.data_summary?.lists_count || 0} Lists</div>
                  <div className="stat-item">📅 {user.data_summary?.schedules_count || 0} Schedules</div>
                  <div className="stat-item">🧠 {user.data_summary?.memory_count || 0} Memory Items</div>
                </div>

                {/* Last Active */}
                <div className="last-active">
                  Last active: {user.last_active ? new Date(user.last_active).toLocaleDateString() : 'Never'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New User Button */}
        <div className="add-user-section">
          <button
            onClick={() => setShowAddUser(true)}
            className="add-user-btn"
          >
            ➕ Add New User
          </button>
        </div>

        {/* Add User Modal */}
        {showAddUser && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="modal-title">Create New User</h3>
              
              <div className="form-container">
                {/* User ID */}
                <div className="form-field">
                  <label className="form-label">User ID (unique identifier)</label>
                  <input
                    type="text"
                    value={newUser.userId}
                    onChange={(e) => setNewUser({...newUser, userId: e.target.value})}
                    className="form-input"
                    placeholder="e.g., john_doe"
                  />
                </div>

                {/* Display Name */}
                <div className="form-field">
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                    className="form-input"
                    placeholder="e.g., John Doe"
                  />
                </div>

                {/* Language Preference */}
                <div className="form-field">
                  <label className="form-label">Preferred Language</label>
                  <select
                    value={newUser.preferredLanguage}
                    onChange={(e) => setNewUser({...newUser, preferredLanguage: e.target.value})}
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
                        onClick={() => setNewUser({...newUser, avatarEmoji: emoji})}
                        className={`avatar-option ${newUser.avatarEmoji === emoji ? 'selected' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="form-buttons">
                  <button onClick={handleAddUser} className="btn-primary">
                    Create User
                  </button>
                  <button onClick={() => setShowAddUser(false)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Users State */}
        {users.length === 0 && !showAddUser && (
          <div className="no-users-state">
            <div className="welcome-emoji">👋</div>
            <h3 className="welcome-title">Welcome! Let's create your first user profile.</h3>
            <p className="welcome-description">
              Each user will have their own lists, schedules, memory, and language preferences.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSelector;