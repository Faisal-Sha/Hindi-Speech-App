import React from 'react';

const StatusSection = ({ 
  isRecording, 
  userResponse, 
  currentMode, 
  backendStatus, 
  error 
}) => {
  const getBackendStatusDisplay = () => {
    switch (backendStatus) {
      case 'connected':
        return '🟢 Backend Connected';
      case 'disconnected':
        return '🔴 Backend Disconnected';
      case 'checking':
        return '🟡 Checking Connection...';
      default:
        return '⚪ Unknown Status';
    }
  };

  const getRecordingStatus = () => {
    if (isRecording) {
      return '🔴 Recording... (speak now)';
    } else if (userResponse && userResponse.trim()) {
      return '✅ Speech captured';
    } else {
      return '⚪ Ready to listen';
    }
  };

  return (
    <div className="status-section">
      <div className={`status-item ${isRecording ? "recording-active" : ""}`}>
        <span className="status-label">Recording Status: </span>
        <span className="status-value">
          {getRecordingStatus()}
        </span>
      </div>

      <div className="status-item">
        <span className="status-label">You said: </span>
        <span className="status-value">
          {userResponse || "Nothing yet"}
        </span>
      </div>

      <div className="status-item">
        <span className="status-label">Current Mode: </span>
        <span className="status-value">{currentMode}</span>
      </div>

      <div className={`status-item ${backendStatus === 'disconnected' ? 'status-error' : ''}`}>
        <span className="status-label">Backend: </span>
        <span className="status-value">
          {getBackendStatusDisplay()}
        </span>
      </div>

      {error && (
        <div className="status-item status-error">
          <span className="status-label">Error: </span>
          <span className="status-value">{error}</span>
        </div>
      )}
    </div>
  );
};

export default StatusSection;