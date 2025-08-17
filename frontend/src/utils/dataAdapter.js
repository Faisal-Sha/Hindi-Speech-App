// This file transforms backend data structure to frontend-expected structure

export const adaptBackendDataToFrontend = (backendData) => {
    console.log('🔄 Adapting backend data:', backendData);
    
    const adapted = {
      lists: {},
      schedules: {},
      memory: {}
    };
  
    // Transform lists
    if (backendData.lists && Array.isArray(backendData.lists)) {
      backendData.lists.forEach(list => {
        const listKey = list.name || `list-${list.id}`;
        adapted.lists[listKey] = {
          name: list.name,
          created: list.created_at || list.created || new Date(),
          updated: list.updated_at || list.updated || new Date(),
          items: list.items || [] // Backend should provide items array
        };
      });
    }
  
    // Transform schedules
    if (backendData.schedules && Array.isArray(backendData.schedules)) {
      backendData.schedules.forEach(schedule => {
        const scheduleKey = schedule.name || `schedule-${schedule.id}`;
        adapted.schedules[scheduleKey] = {
          name: schedule.name,
          created: schedule.created_at || schedule.created || new Date(),
          updated: schedule.updated_at || schedule.updated || new Date(),
          events: schedule.events || [] // Backend should provide events array
        };
      });
    }
  
    // Transform memory
    if (backendData.memory && Array.isArray(backendData.memory)) {
      backendData.memory.forEach(memoryCategory => {
        const categoryKey = memoryCategory.name || `memory-${memoryCategory.id}`;
        adapted.memory[categoryKey] = {
          name: memoryCategory.name,
          created: memoryCategory.created_at || memoryCategory.created || new Date(),
          updated: memoryCategory.updated_at || memoryCategory.updated || new Date(),
          items: memoryCategory.items || [] // Backend should provide items array
        };
      });
    }
  
    console.log('✅ Adapted data:', adapted);
    return adapted;
  };
  
  // Alternative adapter if your backend data is already in object format
  export const adaptBackendDataToFrontendFromObject = (backendData) => {
    console.log('🔄 Adapting backend data (object format):', backendData);
    
    const adapted = {
      lists: {},
      schedules: {},
      memory: {}
    };
  
    // If backend returns lists as an object
    if (backendData.lists && typeof backendData.lists === 'object') {
      Object.entries(backendData.lists).forEach(([key, list]) => {
        adapted.lists[key] = {
          name: list.name || key,
          created: list.created_at || list.created || new Date(),
          updated: list.updated_at || list.updated || new Date(),
          items: list.items || []
        };
      });
    }
  
    // If backend returns schedules as an object
    if (backendData.schedules && typeof backendData.schedules === 'object') {
      Object.entries(backendData.schedules).forEach(([key, schedule]) => {
        adapted.schedules[key] = {
          name: schedule.name || key,
          created: schedule.created_at || schedule.created || new Date(),
          updated: schedule.updated_at || schedule.updated || new Date(),
          events: schedule.events || []
        };
      });
    }
  
    // If backend returns memory as an object
    if (backendData.memory && typeof backendData.memory === 'object') {
      Object.entries(backendData.memory).forEach(([key, memoryCategory]) => {
        adapted.memory[key] = {
          name: memoryCategory.name || key,
          created: memoryCategory.created_at || memoryCategory.created || new Date(),
          updated: memoryCategory.updated_at || memoryCategory.updated || new Date(),
          items: memoryCategory.items || []
        };
      });
    }
  
    console.log('✅ Adapted data:', adapted);
    return adapted;
  };