import React from 'react';
import './ModeNavigation.css';

const ModeNavigation = ({ currentMode, onModeChange }) => {
  const modes = [
    {mode: 'chat', icon: '💬', label: 'Chat'},
    {mode: 'lists', icon: '📝', label: 'Lists'},
    {mode: 'schedule', icon: '📅', label: 'Schedule'},
    {mode: 'memory', icon: '🧠', label: 'Memory'}
  ];

  return (
    <div className="mode-navigation">
      {modes.map(({mode, icon, label}) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          className={`mode-button ${currentMode === mode ? 'active' : ''}`}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
};

export default ModeNavigation;