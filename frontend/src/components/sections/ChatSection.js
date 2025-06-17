import React from 'react';
import EmptyState from '../shared/EmptyState';
import CollapsibleSection from '../shared/CollapsibleSection';
import './ChatSection.css';

const ChatSection = ({ messages, userChats }) => {
  if (!messages || messages.length === 0) {
    return <EmptyState mode="chat" />;
  }

  return (
    <div className="chat-section">
      <h3 className="chat-section-title">💬 Chat Topics</h3>
      
      {/* General Chat (default) */}
      <CollapsibleSection
        title="💬 General Chat"
        count={messages.length}
        subtitle="Main conversation"
        defaultExpanded={true}
      >
        <div className="chat-messages-container">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.type}`}>
              <div className="chat-message-sender">
                {msg.type === "user" ? "👤 You" : "🤖 AI Assistant"}
              </div>
              <div className="chat-message-text">
                {msg.text}
              </div>
              <div className="chat-message-time">
                {msg.timestamp?.toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
      
      {/* Future: Additional chat topics would go here */}
    </div>
  );
};

export default ChatSection;
