
import { useState, useEffect } from 'react';

const useDataManagement = (messages = []) => {
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
    for (const [itemName, item] of Object.entries(existingItems)) {
      const itemNameLower = itemName.toLowerCase();
      
      // Check if the target contains the list name or vice versa
      if (itemNameLower.includes(targetLower) || targetLower.includes(itemNameLower)) {
        console.log(`✅ Found partial name match: "${itemName}" for "${targetName}"`);
        return itemName;
      }
    }
    
    // Step 4: ONLY if no name matches found, try vague matching
    const isVagueRequest = ['list', 'schedule', 'memory', 'the list', 'my list', 'the schedule', 'my schedule'].includes(targetLower);
    
    if (isVagueRequest) {
      // If only one item exists, use that
      const existingItemNames = Object.keys(existingItems);
      if (existingItemNames.length === 1) {
        console.log(`✅ Using only existing ${itemType}: "${existingItemNames[0]}" for vague request "${targetName}"`);
        return existingItemNames[0];
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

  // =====================================
  // MAIN handleAiActions FUNCTION
  // =====================================
  
  const handleAiActions = async (actions, userId = 'default') => {
    if (!actions || !Array.isArray(actions)) {
      console.log('⚠️ No actions provided or actions is not an array');
      return;
    }

    console.log(`🤖 Processing ${actions.length} AI actions for user ${userId}`);

    for (const action of actions) {
      try {
        console.log('🔄 Processing action:', action);

        switch (action.type) {
          case 'create_list':
            await handleCreateList(action, userId);
            break;
            
          case 'add_to_list':
            await handleAddToList(action, userId);
            break;
            
          case 'update_list_item':
            await handleUpdateListItem(action, userId);
            break;
            
          case 'delete_list_item':
            await handleDeleteListItem(action, userId);
            break;
            
          case 'delete_list':
            await handleDeleteList(action, userId);
            break;
            
          case 'create_schedule':
            await handleCreateSchedule(action, userId);
            break;
            
          case 'add_event':
            await handleAddEvent(action, userId);
            break;
            
          case 'update_event':
            await handleUpdateEvent(action, userId);
            break;
            
          case 'delete_event':
            await handleDeleteEvent(action, userId);
            break;
            
          case 'delete_schedule':
            await handleDeleteSchedule(action, userId);
            break;
            
          case 'create_memory':
            await handleCreateMemory(action, userId);
            break;
            
          case 'add_memory':
            await handleAddMemory(action, userId);
            break;
            
          case 'update_memory_item':
            await handleUpdateMemoryItem(action, userId);
            break;
            
          case 'delete_memory_item':
            await handleDeleteMemoryItem(action, userId);
            break;
            
          case 'delete_memory':
            await handleDeleteMemory(action, userId);
            break;
            
          default:
            console.log(`⚠️ Unknown action type: ${action.type}`);
        }
      } catch (error) {
        console.error(`❌ Error processing action ${action.type}:`, error);
      }
    }
  };

  // =====================================
  // LIST ACTION HANDLERS
  // =====================================
  
  const handleCreateList = async (action, userId) => {
    const { listName, items = [], listType = 'custom' } = action.data;
    
    setUserLists(prev => ({
      ...prev,
      [listName]: {
        name: listName,
        type: listType,
        items: items.map((item, index) => ({
          id: Date.now() + index,
          text: item,
          completed: false,
          created: new Date()
        })),
        created: new Date(),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Created list: ${listName} with ${items.length} items`);
  };

  const handleAddToList = async (action, userId) => {
    const { listName, items = [] } = action.data;
    
    // Find the best matching list
    const bestMatch = findBestMatchingItem(listName, userLists, 'list');
    if (!bestMatch) {
      console.log(`⚠️ List "${listName}" not found, creating it`);
      await handleCreateList({ data: { listName, items } }, userId);
      return;
    }
    
    setUserLists(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        items: [
          ...prev[bestMatch].items,
          ...items.map((item, index) => ({
            id: Date.now() + index,
            text: item,
            completed: false,
            created: new Date()
          }))
        ],
        updated: new Date()
      }
    }));
    
    console.log(`✅ Added ${items.length} items to list: ${bestMatch}`);
  };

  const handleUpdateListItem = async (action, userId) => {
    const { listName, itemId, updates } = action.data;
    
    const bestMatch = findBestMatchingItem(listName, userLists, 'list');
    if (!bestMatch) {
      console.log(`⚠️ List "${listName}" not found for item update`);
      return;
    }
    
    setUserLists(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        items: prev[bestMatch].items.map(item => 
          item.id === itemId ? { ...item, ...updates, updated: new Date() } : item
        ),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Updated item ${itemId} in list: ${bestMatch}`);
  };

  const handleDeleteListItem = async (action, userId) => {
    const { listName, itemId } = action.data;
    
    const bestMatch = findBestMatchingItem(listName, userLists, 'list');
    if (!bestMatch) {
      console.log(`⚠️ List "${listName}" not found for item deletion`);
      return;
    }
    
    setUserLists(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        items: prev[bestMatch].items.filter(item => item.id !== itemId),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Deleted item ${itemId} from list: ${bestMatch}`);
  };

  const handleDeleteList = async (action, userId) => {
    const { listName } = action.data;
    
    const bestMatch = findBestMatchingItem(listName, userLists, 'list');
    if (!bestMatch) {
      console.log(`⚠️ List "${listName}" not found for deletion`);
      return;
    }
    
    setUserLists(prev => {
      const newLists = { ...prev };
      delete newLists[bestMatch];
      return newLists;
    });
    
    console.log(`✅ Deleted list: ${bestMatch}`);
  };

  // =====================================
  // SCHEDULE ACTION HANDLERS
  // =====================================
  
  const handleCreateSchedule = async (action, userId) => {
    const { scheduleName, scheduleType = 'personal' } = action.data;
    
    setUserSchedules(prev => ({
      ...prev,
      [scheduleName]: {
        name: scheduleName,
        type: scheduleType,
        events: [],
        created: new Date(),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Created schedule: ${scheduleName}`);
  };

  const handleAddEvent = async (action, userId) => {
    const { scheduleName, title, startTime, endTime, description = '', location = '' } = action.data;
    
    const bestMatch = findBestMatchingItem(scheduleName, userSchedules, 'schedule');
    if (!bestMatch) {
      console.log(`⚠️ Schedule "${scheduleName}" not found, creating it`);
      await handleCreateSchedule({ data: { scheduleName } }, userId);
      // Use the new schedule name
      const newSchedule = scheduleName;
      setUserSchedules(prev => ({
        ...prev,
        [newSchedule]: {
          ...prev[newSchedule],
          events: [{
            id: Date.now(),
            title,
            startTime,
            endTime,
            description,
            location,
            created: new Date()
          }]
        }
      }));
      return;
    }
    
    setUserSchedules(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        events: [
          ...prev[bestMatch].events,
          {
            id: Date.now(),
            title,
            startTime,
            endTime,
            description,
            location,
            created: new Date()
          }
        ],
        updated: new Date()
      }
    }));
    
    console.log(`✅ Added event "${title}" to schedule: ${bestMatch}`);
  };

  const handleUpdateEvent = async (action, userId) => {
    const { scheduleName, eventId, updates } = action.data;
    
    const bestMatch = findBestMatchingItem(scheduleName, userSchedules, 'schedule');
    if (!bestMatch) {
      console.log(`⚠️ Schedule "${scheduleName}" not found for event update`);
      return;
    }
    
    setUserSchedules(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        events: prev[bestMatch].events.map(event => 
          event.id === eventId ? { ...event, ...updates, updated: new Date() } : event
        ),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Updated event ${eventId} in schedule: ${bestMatch}`);
  };

  const handleDeleteEvent = async (action, userId) => {
    const { scheduleName, eventId } = action.data;
    
    const bestMatch = findBestMatchingItem(scheduleName, userSchedules, 'schedule');
    if (!bestMatch) {
      console.log(`⚠️ Schedule "${scheduleName}" not found for event deletion`);
      return;
    }
    
    setUserSchedules(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        events: prev[bestMatch].events.filter(event => event.id !== eventId),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Deleted event ${eventId} from schedule: ${bestMatch}`);
  };

  const handleDeleteSchedule = async (action, userId) => {
    const { scheduleName } = action.data;
    
    const bestMatch = findBestMatchingItem(scheduleName, userSchedules, 'schedule');
    if (!bestMatch) {
      console.log(`⚠️ Schedule "${scheduleName}" not found for deletion`);
      return;
    }
    
    setUserSchedules(prev => {
      const newSchedules = { ...prev };
      delete newSchedules[bestMatch];
      return newSchedules;
    });
    
    console.log(`✅ Deleted schedule: ${bestMatch}`);
  };

  // =====================================
  // MEMORY ACTION HANDLERS
  // =====================================
  
  const handleCreateMemory = async (action, userId) => {
    const { categoryName } = action.data;
    
    setUserMemory(prev => ({
      ...prev,
      [categoryName]: {
        name: categoryName,
        items: [],
        created: new Date(),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Created memory category: ${categoryName}`);
  };

  const handleAddMemory = async (action, userId) => {
    const { categoryName, items = [] } = action.data;
    
    const bestMatch = findBestMatchingItem(categoryName, userMemory, 'memory category');
    if (!bestMatch) {
      console.log(`⚠️ Memory category "${categoryName}" not found, creating it`);
      await handleCreateMemory({ data: { categoryName } }, userId);
      // Use the new category name
      const newCategory = categoryName;
      setUserMemory(prev => ({
        ...prev,
        [newCategory]: {
          ...prev[newCategory],
          items: items.map((item, index) => ({
            id: Date.now() + index,
            key: item.key || item,
            value: item.value || '',
            created: new Date()
          }))
        }
      }));
      return;
    }
    
    setUserMemory(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        items: [
          ...prev[bestMatch].items,
          ...items.map((item, index) => ({
            id: Date.now() + index,
            key: item.key || item,
            value: item.value || '',
            created: new Date()
          }))
        ],
        updated: new Date()
      }
    }));
    
    console.log(`✅ Added ${items.length} items to memory category: ${bestMatch}`);
  };

  const handleUpdateMemoryItem = async (action, userId) => {
    const { categoryName, itemId, updates } = action.data;
    
    const bestMatch = findBestMatchingItem(categoryName, userMemory, 'memory category');
    if (!bestMatch) {
      console.log(`⚠️ Memory category "${categoryName}" not found for item update`);
      return;
    }
    
    setUserMemory(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        items: prev[bestMatch].items.map(item => 
          item.id === itemId ? { ...item, ...updates, updated: new Date() } : item
        ),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Updated memory item ${itemId} in category: ${bestMatch}`);
  };

  const handleDeleteMemoryItem = async (action, userId) => {
    const { categoryName, itemId } = action.data;
    
    const bestMatch = findBestMatchingItem(categoryName, userMemory, 'memory category');
    if (!bestMatch) {
      console.log(`⚠️ Memory category "${categoryName}" not found for item deletion`);
      return;
    }
    
    setUserMemory(prev => ({
      ...prev,
      [bestMatch]: {
        ...prev[bestMatch],
        items: prev[bestMatch].items.filter(item => item.id !== itemId),
        updated: new Date()
      }
    }));
    
    console.log(`✅ Deleted memory item ${itemId} from category: ${bestMatch}`);
  };

  const handleDeleteMemory = async (action, userId) => {
    const { categoryName } = action.data;
    
    const bestMatch = findBestMatchingItem(categoryName, userMemory, 'memory category');
    if (!bestMatch) {
      console.log(`⚠️ Memory category "${categoryName}" not found for deletion`);
      return;
    }
    
    setUserMemory(prev => {
      const newMemory = { ...prev };
      delete newMemory[bestMatch];
      return newMemory;
    });
    
    console.log(`✅ Deleted memory category: ${bestMatch}`);
  };

  // =====================================
  // CHAT PROCESSING (SAFE VERSION)
  // =====================================
  
  // Process messages for chat data (safe version)
  useEffect(() => {
    if (Array.isArray(messages) && messages.length > 0) {
      try {
        // Process messages for chat organization
        const chatTopics = messages.reduce((topics, msg) => {
          if (msg && msg.type === 'user' && msg.text) {
            // Simple topic extraction
            const topic = msg.text.length > 50 ? 
              msg.text.substring(0, 50) + '...' : msg.text;
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
    handleAiActions, // ✅ Now this function exists!
    isLoading,
    loadUserData
  };
};

export default useDataManagement;