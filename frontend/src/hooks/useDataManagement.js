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

  // Load user data function
  const loadUserData = async () => {
    try {
      setIsLoading(true);
      console.log('📖 Loading user data...');
      
      const response = await fetch('http://localhost:3001/data/default');
      
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
      // Continue with empty data instead of crashing
    } finally {
      setIsLoading(false);
    }
  };

  // Handle AI actions
  const handleAiActions = (actions) => {
    if (!actions || !Array.isArray(actions)) {
      console.log('⚠️ No actions to process');
      return;
    }
  
    actions.forEach(action => {
      console.log('🎯 Processing AI action:', action);
      
      try {
        switch(action.type) {
          case 'create_list':
            console.log('📝 Creating list with data:', action.data);
            
            const listName = action.data?.name || 
                             action.data?.listName || 
                             action.data?.title || 
                             'New List';
                             
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
            
            const targetListName = action.data?.listName || 
                                    action.data?.targetList || 
                                    action.data?.name ||
                                    'Shopping List'; // Default fallback
                                    
            const itemsToAdd = action.data?.items || 
                              (action.data?.item ? [action.data.item] : []) ||
                              [];
            
            console.log(`➕ Adding ${itemsToAdd.length} items to "${targetListName}"`);
            
            setUserLists(prev => {
              // Find existing list or create new one
              let targetList = prev[targetListName];
              
              if (!targetList) {
                // Create list if it doesn't exist
                console.log(`📝 Creating new list "${targetListName}" while adding items`);
                targetList = {
                  name: targetListName,
                  items: [],
                  created: new Date(),
                  listType: 'custom',
                  id: Date.now()
                };
              }
              
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
              
              console.log('✅ Updated list:', updatedList);
              return { ...prev, [targetListName]: updatedList };
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
                                  
            const targetScheduleName = action.data?.schedule || 
                                       action.data?.scheduleName || 
                                       'Main Schedule';
            
            console.log(`📅 Adding event "${eventTitle}" to "${targetScheduleName}"`);
            
            setUserSchedules(prev => {
              let targetSchedule = prev[targetScheduleName];
              
              if (!targetSchedule) {
                console.log(`📅 Creating new schedule "${targetScheduleName}" while adding event`);
                targetSchedule = {
                  name: targetScheduleName,
                  events: [],
                  created: new Date(),
                  id: Date.now()
                };
              }
              
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
              
              console.log('✅ Updated schedule:', updatedSchedule);
              return { ...prev, [targetScheduleName]: updatedSchedule };
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
            console.log('🧠 Storing memory with data:', action.data);
            
            const memoryCategory = action.data?.category || 
                                   action.data?.categoryName || 
                                   'General';
                                   
            const memoryInfo = action.data?.info || 
                              action.data?.data || 
                              action.data?.content || 
                              action.data;
            
            console.log(`🧠 Storing memory in "${memoryCategory}"`);
            
            setUserMemory(prev => {
              let targetCategory = prev[memoryCategory];
              
              if (!targetCategory) {
                console.log(`🧠 Creating new memory category "${memoryCategory}" while storing`);
                targetCategory = {
                  category: memoryCategory,
                  items: [],
                  created: new Date(),
                  id: Date.now()
                };
              }
              
              const newMemoryItem = {
                id: Date.now(),
                content: typeof memoryInfo === 'string' ? memoryInfo : JSON.stringify(memoryInfo),
                addedAt: new Date(),
                ...memoryInfo // Spread the original info in case it's an object
              };
              
              const updatedCategory = {
                ...targetCategory,
                items: [...targetCategory.items, newMemoryItem],
                lastUpdated: new Date()
              };
              
              console.log('✅ Updated memory category:', updatedCategory);
              return { ...prev, [memoryCategory]: updatedCategory };
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
    loadUserData
  };
};

export default useDataManagement;