import { useState, useEffect, useRef, useCallback } from 'react';

const useSpeechRecognition = (language) => {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [accumulatedText, setAccumulatedText] = useState('');
  const [userResponse, setUserResponse] = useState('');
  const [speechError, setSpeechError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  // Refs
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const restartAttemptRef = useRef(0);
  const maxRestartAttempts = 3;

  // Check browser support
  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSupported(supported);
    
    if (!supported) {
      setSpeechError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    initializeSpeechRecognition();
    
    return cleanup;
  }, [language]);

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Enhanced configuration for better Hindi support
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5; // Get more alternatives for better accuracy
    recognition.lang = language;
    
    // Enhanced result processing
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscript += transcript + ' ';
          console.log('🎯 Final speech result:', transcript);
          console.log('🎯 Confidence:', result[0].confidence);
          
          // Log alternatives for debugging
          if (result.length > 1) {
            console.log('🎯 Alternatives:', Array.from(result).map(alt => alt.transcript));
          }
        } else {
          interimTranscript += transcript;
          console.log('⏳ Interim speech result:', transcript);
        }
      }
      
      // Update state with final results
      if (finalTranscript.trim()) {
        setAccumulatedText(prev => prev + finalTranscript);
        setUserResponse(prev => prev + finalTranscript);
        resetSilenceTimer();
        restartAttemptRef.current = 0; // Reset restart attempts on successful recognition
      }
      
      // Clear any speech errors on successful recognition
      if (finalTranscript || interimTranscript) {
        setSpeechError(null);
      }
    };
    
    // Enhanced error handling with language-appropriate messages
    recognition.onerror = (event) => {
      console.error('🔴 Speech recognition error:', event.error);
      
      const errorMessages = {
        'no-speech': {
          'hi-IN': 'कोई आवाज़ नहीं सुनाई दी',
          'en-US': 'No speech detected - please speak louder',
          'es-ES': 'No se detectó voz - hable más fuerte',
          'fr-FR': 'Aucune parole détectée - parlez plus fort',
          'de-DE': 'Keine Sprache erkannt - sprechen Sie lauter'
        },
        'audio-capture': {
          'hi-IN': 'माइक्रोफ़ोन एक्सेस नहीं मिला',
          'en-US': 'Microphone access denied',
          'es-ES': 'Acceso al micrófono denegado',
          'fr-FR': 'Accès au microphone refusé',
          'de-DE': 'Mikrofonzugriff verweigert'
        },
        'not-allowed': {
          'hi-IN': 'माइक्रोफ़ोन अनुमति दें',
          'en-US': 'Please allow microphone access',
          'es-ES': 'Por favor permite el acceso al micrófono',
          'fr-FR': 'Veuillez autoriser l\'accès au microphone',
          'de-DE': 'Bitte erlauben Sie Mikrofonzugriff'
        },
        'network': {
          'hi-IN': 'नेटवर्क समस्या',
          'en-US': 'Network connection issue',
          'es-ES': 'Problema de conexión de red',
          'fr-FR': 'Problème de connexion réseau',
          'de-DE': 'Netzwerkverbindungsproblem'
        },
        'service-not-allowed': {
          'hi-IN': 'स्पीच सेवा उपलब्ध नहीं',
          'en-US': 'Speech recognition service not available',
          'es-ES': 'Servicio de reconocimiento de voz no disponible',
          'fr-FR': 'Service de reconnaissance vocale non disponible',
          'de-DE': 'Spracherkennungsdienst nicht verfügbar'
        },
        'bad-grammar': {
          'hi-IN': 'भाषा समझने में समस्या',
          'en-US': 'Language processing issue - try speaking more clearly',
          'es-ES': 'Problema de procesamiento de idioma',
          'fr-FR': 'Problème de traitement linguistique',
          'de-DE': 'Sprachverarbeitungsproblem'
        }
      };
      
      const errorInfo = errorMessages[event.error] || {
        'hi-IN': 'स्पीच पहचान में समस्या',
        'en-US': `Speech recognition error: ${event.error}`,
        'es-ES': `Error de reconocimiento de voz: ${event.error}`,
        'fr-FR': `Erreur de reconnaissance vocale: ${event.error}`,
        'de-DE': `Spracherkennungsfehler: ${event.error}`
      };
      
      // Get the appropriate error message for the current language
      const currentLanguageError = errorInfo[language] || errorInfo['en-US'];
      setSpeechError(currentLanguageError);
      
      // Auto-restart on certain recoverable errors
      const recoverableErrors = ['no-speech', 'network', 'service-not-allowed'];
      if (recoverableErrors.includes(event.error) && isRecording && restartAttemptRef.current < maxRestartAttempts) {
        console.log(`🔄 Attempting to restart speech recognition (attempt ${restartAttemptRef.current + 1})`);
        restartAttemptRef.current++;
        
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('Error restarting recognition:', error);
            }
          }
        }, 1000);
      }
    };
    
    // Handle recognition end
    recognition.onend = () => {
      console.log('🔇 Speech recognition ended');
      
      // Auto-restart if still recording (for continuous recording)
      if (isRecording && restartAttemptRef.current < maxRestartAttempts) {
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              console.log('🔄 Auto-restarting speech recognition');
            } catch (error) {
              console.error('Error auto-restarting recognition:', error);
              // If we can't restart, stop recording
              setIsRecording(false);
            }
          }
        }, 100);
      }
    };
    
    // Handle recognition start
    recognition.onstart = () => {
      console.log('🎤 Speech recognition started for language:', language);
      setSpeechError(null);
      restartAttemptRef.current = 0;
    };
    
    recognitionRef.current = recognition;
  }, [language, isRecording]);

  // Silence detection timer
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    // Auto-stop after 8 seconds of silence (longer for Hindi speakers who might think more)
    silenceTimerRef.current = setTimeout(() => {
      if (isRecording && (accumulatedText.trim() || userResponse.trim())) {
        console.log('🔇 Auto-stopping due to silence');
        stopRecording();
      }
    }, 8000); // Increased from 5 to 8 seconds for better UX
  }, [isRecording, accumulatedText, userResponse]);

  // Start recording function
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setSpeechError('Speech recognition not supported in this browser');
      return;
    }

    try {
      // Request microphone permission explicitly
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setSpeechError(null);
      setAccumulatedText('');
      setUserResponse('');
      restartAttemptRef.current = 0;
      
      if (recognitionRef.current) {
        setIsRecording(true);
        recognitionRef.current.start();
        console.log('🎤 Started recording in language:', language);
        resetSilenceTimer();
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      if (error.name === 'NotAllowedError') {
        const permissionErrors = {
          'hi-IN': 'माइक्रोफ़ोन एक्सेस दें',
          'en-US': 'Please allow microphone access',
          'es-ES': 'Por favor permite el acceso al micrófono',
          'fr-FR': 'Veuillez autoriser l\'accès au microphone',
          'de-DE': 'Bitte erlauben Sie Mikrofonzugriff'
        };
        setSpeechError(permissionErrors[language] || permissionErrors['en-US']);
      } else if (error.name === 'NotFoundError') {
        const notFoundErrors = {
          'hi-IN': 'माइक्रोफ़ोन नहीं मिला',
          'en-US': 'No microphone found',
          'es-ES': 'No se encontró micrófono',
          'fr-FR': 'Aucun microphone trouvé',
          'de-DE': 'Kein Mikrofon gefunden'
        };
        setSpeechError(notFoundErrors[language] || notFoundErrors['en-US']);
      } else {
        const generalErrors = {
          'hi-IN': `रिकॉर्डिंग शुरू नहीं हो सकी: ${error.message}`,
          'en-US': `Could not start recording: ${error.message}`,
          'es-ES': `No se pudo iniciar la grabación: ${error.message}`,
          'fr-FR': `Impossible de démarrer l'enregistrement: ${error.message}`,
          'de-DE': `Aufnahme konnte nicht gestartet werden: ${error.message}`
        };
        setSpeechError(generalErrors[language] || generalErrors['en-US']);
      }
    }
  }, [isSupported, language, resetSilenceTimer]);

  // Stop recording function
  const stopRecording = useCallback(() => {
    try {
      setIsRecording(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      console.log('🛑 Stopped recording');
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }, []);

  // Clear text function
  const clearText = useCallback(() => {
    setAccumulatedText('');
    setUserResponse('');
    setSpeechError(null);
    console.log('🗑️ Cleared speech text');
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  }, []);

  // Update language when it changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
      console.log('🌍 Updated speech recognition language to:', language);
    }
  }, [language]);

  return {
    isRecording,
    accumulatedText,
    userResponse,
    speechError,
    isSupported,
    startRecording,
    stopRecording,
    clearText
  };
};

export default useSpeechRecognition;