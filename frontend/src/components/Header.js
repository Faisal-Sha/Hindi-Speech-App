import React from 'react';

const Header = ({ 
  language, 
  onLanguageChange, 
  currentMode, 
  onModeChange, 
  currentUser, 
  onSwitchUser 
}) => {
  
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

  // Get current language display info
  const currentLanguageInfo = languageOptions.find(lang => lang.code === language) || languageOptions[1];

  // Get title and subtitle based on user's language
  const getTitleText = () => {
    const titles = {
      'en-US': {
        main: 'Personal AI Assistant',
        subtitle: 'व्यक्तिगत एआई सहायक',
        tagline: 'Your intelligent companion for productivity!'
      },
      'hi-IN': {
        main: 'व्यक्तिगत एआई सहायक',
        subtitle: 'Personal AI Assistant',
        tagline: 'उत्पादकता के लिए आपका बुद्धिमान साथी!'
      },
      'es-ES': {
        main: 'Asistente de IA Personal',
        subtitle: 'Personal AI Assistant',
        tagline: '¡Tu compañero inteligente para la productividad!'
      },
      'fr-FR': {
        main: 'Assistant IA Personnel',
        subtitle: 'Personal AI Assistant',
        tagline: 'Votre compagnon intelligent pour la productivité!'
      },
      'de-DE': {
        main: 'Persönlicher KI-Assistent',
        subtitle: 'Personal AI Assistant',
        tagline: 'Ihr intelligenter Begleiter für Produktivität!'
      }
    };
    
    return titles[language] || titles['en-US'];
  };

  const titleText = getTitleText();

  return (
    <div className="header-section">
      <div className="header-title">
        <h1>{titleText.main}</h1>
        <h2>{titleText.subtitle}</h2>
        <p>{titleText.tagline}</p>
        
        {/* User Language Display (Read-only) */}
        <div className="language-display">
          <div className="current-language-info">
            <span className="language-flag">{currentLanguageInfo.flag}</span>
            <span className="language-name">{currentLanguageInfo.name}</span>
            <small className="language-note">
              (Set in user profile - switch users to change language)
            </small>
          </div>
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