import React, { useState } from 'react';
import './AuthScreen.css';
import appService from '../services/AppService';

const ForgotPassword = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      console.log('🔑 Requesting password reset for:', email);

      // Request password reset via backend
      const response = await fetch(appService.auth.forgotPassword, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Password reset email sent! Please check your inbox.');
        setEmail('');
      } else {
        setError(data.message || 'Failed to send password reset email');
      }

    } catch (error) {
      console.error('❌ Password reset error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">🔑 Reset Password</h1>
          <p className="auth-subtitle">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        <div className="auth-form-container">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="your@email.com"
                required
              />
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            {message && (
              <div className="success-message">
                ✅ {message}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={!email || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner">⏳</span>
                  Sending Reset Link...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className="auth-toggle-link">
            <button onClick={onBack} className="link-btn">
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;