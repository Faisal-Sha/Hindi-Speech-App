const translateText = async (text, targetLanguage) => {
    // Simple language mapping
    const languageMap = {
      'hi-IN': 'Hindi',
      'en-US': 'English', 
      'es-ES': 'Spanish',
      'fr-FR': 'French',
      'de-DE': 'German'
    };
  
    const targetLang = languageMap[targetLanguage] || 'English';
    
    // If it's already English or Hindi, don't translate
    if (targetLanguage === 'en-US' || targetLanguage === 'hi-IN') {
      return text;
    }
  
    try {
      const response = await fetch('http://localhost:3001/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          targetLanguage: targetLang
        })
      });
  
      const result = await response.json();
      return result.translatedText || text;
    } catch (error) {
      console.error('Translation failed:', error);
      return text; // Return original text if translation fails
    }
  };
  
export default translateText;