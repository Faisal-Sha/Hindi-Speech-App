
import React, { useState } from 'react';
import './AuthScreen.css';

const AuthScreen = ({ onAuthSuccess }) => {
  // =====================================
  // STATE MANAGEMENT
  // =====================================
  const [isLogin, setIsLogin] = useState(true); // true = login, false = signup
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    accountName: '' // Only for signup
  });

  // =====================================
  // FORM HANDLING
  // =====================================
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      console.log(`🔐 Attempting ${isLogin ? 'login' : 'signup'}...`);
      
      // Determine endpoint and payload
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : { email: formData.email, password: formData.password, accountName: formData.accountName };

      // Make API request
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ ${isLogin ? 'Login' : 'Signup'} successful:`, data);
        
        // Store the JWT token in localStorage
        localStorage.setItem('familyAuthToken', data.token);
        
        // Call the success callback with account data
        onAuthSuccess(data.account, data.token);
      } else {
        console.error(`❌ ${isLogin ? 'Login' : 'Signup'} failed:`, data);
        setError(data.message || `${isLogin ? 'Login' : 'Signup'} failed`);
      }

    } catch (error) {
      console.error(`❌ ${isLogin ? 'Login' : 'Signup'} error:`, error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({
      email: '',
      password: '',
      accountName: ''
    });
  };

  // =====================================
  // VALIDATION HELPERS
  // =====================================
  
  const isFormValid = () => {
    if (!formData.email || !formData.password) return false;
    if (!isLogin && !formData.accountName) return false;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return false;
    
    // Password length check
    if (formData.password.length < 8) return false;
    
    return true;
  };

  // =====================================
  // RENDER
  // =====================================
  
  return (
    <div className="auth-screen">
      <div className="auth-container">
        {/* Header */}
        <div className="auth-header">
          <h1 className="auth-title">
            🏠 Family Assistant
          </h1>
          <p className="auth-subtitle">
            AI-powered personal assistant for your whole family
          </p>
        </div>

        {/* Auth Form */}
        <div className="auth-form-container">
          <div className="auth-toggle">
            <button 
              className={`toggle-btn ${isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(true)}
              type="button"
            >
              Login
            </button>
            <button 
              className={`toggle-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(false)}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Account Name (Signup only) */}
            {!isLogin && (
              <div className="form-field">
                <label htmlFor="accountName" className="form-label">
                  Family/Account Name
                </label>
                <input
                  type="text"
                  id="accountName"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g., Smith Family, Johnson Household"
                  required={!isLogin}
                />
                <small className="form-hint">
                  This will be the name for your family account
                </small>
              </div>
            )}

            {/* Email */}
            <div className="form-field">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="form-input"
                placeholder="your@email.com"
                required
              />
            </div>

            {/* Password */}
            <div className="form-field">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter your password"
                required
              />
              {!isLogin && (
                <small className="form-hint">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </small>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={!isFormValid() || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner">⏳</span>
                  {isLogin ? 'Logging in...' : 'Creating Account...'}
                </>
              ) : (
                isLogin ? 'Login to Family Account' : 'Create Family Account'
              )}
            </button>
          </form>

          {/* Toggle Link */}
          <div className="auth-toggle-link">
            {isLogin ? (
              <>
                Don't have a family account?{' '}
                <button onClick={toggleMode} className="link-btn">
                  Create one here
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={toggleMode} className="link-btn">
                  Login here
                </button>
              </>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="auth-features">
          <h3>What you get:</h3>
          <ul>
            <li>🏠 <strong>Family Sharing:</strong> Multiple profiles per account</li>
            <li>🌍 <strong>Multilingual:</strong> Support for multiple languages</li>
            <li>📝 <strong>Smart Lists:</strong> AI-powered grocery and task lists</li>
            <li>📅 <strong>Family Calendar:</strong> Shared schedules and events</li>
            <li>🧠 <strong>Memory Bank:</strong> Store important family information</li>
            <li>🤖 <strong>AI Assistant:</strong> Voice and text interactions</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;