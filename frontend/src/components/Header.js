import React from 'react';

const Header = ({ language, onLanguageChange, currentMode, onModeChange }) => {
  const languageOptions = [
    { code: 'hi-IN', name: 'हिंदी (Hindi)', flag: '🇮🇳' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
    { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  ];

  const modes = [
    {mode: 'chat', icon: '💬', label: 'Chat'},
    {mode: 'lists', icon: '📝', label: 'Lists'},
    {mode: 'schedule', icon: '📅', label: 'Schedule'},
    {mode: 'memory', icon: '🧠', label: 'Memory'}
  ];

  return (
    <div className="header-section">
      {/* Title Area */}
      <div className="header-title">
        <h1>Personal AI Assistant</h1>
        <h2>व्यक्तिगत एआई सहायक</h2>
        <p>Your intelligent companion for productivity!</p>
        <div className="language-selector">
          <select 
            value={language} 
            onChange={(e) => onLanguageChange(e.target.value)}
            className="language-dropdown"
          >
            {languageOptions.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Mode Navigation */}
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
    </div>
  );
};
export default Header;