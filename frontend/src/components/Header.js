import React from 'react';
import './Header.css';

const Header = ({ 
  language, 
  onLanguageChange, 
  currentMode, 
  onModeChange, 
  currentUser, 
  onSwitchUser,
  familyAccount,
  onLogout,
  showModeNavigation = true
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

  // Get title text based on user's language
  const getTitleText = () => {
    const titles = {
      'en-US': {
        main: 'Personal AI Assistant',
        subtitle: 'Ready to Help',
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
      <div className="header-top-bar">
        {/* Left: App Title */}
        <div className="header-title">
          <h1>{titleText.main}</h1>
          {familyAccount && (
            <p className="family-account-name">👨‍👩‍👧‍👦 {familyAccount.accountName}</p>
          )}
        </div>

        {/* Right: User Info and Logout */}
        <div className="header-actions">
          {currentUser && (
            <div className="current-user-display">
              <span className="user-avatar">{currentUser.avatar_emoji || '👤'}</span>
              <span className="user-name">{currentUser.display_name}</span>
              <button onClick={onSwitchUser} className="switch-user-btn">
                🔄 Switch
              </button>
            </div>
          )}
          
          {onLogout && (
            <button onClick={onLogout} className="logout-btn">
              🚪 Logout
            </button>
          )}
        </div>
      </div>

      {/* Language Display (if user is selected) */}
      {currentUser && (
        <div className="language-display">
          <div className="current-language-info">
            <span className="language-flag">{currentLanguageInfo.flag}</span>
            <span className="language-name">{currentLanguageInfo.name}</span>
          </div>
        </div>
      )}
      
      {/* Mode Navigation (only show when user is selected) */}
      {showModeNavigation && currentUser && (
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
      )}
    </div>
  );
};

export default Header;