import { useState, useEffect, useCallback } from 'react';
import appService from '../services/AppService';

const useDataManagement = (messages, authToken) => { // Default empty array to prevent undefined errors
  // State for different data types
  const [userLists, setUserLists] = useState({});
  const [userSchedules, setUserSchedules] = useState({});
  const [userMemory, setUserMemory] = useState({});
  const [userChats, setUserChats] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // Load user data from backend on startup
  /*useEffect(() => {
    loadUserData();
  }, []); */

  // =====================================
  // AUTHENTICATED FETCH HELPER
  // =====================================
  
  const authenticatedFetch = async (url, options = {}, authToken) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        ...options.headers
      };
      
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Handle authentication errors
      if (response.status === 401) {
        throw new Error('Authentication required - please login again');
      }
      
      if (response.status === 403) {
        throw new Error('Access denied - you can only access your own family\'s data');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ Authenticated fetch error:', error);
      throw error;
    }
  };

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
  const loadUserData = useCallback(async (userId) => {
    console.log(`📥 Loading data for user: ${userId}`);
    setIsLoading(true);
    setCurrentUserId(userId);

    try {
      console.log('🌐 Fetching data from backend using /data endpoint...');
      
      // Use the correct endpoint that exists in your backend
      const response = await fetch(appService.user.data(userId), {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
     
      
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
  }, [authToken]);

  // Handle AI actions
  const handleAiActions = async (actions, userId = 'default') => {
    if (!actions || !Array.isArray(actions)) {
      console.log('⚠️ No actions to process');
      return;
    }
  
    actions.forEach(async (action) => {
      console.log('🎯 Processing AI action:', action);
      
      try {
        // STEP 1: Update local state (all your existing logic stays the same)
        switch(action.type) {
          case 'create_list':
            console.log('📝 Creating list with data:', action.data);
            
            const listName = action.data?.name || 
                            action.data?.listName || 
                            action.data?.title || 
                            `List ${Object.keys(userLists).length + 1}`;
                            
            const listType = action.data?.listType || 
                            action.data?.type || 
                            'custom';
                            
            const initialItems = action.data?.items || [];
            
            console.log(`📝 Creating list: "${listName}"`);
            
            setUserLists(prev => {
              const newList = {
                name: listName,
                items: initialItems.map((item, index) => ({
                  id: Date.now() + index,
                  text: typeof item === 'string' ? item : item.text || JSON.stringify(item),
                  completed: false,
                  addedAt: new Date()
                })),
                created: new Date(),
                listType: listType,
                id: Date.now()
              };
              
              console.log('✅ Created list:', newList);
              return { ...prev, [listName]: newList };
            });
            break;
  
          case 'add_to_list':
            console.log('➕ Adding to list with data:', action.data);
            
            const requestedListName = action.data?.listName || 
                                    action.data?.targetList || 
                                    action.data?.name ||
                                    action.data?.target ||
                                    'the list';
                                    
            const itemsToAdd = action.data?.items || 
                              (action.data?.item ? [action.data.item] : []) ||
                              [];
            
            console.log(`➕ Looking for list to add ${itemsToAdd.length} items. Requested: "${requestedListName}"`);
            
            setUserLists(prev => {
              const matchingListName = findBestMatchingItem(requestedListName, prev, 'list');
              
              if (matchingListName) {
                console.log(`✅ Adding items to existing list: "${matchingListName}"`);
                
                const targetList = prev[matchingListName];
                const newItems = itemsToAdd.map((item, index) => ({
                  id: Date.now() + index,
                  text: typeof item === 'string' ? item : item.text || JSON.stringify(item),
                  completed: false,
                  addedAt: new Date()
                }));
                
                const updatedList = {
                  ...targetList,
                  items: [...targetList.items, ...newItems],
                  lastUpdated: new Date()
                };
                
                console.log(`✅ Added ${newItems.length} items to list "${matchingListName}"`);
                return { ...prev, [matchingListName]: updatedList };
              } else {
                console.log(`➕ Creating new list "${requestedListName}" with items`);
                
                const finalListName = requestedListName === 'the list' ? 
                                      `List ${Object.keys(prev).length + 1}` : 
                                      requestedListName;
                
                const newList = {
                  name: finalListName,
                  items: itemsToAdd.map((item, index) => ({
                    id: Date.now() + index,
                    text: typeof item === 'string' ? item : item.text || JSON.stringify(item),
                    completed: false,
                    addedAt: new Date()
                  })),
                  created: new Date(),
                  listType: 'custom',
                  id: Date.now()
                };
                
                console.log('✅ Created new list:', newList);
                return { ...prev, [finalListName]: newList };
              }
            });
            break;
            
          case 'update_list':
            console.log('📝 Updating list items with data:', action.data);
            
            const targetList = action.data?.listName || action.data?.name;
            const itemId = action.data?.itemId;
            const operation = action.data?.operation;
            const newText = action.data?.newText;
            
            if (!targetList) {
              console.error('❌ Missing list name for update operation');
              break;
            }
            
            console.log(`📝 Updating list "${targetList}" - operation: ${operation}`);
            
            setUserLists(prev => {
              const matchingListName = findBestMatchingItem(targetList, prev, 'list');
              
              if (matchingListName && prev[matchingListName]) {
                const listToUpdate = prev[matchingListName];
                let updatedItems = [...listToUpdate.items];
                
                if (itemId) {
                  const itemIndex = updatedItems.findIndex(item => item.id === itemId);
                  if (itemIndex !== -1) {
                    switch (operation) {
                      case 'complete':
                        updatedItems[itemIndex] = { ...updatedItems[itemIndex], completed: true };
                        break;
                      case 'uncomplete':
                        updatedItems[itemIndex] = { ...updatedItems[itemIndex], completed: false };
                        break;
                      case 'delete':
                        updatedItems.splice(itemIndex, 1);
                        break;
                      case 'edit':
                        if (newText) {
                          updatedItems[itemIndex] = { ...updatedItems[itemIndex], text: newText };
                        }
                        break;
                      default:
                        console.error(`❌ Unknown operation: ${operation}`);
                        return prev;
                    }
                  }
                }
                
                const updatedList = {
                  ...listToUpdate,
                  items: updatedItems,
                  lastUpdated: new Date()
                };
                
                console.log(`✅ Updated list "${matchingListName}"`);
                return { ...prev, [matchingListName]: updatedList };
              } else {
                console.error(`❌ List "${targetList}" not found for update`);
                return prev;
              }
            });
            break;
        
        case 'delete_list':
          console.log('🗑️ Deleting list with data:', action.data);
          
          const listToDelete = action.data?.name || action.data?.listName;
          if (!listToDelete) {
            console.error('❌ No list name provided for deletion');
            break;
          }
          
          setUserLists(prev => {
            const matchingListName = findBestMatchingItem(listToDelete, prev, 'list');
            
            if (matchingListName && prev[matchingListName]) {
              console.log(`🗑️ Deleting list: "${matchingListName}"`);
              
              // Create new state without the deleted list
              const newState = { ...prev };
              delete newState[matchingListName];
              
              console.log(`✅ List "${matchingListName}" deleted from frontend state`);
              return newState;
            } else {
              console.error(`❌ List "${listToDelete}" not found for deletion`);
              return prev;
            }
          });
          break;
          
            
                    
        case 'create_schedule':
          console.log('📅 Creating schedule with data:', action.data);
          
          const scheduleName = action.data?.name || 
                                action.data?.scheduleName || 
                                action.data?.title || 
                                'New Schedule';
          
          console.log(`📅 Creating schedule: "${scheduleName}"`);
          
          setUserSchedules(prev => {
            const newSchedule = {
              name: scheduleName,
              events: [],
              created: new Date(),
              id: Date.now()
            };
            
            console.log('✅ Created schedule:', newSchedule);
            return { ...prev, [scheduleName]: newSchedule };
          });
          break;
            
          case 'add_event':
            console.log('📅 Adding event with data:', action.data);
            
            const eventTitle = action.data?.title || 
                              action.data?.name || 
                              action.data?.event || 
                              'New Event';
                              
            const eventTime = action.data?.time || 
                            action.data?.when || 
                            action.data?.datetime || 
                            'TBD';
                            
            const eventDuration = action.data?.duration || 
                                action.data?.length || 
                                null;
                                
            const eventLocation = action.data?.location || 
                                action.data?.where || 
                                null;
                                
            const requestedScheduleName = action.data?.schedule || 
                                        action.data?.scheduleName || 
                                        action.data?.target ||
                                        'Main Schedule';
            
            console.log(`📅 Looking for schedule to add event "${eventTitle}". Requested: "${requestedScheduleName}"`);
            
            setUserSchedules(prev => {
              // Use our smart matching function
              const matchingScheduleName = findBestMatchingItem(requestedScheduleName, prev, 'schedule');
              
              if (matchingScheduleName) {
                // Found existing schedule - add to it!
                console.log(`✅ Adding event to existing schedule: "${matchingScheduleName}"`);
                
                const targetSchedule = prev[matchingScheduleName];
                const newEvent = {
                  id: Date.now(),
                  title: eventTitle,
                  time: eventTime,
                  duration: eventDuration,
                  location: eventLocation,
                  addedAt: new Date()
                };
                
                const updatedSchedule = {
                  ...targetSchedule,
                  events: [...targetSchedule.events, newEvent],
                  lastUpdated: new Date()
                };
                
                console.log('✅ Updated existing schedule:', updatedSchedule);
                return { ...prev, [matchingScheduleName]: updatedSchedule };
                
              } else {
                // No existing schedule found - create new one
                console.log(`📅 Creating new schedule "${requestedScheduleName}" (no existing match found)`);
                
                const newSchedule = {
                  name: requestedScheduleName,
                  events: [{
                    id: Date.now(),
                    title: eventTitle,
                    time: eventTime,
                    duration: eventDuration,
                    location: eventLocation,
                    addedAt: new Date()
                  }],
                  created: new Date(),
                  id: Date.now()
                };
                
                console.log('✅ Created new schedule:', newSchedule);
                return { ...prev, [requestedScheduleName]: newSchedule };
              }
            });
            break;
          
            case 'rename_schedule':
              console.log('✏️ Renaming schedule with data:', action.data);
              
              const oldScheduleName = action.data?.oldName || action.data?.currentName;
              const newScheduleName = action.data?.newName || action.data?.name;
              
              if (!oldScheduleName || !newScheduleName) {
                console.error('❌ Missing oldName or newName for schedule rename');
                break;
              }
              
              setUserSchedules(prev => {
                const matchingScheduleName = findBestMatchingItem(oldScheduleName, prev, 'schedule');
                
                if (matchingScheduleName && prev[matchingScheduleName]) {
                  const scheduleToRename = prev[matchingScheduleName];
                  const updatedSchedule = {
                    ...scheduleToRename,
                    name: newScheduleName,
                    lastUpdated: new Date()
                  };
                  
                  const newState = { ...prev };
                  delete newState[matchingScheduleName];
                  newState[newScheduleName] = updatedSchedule;
                  
                  console.log(`✅ Renamed schedule "${matchingScheduleName}" to "${newScheduleName}"`);
                  return newState;
                } else {
                  console.error(`❌ Schedule "${oldScheduleName}" not found for renaming`);
                  return prev;
                }
              });
              break;
            
            case 'edit_event':
              console.log('📝 Editing event with data:', action.data);
              
              const editEventSchedule = action.data?.scheduleName || action.data?.schedule;
              const editEventId = action.data?.eventId;
              const eventUpdates = action.data?.updates || {};
              
              if (!editEventSchedule || !editEventId || !eventUpdates) {
                console.error('❌ Schedule name, event ID, and updates required for edit_event');
                break;
              }
              
              setUserSchedules(prev => {
                const matchingScheduleName = findBestMatchingItem(editEventSchedule, prev, 'schedule');
                
                if (matchingScheduleName && prev[matchingScheduleName]) {
                  const scheduleToUpdate = prev[matchingScheduleName];
                  let updatedEvents = [...scheduleToUpdate.events];
                  
                  // Find and update the event
                  const eventIndex = updatedEvents.findIndex(event => 
                    event.id === editEventId || event.id === parseInt(editEventId)
                  );
                  
                  if (eventIndex !== -1) {
                    const originalEvent = updatedEvents[eventIndex];
                    
                    // Apply updates to the event
                    updatedEvents[eventIndex] = {
                      ...originalEvent,
                      ...eventUpdates,
                      lastUpdated: new Date()
                    };
                    
                    console.log(`📝 Updated event "${originalEvent.title}" in schedule "${matchingScheduleName}"`);
                    console.log(`📝 Applied updates:`, Object.keys(eventUpdates));
                    
                    const updatedSchedule = {
                      ...scheduleToUpdate,
                      events: updatedEvents,
                      lastUpdated: new Date()
                    };
                    
                    return { ...prev, [matchingScheduleName]: updatedSchedule };
                  } else {
                    console.error(`❌ Event ${editEventId} not found in schedule "${matchingScheduleName}"`);
                    return prev;
                  }
                } else {
                  console.error(`❌ Schedule "${editEventSchedule}" not found for event editing`);
                  return prev;
                }
              });
              break;

            case 'delete_event':
              console.log('🗑️ Deleting event with data:', action.data);
              
              const deleteEventSchedule = action.data?.scheduleName || action.data?.schedule;
              const deleteEventId = action.data?.eventId;
              
              if (!deleteEventSchedule || !deleteEventId) {
                console.error('❌ Schedule name and event ID required for delete_event');
                break;
              }
              
              setUserSchedules(prev => {
                const matchingScheduleName = findBestMatchingItem(deleteEventSchedule, prev, 'schedule');
                
                if (matchingScheduleName && prev[matchingScheduleName]) {
                  const scheduleToUpdate = prev[matchingScheduleName];
                  let updatedEvents = [...scheduleToUpdate.events];
                  
                  // Find and remove the event
                  const eventIndex = updatedEvents.findIndex(event => 
                    event.id === deleteEventId || event.id === parseInt(deleteEventId)
                  );
                  
                  if (eventIndex !== -1) {
                    const deletedEvent = updatedEvents[eventIndex];
                    updatedEvents.splice(eventIndex, 1);
                    
                    console.log(`🗑️ Deleted event "${deletedEvent.title}" from schedule "${matchingScheduleName}"`);
                    
                    const updatedSchedule = {
                      ...scheduleToUpdate,
                      events: updatedEvents,
                      lastUpdated: new Date()
                    };
                    
                    return { ...prev, [matchingScheduleName]: updatedSchedule };
                  } else {
                    console.error(`❌ Event ${deleteEventId} not found in schedule "${matchingScheduleName}"`);
                    return prev;
                  }
                } else {
                  console.error(`❌ Schedule "${deleteEventSchedule}" not found for event deletion`);
                  return prev;
                }
              });
              break;
            
            case 'delete_schedule':
              console.log('🗑️ Deleting schedule with data:', action.data);
              
              const scheduleToDelete = action.data?.name || action.data?.scheduleName;
              if (!scheduleToDelete) {
                console.error('❌ No schedule name provided for deletion');
                break;
              }
              
              setUserSchedules(prev => {
                const matchingScheduleName = findBestMatchingItem(scheduleToDelete, prev, 'schedule');
                
                if (matchingScheduleName && prev[matchingScheduleName]) {
                  console.log(`🗑️ Deleting schedule: "${matchingScheduleName}"`);
                  
                  // Create new state without the deleted schedule
                  const newState = { ...prev };
                  delete newState[matchingScheduleName];
                  
                  console.log(`✅ Schedule "${matchingScheduleName}" deleted from frontend state`);
                  return newState;
                } else {
                  console.error(`❌ Schedule "${scheduleToDelete}" not found for deletion`);
                  return prev;
                }
              });
              break;
            
                      
          case 'create_memory':
            console.log('🧠 Creating memory category with data:', action.data);
            
            const memoryName = action.data?.name || 
                              action.data?.category || 
                              action.data?.title || 
                              'New Memory Category';
            
            console.log(`🧠 Creating memory category: "${memoryName}"`);
            
            setUserMemory(prev => {
              const newMemory = {
                category: memoryName,
                items: [],
                created: new Date(),
                id: Date.now()
              };
              
              console.log('✅ Created memory category:', newMemory);
              return { ...prev, [memoryName]: newMemory };
            });
            break;
            
            case 'store_memory':
              console.log('🧠 [DEBUG] Storing memory with raw action:', action);
              console.log('🧠 [DEBUG] Action type:', typeof action);
              console.log('🧠 [DEBUG] Action.data:', action.data);
              console.log('🧠 [DEBUG] Action.data type:', typeof action.data);
              
              // SAFE: Validate action structure before processing
              if (!action.data) {
                console.error('❌ [DEBUG] action.data is missing!', action);
                break;
              }
              
              const requestedMemoryCategory = action.data?.category || 
                                            action.data?.categoryName || 
                                            action.data?.target ||
                                            'General';
                                            
              const memoryKey = action.data?.memoryKey || 
                              action.data?.key ||
                              action.data?.name ||
                              `Memory_${Date.now()}`;
                              
              const memoryValue = action.data?.memoryValue ||
                                action.data?.value ||
                                action.data?.content ||
                                action.data?.info ||
                                'No content';
              
              console.log('🧠 [DEBUG] Extracted values:', {
                category: requestedMemoryCategory,
                key: memoryKey,
                value: memoryValue
              });
              
              // Continue with existing logic...
              setUserMemory(prev => {
                const matchingCategoryName = findBestMatchingItem(requestedMemoryCategory, prev, 'memory');
                
                if (matchingCategoryName) {
                  console.log(`✅ [DEBUG] Found existing category: "${matchingCategoryName}"`);
                  
                  const targetCategory = prev[matchingCategoryName];
                  const newMemoryItem = {
                    id: Date.now(),
                    key: memoryKey,
                    value: memoryValue,
                    content: typeof memoryValue === 'string' ? memoryValue : JSON.stringify(memoryValue),
                    created: new Date(),
                    type: action.data?.memoryType || 'fact'
                  };
                  
                  console.log('🧠 [DEBUG] Creating memory item:', newMemoryItem);
                  
                  const updatedItems = [...(targetCategory.items || []), newMemoryItem];
                  const updatedCategory = {
                    ...targetCategory,
                    items: updatedItems,
                    lastUpdated: new Date()
                  };
                  
                  console.log(`✅ [DEBUG] Updated category with ${updatedItems.length} items`);
                  return { ...prev, [matchingCategoryName]: updatedCategory };
                } else {
                  console.log(`📝 [DEBUG] Creating new category: "${requestedMemoryCategory}"`);
                  
                  const newMemoryItem = {
                    id: Date.now(),
                    key: memoryKey,
                    value: memoryValue,
                    content: typeof memoryValue === 'string' ? memoryValue : JSON.stringify(memoryValue),
                    created: new Date(),
                    type: action.data?.memoryType || 'fact'
                  };
                  
                  const newCategory = {
                    name: requestedMemoryCategory,
                    items: [newMemoryItem],
                    created: new Date(),
                    lastUpdated: new Date(),
                    id: Date.now()
                  };
                  
                  console.log(`✅ [DEBUG] Created new category with item:`, newCategory);
                  return { ...prev, [requestedMemoryCategory]: newCategory };
                }
              });
              break;

          
            case 'rename_memory':
              console.log('✏️ Renaming memory category with data:', action.data);
              
              const oldMemoryName = action.data?.oldName || action.data?.currentName;
              const newMemoryName = action.data?.newName || action.data?.name;
              
              setUserMemory(prev => {
                const matchingMemoryName = findBestMatchingItem(oldMemoryName, prev, 'memory');
                
                if (matchingMemoryName && prev[matchingMemoryName]) {
                  const memoryToRename = prev[matchingMemoryName];
                  const updatedMemory = {
                    ...memoryToRename,
                    category: newMemoryName,
                    lastUpdated: new Date()
                  };
                  
                  const newState = { ...prev };
                  delete newState[matchingMemoryName];
                  newState[newMemoryName] = updatedMemory;
                  
                  console.log(`✅ Renamed memory "${matchingMemoryName}" to "${newMemoryName}"`);
                  return newState;
                } else {
                  console.error(`❌ Memory category "${oldMemoryName}" not found for renaming`);
                  return prev;
                }
              });
              break;
            
            
              case 'update_memory':
                console.log('📝 Updating memory with data:', action.data);
                
                const targetMemory = action.data?.categoryName || action.data?.category;
                const memoryItemId = action.data?.itemId;
                const memoryOperation = action.data?.operation; // 'edit', 'delete'
                const memoryUpdates = action.data?.updates || {};
                
                setUserMemory(prev => {
                  const matchingMemoryName = findBestMatchingItem(targetMemory, prev, 'memory');
                  
                  if (matchingMemoryName && prev[matchingMemoryName]) {
                    const memoryToUpdate = prev[matchingMemoryName];
                    let updatedItems = [...memoryToUpdate.items];
                    
                    if (memoryItemId) {
                      const itemIndex = updatedItems.findIndex(item => item.id === memoryItemId);
                      if (itemIndex !== -1) {
                        switch (memoryOperation) {
                          case 'edit':
                            updatedItems[itemIndex] = { 
                              ...updatedItems[itemIndex], 
                              ...memoryUpdates,
                              lastUpdated: new Date() 
                            };
                            console.log(`✅ Updated memory item: ${updatedItems[itemIndex].key || updatedItems[itemIndex].memoryKey}`);
                            break;
                          case 'delete':
                            const deletedItem = updatedItems[itemIndex];
                            updatedItems.splice(itemIndex, 1);
                            console.log(`🗑️ Deleted memory item: ${deletedItem.key || deletedItem.memoryKey}`);
                            break;
                          default:
                            console.error(`❌ Unknown memory operation: ${memoryOperation}`);
                            return prev;
                        }
                        
                        const updatedMemory = {
                          ...memoryToUpdate,
                          items: updatedItems,
                          lastUpdated: new Date()
                        };
                        
                        return { ...prev, [matchingMemoryName]: updatedMemory };
                      } else {
                        console.error(`❌ Memory item ${memoryItemId} not found in category "${matchingMemoryName}"`);
                        return prev;
                      }
                    } else {
                      console.error('❌ Memory item ID required for update operation');
                      return prev;
                    }
                  } else {
                    console.error(`❌ Memory category "${targetMemory}" not found for update`);
                    return prev;
                  }
                });
                break;
              
              // Add this new case after the existing cases:
              case 'delete_memory_item':
                console.log('🗑️ Deleting memory item with data:', action.data);
                
                const deleteMemoryCategory = action.data?.categoryName || action.data?.category;
                const deleteMemoryItemId = action.data?.itemId;
                
                setUserMemory(prev => {
                  const matchingMemoryName = findBestMatchingItem(deleteMemoryCategory, prev, 'memory');
                  
                  if (matchingMemoryName && prev[matchingMemoryName]) {
                    const memoryToUpdate = prev[matchingMemoryName];
                    let updatedItems = [...memoryToUpdate.items];
                    
                    const itemIndex = updatedItems.findIndex(item => item.id === deleteMemoryItemId);
                    if (itemIndex !== -1) {
                      const deletedItem = updatedItems[itemIndex];
                      updatedItems.splice(itemIndex, 1);
                      
                      console.log(`🗑️ Deleted memory item: ${deletedItem.key || deletedItem.memoryKey}`);
                      
                      const updatedMemory = {
                        ...memoryToUpdate,
                        items: updatedItems,
                        lastUpdated: new Date()
                      };
                      
                      return { ...prev, [matchingMemoryName]: updatedMemory };
                    } else {
                      console.error(`❌ Memory item ${deleteMemoryItemId} not found in category "${matchingMemoryName}"`);
                      return prev;
                    }
                  } else {
                    console.error(`❌ Memory category "${deleteMemoryCategory}" not found for item deletion`);
                    return prev;
                  }
                });
                break;

              case 'delete_memory':
                console.log('🗑️ Deleting memory category with data:', action.data);
                
                const memoryToDelete = action.data?.name || action.data?.category;
                
                setUserMemory(prev => {
                  const matchingMemoryName = findBestMatchingItem(memoryToDelete, prev, 'memory');
                  
                  if (matchingMemoryName && prev[matchingMemoryName]) {
                    const newState = { ...prev };
                    delete newState[matchingMemoryName];
                    
                    console.log(`✅ Deleted memory category "${matchingMemoryName}"`);
                    return newState;
                  } else {
                    console.error(`❌ Memory category "${memoryToDelete}" not found for deletion`);
                    return prev;
                  }
                });
                break;
                      
          default:
            console.log('❓ Unknown action type:', action.type);
            console.log('Available action types: create_list, add_to_list, create_schedule, add_event, create_memory, store_memory');
        }

      } catch (error) {
        console.error(`❌ Error processing action ${action.type}:`, error);
        console.log('Action data was:', action);
      }
    });
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
    loadUserData, 
    authenticatedFetch: (url, options = {}, authToken) => 
      authenticatedFetch(url, options, authToken), 
  };
};

export default useDataManagement;