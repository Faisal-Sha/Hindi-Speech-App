import React from 'react';

const VoiceControls = ({ 
  isRecording, 
  isAILoading, 
  backendStatus,
  hasInput,
  onStartRecording,
  onStopRecording,
  onSendToAI,
  onClearMessages,
  onCheckBackend
}) => {

  const getRecordButtonText = () => {
    if (isRecording) {
      return '🔴 रोकें (Stop Recording)';
    }
    return '🎤 रिकॉर्ड करें (Start Recording)';
  };

  const getSendButtonText = () => {
    if (isAILoading) {
      return '⏳ भेजा जा रहा है... (Sending...)';
    }
    return '📤 AI को भेजें (Send to AI)';
  };

  const isRecordingDisabled = () => {
    return backendStatus === 'checking';
  };

  const isSendDisabled = () => {
    return (
      isAILoading || 
      !hasInput || 
      backendStatus !== 'connected'
    );
  };

  return (
    <div className="voice-controls">
      {/* Primary Controls */}
      <div className="controls-row primary">
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isRecordingDisabled()}
          className={`btn btn-record ${isRecording ? 'recording' : ''}`}
          title={isRecording ? "Click to stop recording" : "Click to start voice recording"}
        >
          {getRecordButtonText()}
        </button>

        <button
          onClick={onSendToAI}
          disabled={isSendDisabled()}
          className="btn btn-send"
          title="Send your speech to AI for processing"
        >
          {getSendButtonText()}
        </button>
      </div>

      {/* Secondary Controls */}
      <div className="controls-row secondary">
        <button 
          onClick={onClearMessages} 
          className="btn btn-clear"
          title="Clear all messages and start fresh"
        >
          🗑️ Clear Chat
        </button>
        
        <button 
          onClick={onCheckBackend} 
          className="btn btn-health"
          title="Check if backend server is running"
        >
          🔍 Check Backend
        </button>
      </div>

      {/* Help Section */}
      <div className="controls-help">
        <div className="help-section">
          <h4>💡 Quick Tips:</h4>
          <div className="help-tips">
            <div className="help-tip">
              <strong>🎤 Recording:</strong> Speak clearly, pauses are okay
            </div>
            <div className="help-tip">
              <strong>🤖 Commands:</strong> Try "Create shopping list" or "Add meeting tomorrow"
            </div>
            <div className="help-tip">
              <strong>🌍 Languages:</strong> Switch languages anytime from the header
            </div>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="controls-status">
        {backendStatus !== 'connected' && (
          <div className="status-warning">
            ⚠️ Backend disconnected - Please start your server
          </div>
        )}
        
        {isRecording && (
          <div className="recording-indicator">
            🔴 Recording... Speak now
          </div>
        )}
        
        {isAILoading && (
          <div className="ai-processing">
            🤖 AI is thinking...
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceControls;