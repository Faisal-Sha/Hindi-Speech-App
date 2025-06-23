import React from 'react';

const StatusBar = ({ 
  isRecording, 
  isAILoading, 
  backendStatus, 
  currentMode, 
  language,
  speechError,
  aiError,
  accumulatedText,
  userResponse
}) => {
  
  return (
    <div className="status-section">
      {/* Main Status Items */}
      <div className="status-row">
        <div className={`status-item ${isRecording ? 'recording-active' : ''}`}>
          <strong>🎤 Speech:</strong> {isRecording ? 'Recording...' : 'Ready'}
        </div>
        
        <div className="status-item">
          <strong>🤖 AI:</strong> {isAILoading ? 'Processing...' : 'Ready'}
        </div>
        
        <div className="status-item">
          <strong>📡 Backend:</strong> {backendStatus}
        </div>

        <div className="status-item">
          <strong>🌍 Mode:</strong> {currentMode} | {language}
        </div>
      </div>
      {/* Error Display */}
      {speechError && (
        <div className="status-item status-error">
          <strong>⚠️ Speech Error:</strong> {speechError}
        </div>
      )}

      {aiError && (
        <div className="status-item status-error">
          <strong>⚠️ AI Error:</strong> {aiError}
        </div>
      )}

      {/* Live Speech Display */}
      {(accumulatedText || userResponse) && (
        <div className="live-speech">
          <strong>🎯 Your Speech:</strong>
          <div className="speech-text">
            {accumulatedText || userResponse || 'Listening...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusBar;