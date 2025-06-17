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

  // Load data from backend (unchanged)
  const loadUserData = async () => {
    try {
      setIsLoading(true);
      console.log('📖 Loading user data from backend...');
      
      const response = await fetch(`${API_BASE}/data/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to load data');
      }
      
      const data = await response.json();
      console.log('✅ Loaded data:', data);
      
      setUserLists(data.lists || {});
      setUserSchedules(data.schedules || {});
      setUserMemory(data.memory || {});
      setUserChats(prev => ({
        ...prev,
        ...data.chats || {}
      }));
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // **NEW: Save entire object (only for new creations)**
  const saveCompleteItem = async (dataType, itemId, itemData) => {
    try {
      console.log(`💾 Saving complete ${dataType}/${itemId}...`);
      
      const response = await fetch(`${API_BASE}/save-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dataType,
          dataKey: itemId,
          dataValue: itemData
        })
      });
      
      if (!response.ok) throw new Error('Failed to save complete item');
      console.log(`✅ Saved complete ${dataType}/${itemId}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving complete item:', error);
      return false;
    }
  };

  // **NEW: Add single item only (much more efficient)**
  const addSingleItem = async (dataType, parentId, newItem) => {
    try {
      console.log(`➕ Adding single item to ${dataType}/${parentId}:`, newItem);
      
      const response = await fetch(`${API_BASE}/add-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dataType,
          parentId,
          newItem
        })
      });
      
      if (!response.ok) throw new Error('Failed to add single item');
      console.log(`✅ Added single item to ${dataType}/${parentId}`);
      return true;
    } catch (error) {
      console.error('❌ Error adding single item:', error);
      return false;
    }
  };

  // **NEW: Update metadata only (timestamps, counts)**
  const updateMetadata = async (dataType, itemId, metadata) => {
    try {
      console.log(`🔄 Updating metadata for ${dataType}/${itemId}`);
      
      const response = await fetch(`${API_BASE}/update-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          dataType,
          itemId,
          metadata
        })
      });
      
      if (!response.ok) throw new Error('Failed to update metadata');
      console.log(`✅ Updated metadata for ${dataType}/${itemId}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating metadata:', error);
      return false;
    }
  };

  const generateId = () => Date.now().toString();

  // **OPTIMIZED: Create new list (save complete object once)**
  const createNewList = async (listName) => {
    const listId = generateId();
    const newList = {
      title: listName,
      items: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    console.log(`📝 Creating new list: ${listName}`);
    
    // Update local state immediately
    setUserLists(prev => ({
      ...prev,
      [listId]: newList
    }));
    
    // Save complete new list to backend (only time we save the whole thing)
    await saveCompleteItem('lists', listId, newList);
    return listId;
  };

  // **OPTIMIZED: Create new schedule**
  const createNewSchedule = async (scheduleName) => {
    const scheduleId = generateId();
    const newSchedule = {
      title: scheduleName,
      events: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    console.log(`📅 Creating new schedule: ${scheduleName}`);
    
    setUserSchedules(prev => ({
      ...prev,
      [scheduleId]: newSchedule
    }));
    
    await saveCompleteItem('schedules', scheduleId, newSchedule);
    return scheduleId;
  };

  // **OPTIMIZED: Create new memory category**
  const createNewMemoryCategory = async (categoryName) => {
    const categoryId = generateId();
    const newCategory = {
      title: categoryName,
      items: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    console.log(`🧠 Creating new memory category: ${categoryName}`);
    
    setUserMemory(prev => ({
      ...prev,
      [categoryId]: newCategory
    }));
    
    await saveCompleteItem('memory', categoryId, newCategory);
    return categoryId;
  };

  // **OPTIMIZED: Create new chat**
  const createNewChat = async (chatTitle) => {
    const chatId = generateId();
    const newChat = {
      title: chatTitle,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    console.log(`💬 Creating new chat: ${chatTitle}`);
    
    setUserChats(prev => ({
      ...prev,
      [chatId]: newChat
    }));
    
    await saveCompleteItem('chats', chatId, newChat);
    return chatId;
  };

  // **SUPER OPTIMIZED: Add to list (only save the new item!)**
  const addToUserList = async (listId, item) => {
    console.log(`📝 Adding "${item}" to list ${listId}`);
    
    // Create the new item object
    const newItem = {
      id: Date.now(),
      text: item,
      completed: false,
      addedAt: new Date()
    };
    
    setUserLists(prev => {
      let targetList = prev[listId];
      
      // If list doesn't exist, create it first
      if (!targetList) {
        console.log('List not found, creating new list');
        const newListId = generateId();
        const newList = {
          title: "Quick List",
          items: [newItem],
          createdAt: new Date(),
          lastUpdated: new Date()
        };
        
        // Save complete new list (since it's new)
        saveCompleteItem('lists', newListId, newList);
        
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
      
      // **OPTIMIZATION: Only save the new item + update metadata**
      addSingleItem('lists', listId, newItem);
      updateMetadata('lists', listId, { lastUpdated: new Date(), itemCount: updatedList.items.length });
      
      return {
        ...prev,
        [listId]: updatedList
      };
    });
  };

  // **SUPER OPTIMIZED: Add to schedule (only save the new event!)**
  const addToUserSchedule = async (scheduleId, event) => {
    console.log(`📅 Adding event to schedule ${scheduleId}:`, event);
    
    const newEvent = {
      ...event,
      id: Date.now(),
      addedAt: new Date()
    };
    
    setUserSchedules(prev => {
      const targetSchedule = prev[scheduleId];
      
      if (!targetSchedule) {
        console.log('Schedule not found, creating new schedule');
        const newScheduleId = generateId();
        const newSchedule = {
          title: "My Schedule",
          events: [newEvent],
          createdAt: new Date(),
          lastUpdated: new Date()
        };
        
        saveCompleteItem('schedules', newScheduleId, newSchedule);
        
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
      
      // **OPTIMIZATION: Only save the new event + update metadata**
      addSingleItem('schedules', scheduleId, newEvent);
      updateMetadata('schedules', scheduleId, { lastUpdated: new Date(), eventCount: updatedSchedule.events.length });
      
      return {
        ...prev,
        [scheduleId]: updatedSchedule
      };
    });
  };

  // **SUPER OPTIMIZED: Add to memory (only save the new memory item!)**
  const addToUserMemory = async (categoryId, data) => {
    console.log(`🧠 Adding to memory category ${categoryId}:`, data);
    
    const newMemoryItem = {
      ...data,
      id: Date.now(),
      addedAt: new Date()
    };
    
    setUserMemory(prev => {
      const targetCategory = prev[categoryId];
      
      if (!targetCategory) {
        console.log('Memory category not found, creating new category');
        const newCategoryId = generateId();
        const newCategory = {
          title: "General Memory",
          items: [newMemoryItem],
          createdAt: new Date(),
          lastUpdated: new Date()
        };
        
        saveCompleteItem('memory', newCategoryId, newCategory);
        
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
      
      // **OPTIMIZATION: Only save the new memory item + update metadata**
      addSingleItem('memory', categoryId, newMemoryItem);
      updateMetadata('memory', categoryId, { lastUpdated: new Date(), itemCount: updatedCategory.items.length });
      
      return {
        ...prev,
        [categoryId]: updatedCategory
      };
    });
  };

  // **ENHANCED: AI Actions handler (unchanged logic)**
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
            const listIds = Object.keys(userLists);
            let targetListId = action.data?.targetId || action.listId;
            
            if (!targetListId && listIds.length > 0) {
              targetListId = listIds[listIds.length - 1];
            }
            
            const items = action.data?.items || [action.data?.text || action.item];
            
            if (targetListId) {
              for (const item of items) {
                await addToUserList(targetListId, item);
              }
            } else {
              const newListId = await createNewList('Quick List');
              for (const item of items) {
                await addToUserList(newListId, item);
              }
            }
            break;
            
          case 'create_schedule':
            const scheduleName = action.data?.title || action.data?.scheduleName || action.scheduleName || 'New Schedule';
            await createNewSchedule(scheduleName);
            break;
            
          case 'add_event':
            const scheduleIds = Object.keys(userSchedules);
            let targetScheduleId = action.data?.targetId || action.scheduleId;
            
            if (!targetScheduleId && scheduleIds.length > 0) {
              targetScheduleId = scheduleIds[scheduleIds.length - 1];
            }
            
            const eventData = action.data || action.event || {};
            
            if (targetScheduleId) {
              await addToUserSchedule(targetScheduleId, eventData);
            } else {
              const newScheduleId = await createNewSchedule('My Schedule');
              await addToUserSchedule(newScheduleId, eventData);
            }
            break;
            
          case 'create_memory':
            const memoryName = action.data?.title || action.data?.categoryName || action.categoryName || 'New Memory';
            await createNewMemoryCategory(memoryName);
            break;
            
          case 'store_memory':
            const memoryIds = Object.keys(userMemory);
            let targetMemoryId = action.data?.targetId || action.categoryId;
            
            if (!targetMemoryId && memoryIds.length > 0) {
              targetMemoryId = memoryIds[memoryIds.length - 1];
            }
            
            const memoryData = action.data || {};
            
            if (targetMemoryId) {
              await addToUserMemory(targetMemoryId, memoryData);
            } else {
              const newMemoryId = await createNewMemoryCategory('General Memory');
              await addToUserMemory(newMemoryId, memoryData);
            }
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