import { useState, useEffect } from 'react';

const useDataManagement = (messages) => {
  const [userLists, setUserLists] = useState({});
  const [userSchedules, setUserSchedules] = useState({});
  const [userMemory, setUserMemory] = useState({});
  const [userChats, setUserChats] = useState({
    'general': {
      title: "💬 General Chat",
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [userId] = useState('default');

  const API_BASE = 'http://localhost:3001';

  // Load user data when component mounts
  useEffect(() => {
    loadUserData();
  }, []);

  // Sync messages with general chat
  useEffect(() => {
    setUserChats(prev => ({
      ...prev,
      'general': {
        ...prev.general,
        messages: messages,
        lastActivity: messages.length > 0 ? new Date() : prev.general?.lastActivity || new Date()
      }
    }));
  }, [messages]);

  // **FIXED: Load data from backend with better error handling**
  const loadUserData = async () => {
    try {
      setIsLoading(true);
      console.log('📖 Loading user data from backend...');
      
      const response = await fetch(`${API_BASE}/data/${userId}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.log('👤 User not found, will be created on first save');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Loaded data from backend:', {
        lists: Object.keys(data.lists || {}).length,
        schedules: Object.keys(data.schedules || {}).length,
        memory: Object.keys(data.memory || {}).length,
        chats: Object.keys(data.chats || {}).length
      });
      
      // Update state with backend data
      setUserLists(data.lists || {});
      setUserSchedules(data.schedules || {});
      setUserMemory(data.memory || {});
      setUserChats(prev => ({
        ...prev,
        ...data.chats || {}
      }));
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      // Keep default empty state if loading fails
    } finally {
      setIsLoading(false);
    }
  };

  // **FIXED: Save data to backend with proper error handling**
  const saveToBackend = async (dataType, dataKey, dataValue) => {
    try {
      console.log(`💾 Saving ${dataType}/${dataKey} to backend...`);
      
      const response = await fetch(`${API_BASE}/save-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dataType,
          dataKey,
          dataValue
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Saved ${dataType}/${dataKey} successfully:`, result);
      return true;
    } catch (error) {
      console.error(`❌ Error saving ${dataType}/${dataKey}:`, error);
      return false;
    }
  };

  const generateId = () => Date.now().toString();

  // **HELPER: Find list by name (case-insensitive, fuzzy matching)**
  const findListByName = (searchName) => {
    if (!searchName) return null;
    
    const normalizedSearch = searchName.toLowerCase().trim();
    
    // First try exact match
    for (const [id, list] of Object.entries(userLists)) {
      if (list.title.toLowerCase() === normalizedSearch) {
        console.log(`🎯 Found exact list match: "${list.title}" (${id})`);
        return { id, list };
      }
    }
    
    // Then try partial match
    for (const [id, list] of Object.entries(userLists)) {
      if (list.title.toLowerCase().includes(normalizedSearch) || 
          normalizedSearch.includes(list.title.toLowerCase())) {
        console.log(`🎯 Found partial list match: "${list.title}" (${id})`);
        return { id, list };
      }
    }
    
    console.log(`❌ No list found matching: "${searchName}"`);
    return null;
  };

  // **HELPER: Find schedule by name**
  const findScheduleByName = (searchName) => {
    if (!searchName) return null;
    
    const normalizedSearch = searchName.toLowerCase().trim();
    
    for (const [id, schedule] of Object.entries(userSchedules)) {
      if (schedule.title.toLowerCase().includes(normalizedSearch) || 
          normalizedSearch.includes(schedule.title.toLowerCase())) {
        console.log(`🎯 Found schedule match: "${schedule.title}" (${id})`);
        return { id, schedule };
      }
    }
    
    return null;
  };

  // **HELPER: Find memory by name**
  const findMemoryByName = (searchName) => {
    if (!searchName) return null;
    
    const normalizedSearch = searchName.toLowerCase().trim();
    
    for (const [id, memory] of Object.entries(userMemory)) {
      if (memory.title.toLowerCase().includes(normalizedSearch) || 
          normalizedSearch.includes(memory.title.toLowerCase())) {
        console.log(`🎯 Found memory match: "${memory.title}" (${id})`);
        return { id, memory };
      }
    }
    
    return null;
  };

  // Create functions (unchanged but with better logging)
  const createNewList = async (listName) => {
    const listId = generateId();
    const newList = {
      title: listName,
      items: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    console.log(`📝 Creating new list: "${listName}" with ID: ${listId}`);
    
    // Update local state immediately
    setUserLists(prev => ({
      ...prev,
      [listId]: newList
    }));
    
    // Save to backend
    const saved = await saveToBackend('lists', listId, newList);
    if (!saved) {
      console.error(`❌ Failed to save list "${listName}" to backend`);
    }
    
    return listId;
  };

  const createNewSchedule = async (scheduleName) => {
    const scheduleId = generateId();
    const newSchedule = {
      title: scheduleName,
      events: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    console.log(`📅 Creating new schedule: "${scheduleName}" with ID: ${scheduleId}`);
    
    setUserSchedules(prev => ({
      ...prev,
      [scheduleId]: newSchedule
    }));
    
    await saveToBackend('schedules', scheduleId, newSchedule);
    return scheduleId;
  };

  const createNewMemoryCategory = async (categoryName) => {
    const categoryId = generateId();
    const newCategory = {
      title: categoryName,
      items: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    console.log(`🧠 Creating new memory category: "${categoryName}" with ID: ${categoryId}`);
    
    setUserMemory(prev => ({
      ...prev,
      [categoryId]: newCategory
    }));
    
    await saveToBackend('memory', categoryId, newCategory);
    return categoryId;
  };

  const createNewChat = async (chatTitle) => {
    const chatId = generateId();
    const newChat = {
      title: chatTitle,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    console.log(`💬 Creating new chat: "${chatTitle}" with ID: ${chatId}`);
    
    setUserChats(prev => ({
      ...prev,
      [chatId]: newChat
    }));
    
    await saveToBackend('chats', chatId, newChat);
    return chatId;
  };

  // **FIXED: Smart add to list - finds the right list**
  const addToUserList = async (listId, item, listHint = null) => {
    console.log(`📝 Adding "${item}" to list. ListID: ${listId}, Hint: "${listHint}"`);
    
    let targetListId = listId;
    let targetList = userLists[listId];
    
    // **SMART TARGETING: If no specific list or list doesn't exist, try to find by hint**
    if (!targetList && listHint) {
      const found = findListByName(listHint);
      if (found) {
        targetListId = found.id;
        targetList = found.list;
        console.log(`🎯 Found target list by hint: "${targetList.title}"`);
      }
    }
    
    // **SMART TARGETING: If still no list, find the most recent list**
    if (!targetList) {
      const listIds = Object.keys(userLists);
      if (listIds.length > 0) {
        // Get the most recently created list
        const mostRecentListId = listIds.reduce((latest, current) => {
          return userLists[current].createdAt > userLists[latest].createdAt ? current : latest;
        });
        targetListId = mostRecentListId;
        targetList = userLists[mostRecentListId];
        console.log(`🎯 Using most recent list: "${targetList.title}"`);
      }
    }
    
    // Create the new item object
    const newItem = {
      id: Date.now(),
      text: item,
      completed: false,
      addedAt: new Date()
    };
    
    setUserLists(prev => {
      // If still no list found, create a new one
      if (!targetList) {
        console.log('📝 No suitable list found, creating new "Quick List"');
        const newListId = generateId();
        const newList = {
          title: "Quick List",
          items: [newItem],
          createdAt: new Date(),
          lastUpdated: new Date()
        };
        
        // Save new list to backend
        saveToBackend('lists', newListId, newList);
        
        return {
          ...prev,
          [newListId]: newList
        };
      }
      
      // Add to existing list
      const updatedList = {
        ...targetList,
        items: [...targetList.items, newItem],
        lastUpdated: new Date()
      };
      
      console.log(`✅ Added "${item}" to "${targetList.title}" (total: ${updatedList.items.length} items)`);
      
      // Save updated list to backend
      saveToBackend('lists', targetListId, updatedList);
      
      return {
        ...prev,
        [targetListId]: updatedList
      };
    });
  };

  // Similar smart targeting for schedules and memory...
  const addToUserSchedule = async (scheduleId, event, scheduleHint = null) => {
    console.log(`📅 Adding event to schedule. ScheduleID: ${scheduleId}, Hint: "${scheduleHint}"`);
    
    let targetScheduleId = scheduleId;
    let targetSchedule = userSchedules[scheduleId];
    
    if (!targetSchedule && scheduleHint) {
      const found = findScheduleByName(scheduleHint);
      if (found) {
        targetScheduleId = found.id;
        targetSchedule = found.schedule;
      }
    }
    
    const newEvent = {
      ...event,
      id: Date.now(),
      addedAt: new Date()
    };
    
    setUserSchedules(prev => {
      if (!targetSchedule) {
        const newScheduleId = generateId();
        const newSchedule = {
          title: "My Schedule",
          events: [newEvent],
          createdAt: new Date(),
          lastUpdated: new Date()
        };
        
        saveToBackend('schedules', newScheduleId, newSchedule);
        
        return {
          ...prev,
          [newScheduleId]: newSchedule
        };
      }
      
      const updatedSchedule = {
        ...targetSchedule,
        events: [...targetSchedule.events, newEvent],
        lastUpdated: new Date()
      };
      
      saveToBackend('schedules', targetScheduleId, updatedSchedule);
      
      return {
        ...prev,
        [targetScheduleId]: updatedSchedule
      };
    });
  };

  const addToUserMemory = async (categoryId, data, memoryHint = null) => {
    console.log(`🧠 Adding to memory category. CategoryID: ${categoryId}, Hint: "${memoryHint}"`);
    
    let targetCategoryId = categoryId;
    let targetCategory = userMemory[categoryId];
    
    if (!targetCategory && memoryHint) {
      const found = findMemoryByName(memoryHint);
      if (found) {
        targetCategoryId = found.id;
        targetCategory = found.memory;
      }
    }
    
    const newMemoryItem = {
      ...data,
      id: Date.now(),
      addedAt: new Date()
    };
    
    setUserMemory(prev => {
      if (!targetCategory) {
        const newCategoryId = generateId();
        const newCategory = {
          title: "General Memory",
          items: [newMemoryItem],
          createdAt: new Date(),
          lastUpdated: new Date()
        };
        
        saveToBackend('memory', newCategoryId, newCategory);
        
        return {
          ...prev,
          [newCategoryId]: newCategory
        };
      }
      
      const updatedCategory = {
        ...targetCategory,
        items: [...targetCategory.items, newMemoryItem],
        lastUpdated: new Date()
      };
      
      saveToBackend('memory', targetCategoryId, updatedCategory);
      
      return {
        ...prev,
        [targetCategoryId]: updatedCategory
      };
    });
  };

  // **COMPLETELY FIXED: AI Actions handler with smart targeting**
  const handleAiActions = async (actions) => {
    console.log("🤖 Processing AI actions:", actions);
    
    for (const action of actions) {
      try {
        console.log(`🎬 Processing action:`, action);
        
        switch (action.type) {
          case 'create_list':
            const listName = action.data?.listName || action.data?.title || action.listName || 'New List';
            await createNewList(listName);
            break;
            
          case 'add_to_list':
            // **FIXED: Extract list hint from action data**
            const listHint = action.data?.listName || action.data?.targetName || action.data?.listType;
            const items = action.data?.items || [action.data?.text || action.item];
            
            console.log(`🎯 Adding items with hint: "${listHint}"`);
            
            // Find target list by hint first
            let targetListId = action.data?.targetId || action.listId;
            
            if (!targetListId && listHint) {
              const found = findListByName(listHint);
              if (found) {
                targetListId = found.id;
                console.log(`✅ Found target list "${found.list.title}" for hint "${listHint}"`);
              }
            }
            
            // Add each item
            for (const item of items) {
              await addToUserList(targetListId, item, listHint);
            }
            break;
            
          case 'create_schedule':
            const scheduleName = action.data?.title || action.data?.scheduleName || action.scheduleName || 'New Schedule';
            await createNewSchedule(scheduleName);
            break;
            
          case 'add_event':
            const scheduleHint = action.data?.scheduleName || action.data?.targetName;
            const eventData = action.data || action.event || {};
            
            let targetScheduleId = action.data?.targetId || action.scheduleId;
            if (!targetScheduleId && scheduleHint) {
              const found = findScheduleByName(scheduleHint);
              if (found) targetScheduleId = found.id;
            }
            
            await addToUserSchedule(targetScheduleId, eventData, scheduleHint);
            break;
            
          case 'create_memory':
            const memoryName = action.data?.title || action.data?.categoryName || action.categoryName || 'New Memory';
            await createNewMemoryCategory(memoryName);
            break;
            
          case 'store_memory':
            const memoryHint = action.data?.categoryName || action.data?.targetName;
            const memoryData = action.data || {};
            
            let targetMemoryId = action.data?.targetId || action.categoryId;
            if (!targetMemoryId && memoryHint) {
              const found = findMemoryByName(memoryHint);
              if (found) targetMemoryId = found.id;
            }
            
            await addToUserMemory(targetMemoryId, memoryData, memoryHint);
            break;
            
          case 'create_chat':
            const chatTitle = action.data?.title || action.data?.chatTitle || action.chatTitle || 'New Chat';
            await createNewChat(chatTitle);
            break;
            
          default:
            console.log('❓ Unknown action:', action);
        }
      } catch (error) {
        console.error(`❌ Error processing action ${action.type}:`, error);
      }
    }
  };

  return {
    userLists,
    userSchedules,
    userMemory,
    userChats,
    isLoading,
    createNewList,
    createNewSchedule,
    createNewMemoryCategory,
    createNewChat,
    addToUserList,
    addToUserSchedule,
    addToUserMemory,
    handleAiActions,
    loadUserData
  };
};

export default useDataManagement;