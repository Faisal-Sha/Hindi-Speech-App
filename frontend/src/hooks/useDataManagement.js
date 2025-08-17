// frontend/src/hooks/useDataManagement.js - ALL-IN-ONE VERSION
import { useState, useEffect, useCallback } from 'react';

const useDataManagement = (messages) => {
  console.log('🔧 useDataManagement hook initialized');
  
  // ===== STATE MANAGEMENT =====
  const [userLists, setUserLists] = useState({});
  const [userSchedules, setUserSchedules] = useState({});
  const [userMemory, setUserMemory] = useState({});
  const [userChats, setUserChats] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // ===== DATA TRANSFORMATION FUNCTION =====
  const transformBackendData = useCallback((rawData) => {
    console.log('🔄 Transforming backend data:', rawData);
    
    const result = {
      lists: {},
      schedules: {},
      memory: {}
    };

    // Transform Lists
    if (rawData.lists) {
      console.log('📋 Processing lists data:', rawData.lists);
      
      if (typeof rawData.lists === 'object' && rawData.lists !== null) {
        // Backend returns object of lists - process each one
        Object.entries(rawData.lists).forEach(([listKey, list]) => {
          result.lists[listKey] = {
            name: list.name || listKey,
            created: list.created_at || list.created || new Date(),
            updated: list.updated_at || list.updated || new Date(),
            // Check for items in various possible locations
            items: list.items || list.listItems || list.tasks || []
          };
          console.log(`✅ Processed list: ${listKey}`, result.lists[listKey]);
        });
      }
    }

    // Transform Schedules
    if (rawData.schedules) {
      console.log('📅 Processing schedules data:', rawData.schedules);
      
      if (typeof rawData.schedules === 'object' && rawData.schedules !== null) {
        // Backend returns object of schedules - process each one
        Object.entries(rawData.schedules).forEach(([scheduleKey, schedule]) => {
          result.schedules[scheduleKey] = {
            name: schedule.name || scheduleKey,
            created: schedule.created_at || schedule.created || new Date(),
            updated: schedule.updated_at || schedule.updated || new Date(),
            // Check for events in various possible locations
            events: schedule.events || schedule.scheduleEvents || schedule.appointments || []
          };
          console.log(`✅ Processed schedule: ${scheduleKey}`, result.schedules[scheduleKey]);
        });
      }
    }

    // Transform Memory
    if (rawData.memory) {
      console.log('🧠 Processing memory data:', rawData.memory);
      
      if (typeof rawData.memory === 'object' && rawData.memory !== null) {
        // Backend returns object of memory categories - process each one
        Object.entries(rawData.memory).forEach(([categoryKey, memoryCategory]) => {
          result.memory[categoryKey] = {
            name: memoryCategory.name || categoryKey,
            created: memoryCategory.created_at || memoryCategory.created || new Date(),
            updated: memoryCategory.updated_at || memoryCategory.updated || new Date(),
            // Check for items in various possible locations
            items: memoryCategory.items || memoryCategory.memoryItems || memoryCategory.data || []
          };
          console.log(`✅ Processed memory category: ${categoryKey}`, result.memory[categoryKey]);
        });
      }
    }

    console.log('🎯 Final transformed data:', result);
    console.log('📊 Transformation summary:', {
      listsCount: Object.keys(result.lists).length,
      schedulesCount: Object.keys(result.schedules).length,
      memoryCount: Object.keys(result.memory).length,
      listsWithItems: Object.values(result.lists).filter(list => list.items.length > 0).length,
      schedulesWithEvents: Object.values(result.schedules).filter(schedule => schedule.events.length > 0).length,
      memoryWithItems: Object.values(result.memory).filter(memory => memory.items.length > 0).length
    });
    
    return result;
  }, []);

  // ===== REAL DATA LOADING =====
  const loadUserData = useCallback(async (userId) => {
    console.log(`📥 Loading data for user: ${userId}`);
    setIsLoading(true);
    setCurrentUserId(userId);

    try {
      console.log('🌐 Fetching data from backend using /data endpoint...');
      
      // Use the correct endpoint that exists in your backend
      const response = await fetch(`http://localhost:3001/data/${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const rawData = await response.json();
      console.log('📦 Raw data from /data endpoint:', rawData);

      // Transform the data
      const transformedData = transformBackendData(rawData);

      // Update state with transformed data
      setUserLists(transformedData.lists);
      setUserSchedules(transformedData.schedules);
      setUserMemory(transformedData.memory);

      console.log('✅ Data loading and transformation completed successfully');
      console.log('📊 Final state will be:', {
        listsCount: Object.keys(transformedData.lists).length,
        schedulesCount: Object.keys(transformedData.schedules).length,
        memoryCount: Object.keys(transformedData.memory).length
      });

    } catch (error) {
      console.error('❌ Error loading user data:', error);
      
      // Reset to empty state on error
      setUserLists({});
      setUserSchedules({});
      setUserMemory({});
    } finally {
      setIsLoading(false);
    }
  }, [transformBackendData]);

  // ===== ACTION HANDLERS =====
  const handleAiActions = useCallback(async (actions, userId) => {
    console.log('🤖 Processing AI actions:', actions);
    
    if (!actions || actions.length === 0) {
      console.log('⚠️ No actions to process');
      return;
    }

    for (const action of actions) {
      console.log(`🔄 Processing action: ${action.type}`, action);
      
      try {
        // Use the /save-data-enhanced endpoint that exists in your backend
        const response = await fetch(`http://localhost:3001/save-data-enhanced`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            actions: [action] // Send as array since backend expects actions array
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Action ${action.type} processed successfully:`, result);
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to process action ${action.type}:`, errorText);
        }
        
      } catch (error) {
        console.error(`❌ Error processing action ${action.type}:`, error);
      }
    }
    
    // Reload data after processing actions
    console.log('🔄 Reloading data after actions...');
    await loadUserData(userId);
  }, [loadUserData]);

  // ===== DEBUG LOGGING =====
  useEffect(() => {
    console.log('📊 useDataManagement State Update:', {
      userListsCount: Object.keys(userLists).length,
      userListsKeys: Object.keys(userLists),
      userListsSample: Object.keys(userLists).length > 0 ? userLists[Object.keys(userLists)[0]] : null,
      userSchedulesCount: Object.keys(userSchedules).length,
      userSchedulesKeys: Object.keys(userSchedules),
      userSchedulesSample: Object.keys(userSchedules).length > 0 ? userSchedules[Object.keys(userSchedules)[0]] : null,
      userMemoryCount: Object.keys(userMemory).length,
      userMemoryKeys: Object.keys(userMemory),
      userMemorySample: Object.keys(userMemory).length > 0 ? userMemory[Object.keys(userMemory)[0]] : null,
      isLoading,
      currentUserId
    });
  }, [userLists, userSchedules, userMemory, isLoading, currentUserId]);

  // ===== RETURN VALUES =====
  return {
    // Data
    userLists,
    userSchedules,
    userMemory,
    userChats,
    
    // Loading state
    isLoading,
    
    // Functions
    loadUserData,
    handleAiActions,
    
    // Debug info
    debugInfo: {
      currentUserId,
      dataLoaded: !!(Object.keys(userLists).length || Object.keys(userSchedules).length || Object.keys(userMemory).length)
    }
  };
};

export default useDataManagement;