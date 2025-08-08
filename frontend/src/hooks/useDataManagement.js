import { useState, useEffect } from 'react';

const useDataManagement = (messages = []) => { // Default empty array to prevent undefined errors
  // State for different data types
  const [userLists, setUserLists] = useState({});
  const [userSchedules, setUserSchedules] = useState({});
  const [userMemory, setUserMemory] = useState({});
  const [userChats, setUserChats] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Load user data from backend on startup
  useEffect(() => {
    loadUserData();
  }, []);

  const findBestMatchingItem = (targetName, existingItems, itemType = 'item') => {
    if (!targetName || !existingItems) return null;
    
    console.log(`🔍 Looking for ${itemType}: "${targetName}" in existing items:`, Object.keys(existingItems));
    
    // Step 1: Try exact match (HIGHEST PRIORITY)
    if (existingItems[targetName]) {
      console.log(`✅ Found exact match: "${targetName}"`);
      return targetName;
    }
    
    // Step 2: Try case-insensitive match (SECOND HIGHEST)
    const targetLower = targetName.toLowerCase();
    for (const [itemName, item] of Object.entries(existingItems)) {
      if (itemName.toLowerCase() === targetLower) {
        console.log(`✅ Found case-insensitive match: "${itemName}" for "${targetName}"`);
        return itemName;
      }
    }
    
    // Step 3: Try partial match with name keywords (THIRD PRIORITY)
    // Look for keywords that suggest specific list names
    for (const [itemName, item] of Object.entries(existingItems)) {
      const itemNameLower = itemName.toLowerCase();
      
      // Check if the target contains the list name or vice versa
      if (itemNameLower.includes(targetLower) || targetLower.includes(itemNameLower)) {
        console.log(`✅ Found partial name match: "${itemName}" for "${targetName}"`);
        return itemName;
      }
    }
    
    // Step 4: ONLY if no name matches found, try vague matching
    // Only use this for very generic requests like "add to the list"
    const isVagueRequest = ['list', 'schedule', 'memory', 'the list', 'my list', 'the schedule', 'my schedule'].includes(targetLower);
    
    if (isVagueRequest) {
      // If only one item exists, use that
      const existingItemNames = Object.keys(existingItems);
      if (existingItemNames.length === 1) {
        console.log(`✅ Using only existing ${itemType}: "${existingItemNames[0]}" for vague request "${targetName}"`);
        return existingItemNames[0];
      }
      
      // For multiple items with vague request, try type-based matching
      if (itemType === 'list') {
        return findListByTypeForVagueRequest(targetName, existingItems);
      }
      if (itemType === 'schedule') {
        findScheduleByType(targetName, existingItems)
      }
      if (itemType === 'memory') {
        findMemoryByCategory(targetName, existingItems)
      }
    }
    
    // Step 5: No match found - return null to create new item
    console.log(`❌ No matching ${itemType} found for "${targetName}" - will create new`);
    return null;
  };
  
  // Helper for list-specific matching (only for vague requests)
  const findListByTypeForVagueRequest = (targetName, existingLists) => {
    const targetLower = targetName.toLowerCase();
    const isGenericListRequest = ['list', 'the list', 'my list'].includes(targetLower);
    
    if (!isGenericListRequest) {
      return null; // Don't do type matching for specific names
    }
    
    const listEntries = Object.entries(existingLists);
    if (listEntries.length > 0) {
      const mostRecent = listEntries.reduce((latest, [name, list]) => {
        const latestDate = latest[1].lastUpdated || latest[1].created || new Date(0);
        const currentDate = list.lastUpdated || list.created || new Date(0);
        return currentDate > latestDate ? [name, list] : latest;
      });
      console.log(`✅ Found most recent list for generic request: "${mostRecent[0]}" for "${targetName}"`);
      return mostRecent[0];
    }
    
    return null;
  };
  
  // Helper for schedule-specific matching
  const findScheduleByType = (targetName, existingSchedules) => {
    const commonKeywords = ['schedule', 'calendar', 'agenda', 'appointment', 'meeting', 'event'];
    const targetLower = targetName.toLowerCase();
    
    // Check if target name contains schedule-related keywords
    if (commonKeywords.some(keyword => targetLower.includes(keyword))) {
      // Find the most recently updated schedule
      const scheduleEntries = Object.entries(existingSchedules);
      if (scheduleEntries.length > 0) {
        const mostRecent = scheduleEntries.reduce((latest, [name, schedule]) => {
          const latestDate = latest[1].lastUpdated || latest[1].created || new Date(0);
          const currentDate = schedule.lastUpdated || schedule.created || new Date(0);
          return currentDate > latestDate ? [name, schedule] : latest;
        });
        console.log(`✅ Found schedule by keyword match: "${mostRecent[0]}" for "${targetName}"`);
        return mostRecent[0];
      }
    }
    return null;
  };
  
  // Helper for memory-specific matching
  const findMemoryByCategory = (targetName, existingMemory) => {
    const commonCategories = {
      'contacts': ['contact', 'person', 'people', 'phone', 'number', 'email'],
      'passwords': ['password', 'login', 'account', 'credential'],
      'notes': ['note', 'reminder', 'remember', 'info', 'information'],
      'general': ['general', 'misc', 'other']
    };
    
    const targetLower = targetName.toLowerCase();
    
    for (const [categoryName, category] of Object.entries(existingMemory)) {
      // Check if category name matches any known category types
      for (const [type, keywords] of Object.entries(commonCategories)) {
        if (keywords.some(keyword => targetLower.includes(keyword))) {
          if (categoryName.toLowerCase().includes(type) || 
              keywords.some(keyword => categoryName.toLowerCase().includes(keyword))) {
            console.log(`✅ Found memory category match: "${categoryName}" for "${targetName}"`);
            return categoryName;
          }
        }
      }
    }
    return null;
  };
  
  // Load user data function
  const loadUserData = async (userId = 'default') => {
    try {
      setIsLoading(true);
      console.log(`📖 Loading user data for: ${userId}`);
      
      const response = await fetch(`http://localhost:3001/data/${userId}`);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Loaded user data:', userData);
        
        // Safely set user data with fallbacks
        setUserLists(userData.lists || {});
        setUserSchedules(userData.schedules || {});
        setUserMemory(userData.memory || {});
        setUserChats(userData.chats || {});
      } else {
        console.log('⚠️ No existing user data found, starting fresh');
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  
  
  // Process messages for chat data (safe version)
  useEffect(() => {
    if (Array.isArray(messages) && messages.length > 0) {
      try {
        // Process messages for chat organization
        const chatTopics = messages.reduce((topics, msg) => {
          if (msg && msg.type === 'user' && msg.text) {
            // Simple topic extraction (you can enhance this)
            const topic = msg.text.length > 50 ? msg.text.substring(0, 50) + '...' : msg.text;
            topics.push(topic);
          }
          return topics;
        }, []);

        setUserChats(prev => ({
          ...prev,
          general: {
            name: 'General Chat',
            messages: messages,
            topics: chatTopics.slice(-5), // Keep last 5 topics
            updated: new Date()
          }
        }));
      } catch (error) {
        console.error('❌ Error processing messages:', error);
        // Don't crash, just continue
      }
    }
  }, [messages]); // Safe dependency since we check if it's an array

  return {
    userLists,
    userSchedules,
    userMemory,
    userChats,
    handleAiActions,
    isLoading,
    loadUserData
  };
};

export default useDataManagement;