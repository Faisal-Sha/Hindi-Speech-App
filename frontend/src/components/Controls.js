import React from 'react';

const Controls = ({ 
  isRecording, 
  isLoading, 
  userResponse,
  accumulatedText,
  onStartRecording, 
  onStopRecording, 
  onSendToAI,
  onClearMessages,
  backendStatus
}) => {
  
  const hasText = (userResponse && userResponse.trim()) || (accumulatedText && accumulatedText.trim());
  const canSend = hasText && !isLoading && backendStatus === 'connected';
  const canRecord = !isLoading;

  const getRecordButtonText = () => {
    if (isLoading) return "⏳ Processing...";
    if (isRecording) return "🔴 Stop Recording";
    return "🎤 Start Recording";
  };

  const getSendButtonText = () => {
    if (isLoading) return "⏳ Sending to AI...";
    if (backendStatus !== 'connected') return "❌ Backend Offline";
    if (!hasText) return "🎤 Record first";
    return "📤 Send to AI";
  };

  return (
    <div className="controls">
      <div className="controls-row">
        <button 
          className={`btn btn-record ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={!canRecord}
          title={isRecording ? "Stop recording" : "Start voice recording"}
        >
          {getRecordButtonText()}
        </button>
        
        <button 
          className="btn btn-send"
          onClick={onSendToAI} 
          disabled={!canSend}
          title={!hasText ? "Record some speech first" : 
                backendStatus !== 'connected' ? "Backend server is offline" :
                "Send your message to AI"}
        >
          {getSendButtonText()}
        </button>
      </div>

      {/* Secondary controls */}
      <div className="controls-row secondary">
        <button 
          className="btn btn-clear"
          onClick={onClearMessages}
          disabled={isLoading}
          title="Clear all messages"
        >
          🗑️ Clear Chat
        </button>
        
        {hasText && (
          <div className="text-preview">
            <strong>Ready to send:</strong> 
            <span>"{(userResponse || accumulatedText).substring(0, 50)}{(userResponse || accumulatedText).length > 50 ? '...' : ''}"</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Controls;