import React from 'react';
import './EmptyState.css';

const EmptyState = ({ mode }) => {
  const emptyStates = {
    chat: {
      icon: "💬",
      title: "Start Your First Conversation",
      subtitle: "Ask me anything or say 'create new chat about ________' to organize conversations by topic",
      suggestions: ["Hello, how are you?", "Create new chat about work", "Help me plan my day"]
    },
    lists: {
      icon: "📝",
      title: "No Lists Yet",
      subtitle: "Say 'create a shopping list' or 'create a todo list' to get started",
      suggestions: ["Create a shopping list", "Create a todo list", "Make a list for vacation planning"]
    },
    schedule: {
      icon: "📅", 
      title: "No Events Scheduled",
      subtitle: "Say 'schedule a meeting' or 'create work schedule' to start organizing your time",
      suggestions: ["Schedule a meeting tomorrow", "Create work schedule", "Add doctor appointment"]
    },
    memory: {
      icon: "🧠",
      title: "Memory Bank Empty", 
      subtitle: "Say 'remember that...' or 'create contacts list' to start storing important information",
      suggestions: ["Create contacts list", "Remember my WiFi password", "Store important notes"]
    }
  };

  const state = emptyStates[mode];
  
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{state.icon}</div>
      <h3 className="empty-state-title">{state.title}</h3>
      <p className="empty-state-subtitle">{state.subtitle}</p>
      
      <div className="empty-state-suggestions">
        <h4>💡 Try saying:</h4>
        {state.suggestions.map((suggestion, index) => (
          <div key={index} className="suggestion-chip">
            "{suggestion}"
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmptyState;
