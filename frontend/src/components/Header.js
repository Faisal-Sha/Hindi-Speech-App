import React from 'react';
import './Header.css';

const Header = ({ language, onLanguageChange }) => {
  const languageOptions = [
    { code: 'hi-IN', name: 'हिंदी (Hindi)', flag: '🇮🇳' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
    { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  ];

  return (
    <div className="header">
      <h1>Personal AI Assistant</h1>
      <h2>व्यक्तिगत एआई सहायक</h2>
      <p>Your intelligent companion for productivity!</p>
      
      <div className="header-language-selector">
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
  );
};

export default Header;