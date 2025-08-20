// backend/action-processor.js
const { AISmartMatcher } = require('./ai-matcher');
const { SmartDateParser } = require('./date-parser');

/**
 * Enhanced Smart Action Processor with AI Matching
 * This is the MAIN processor that handles all actions
 */
class EnhancedSmartActionProcessor {
    constructor(databaseFunctions, openaiInstance) {
      this.db = databaseFunctions;
      this.aiMatcher = new AISmartMatcher(openaiInstance);
      this.dateParser = new SmartDateParser();
    }
  
    /**
     * Process any AI action intelligently
     */
    async processAction(action, userId) {
      try {
        console.log('🧠 Smart processing action:', action);
        
        const { type, intent, data, metadata } = action;
        
        switch(type) {
          case 'smart_create':
            return await this.handleSmartCreate(data, userId);
            
          case 'smart_add':
            return await this.handleSmartAdd(data, userId);
            
          case 'smart_update':
            return await this.handleSmartUpdate(data, userId);
            
          case 'smart_delete':
            return await this.handleSmartDelete(data, userId);
            
          case 'smart_schedule':
            return await this.handleSmartSchedule(data, userId);
            
          case 'smart_remember':
            return await this.handleSmartRemember(data, userId);
            
          case 'query_data':
          case 'count_events':
          case 'list_items':
          case 'memory_search':
            return await this.handleDataQuery(data || action, userId);
            
          default:
            // Fallback to legacy action handling for backward compatibility
            return await this.handleLegacyAction(action, userId);
        }
      } catch (error) {
        console.error('❌ Error in smart processing:', error);
        throw error;
      }
    }
  
    /**
     * Handle smart creation with AI naming
     */
    async handleSmartCreate(data, userId) {
      const { target, operation, values, metadata } = data;
      
      console.log(`📝 Enhanced smart creating: "${target}"`);
      
      switch(operation) {
        case 'create_list':
          // Let AI generate a smart name
          const existingLists = await this.db.getUserLists(userId);
          const existingNames = Object.keys(existingLists);
          
          const smartName = await this.aiMatcher.generateSmartName(
            target, 
            existingNames, 
            { type: 'list', items: values }
          );
          
          console.log(`🎯 AI chose name: "${smartName}"`);
          
          const listType = this.inferListType(smartName, values);
          const listResult = await this.db.createUserList(userId, smartName, listType);
          
          // Add initial items
          if (values && values.length > 0) {
            for (const item of values) {
              await this.db.addItemToList(userId, smartName, item);
            }
          }
          
          return {
            success: true,
            type: 'list_created',
            details: {
              name: smartName,
              originalRequest: target,
              type: listType,
              initialItems: values.length
            }
          };
          
        case 'create_schedule':
          const existingSchedules = await this.db.getUserSchedules(userId);
          const existingScheduleNames = Object.keys(existingSchedules);
          
          const smartScheduleName = await this.aiMatcher.generateSmartName(
            target,
            existingScheduleNames,
            { type: 'schedule' }
          );
          
          const scheduleResult = await this.db.createUserSchedule(userId, smartScheduleName, 'personal');
          
          return {
            success: true,
            type: 'schedule_created',
            details: { 
              name: smartScheduleName,
              originalRequest: target
            }
          };
          
        case 'create_memory':
          const existingMemory = await this.db.getUserMemories(userId);
          const existingMemoryNames = Object.keys(existingMemory);
          
          const smartMemoryName = await this.aiMatcher.generateSmartName(
            target,
            existingMemoryNames,
            { type: 'memory' }
          );
          
          const memoryResult = await this.db.createMemoryCategory(userId, smartMemoryName);
          
          return {
            success: true,
            type: 'memory_created',
            details: { 
              category: smartMemoryName,
              originalRequest: target
            }
          };
          
        default:
          throw new Error(`Unknown create operation: ${operation}`);
      }
    }
  
    /**
     * Handle smart addition with AI matching
     */
    async handleSmartAdd(data, userId) {
      const { target, operation, values, metadata } = data;
      
      console.log(`➕ Smart adding to: "${target}"`);
      
      switch(operation) {
        case 'add_to_list':
          const allLists = await this.db.getUserLists(userId);
          const targetList = await this.aiMatcher.findBestListMatch(target, allLists);
          
          if (!targetList) {
            // AI couldn't find a match - maybe create new list?
            return await this.handleSmartCreate({
              target,
              operation: 'create_list',
              values
            }, userId);
          }
          
          // Add items to matched list
          for (const item of values) {
            await this.db.addItemToList(userId, targetList, item);
          }
          
          return {
            success: true,
            type: 'items_added',
            details: {
              targetList,
              originalRequest: target,
              itemsAdded: values.length,
              items: values,
              aiDecision: true
            }
          };
          
        case 'add_event':
          const allSchedules = await this.db.getUserSchedules(userId);
          const targetSchedule = await this.aiMatcher.findBestScheduleMatch(target, allSchedules);
          
          if (!targetSchedule) {
            // Create new schedule if none found
            return await this.handleSmartCreate({
              target,
              operation: 'create_schedule',
              values
            }, userId);
          }
          
          // Add event to matched schedule
          for (const event of values) {
            const eventDetails = this.parseEventDetails(event, metadata);
            await this.db.addEventToSchedule(userId, targetSchedule, eventDetails);
          }
          
          return {
            success: true,
            type: 'events_added',
            details: {
              targetSchedule,
              originalRequest: target,
              eventsAdded: values.length,
              aiDecision: true
            }
          };
          
        case 'store_memory':
          const allMemory = await this.db.getUserMemories(userId);
          const targetCategory = await this.aiMatcher.findBestMemoryMatch(target, allMemory);
          
          if (!targetCategory) {
            // Create new memory category
            return await this.handleSmartCreate({
              target,
              operation: 'create_memory',
              values
            }, userId);
          }
          
          // Add memory items
          for (const item of values) {
            const memoryItem = this.parseMemoryItem(item);
            await this.db.addMemoryItem(userId, targetCategory, memoryItem);
          }
          
          return {
            success: true,
            type: 'memory_stored',
            details: {
              targetCategory,
              originalRequest: target,
              itemsStored: values.length,
              aiDecision: true
            }
          };
          
        default:
          throw new Error(`Unknown add operation: ${operation}`);
      }
    }
  
    /**
 * Handle smart updates with AI matching and context understanding
 */
async handleSmartUpdate(data, userId) {
  const { target, operation, values, metadata } = data;
  
  console.log(`🔄 Smart updating: "${target}" with operation: ${operation}`);
  
  switch(operation) {
    case 'prepare_edit':
      // Just acknowledge that we're ready to edit - no actual changes yet
      return {
        success: true,
        type: 'edit_prepared',
        details: {
          target,
          message: 'Ready to edit. What changes would you like to make?'
        }
      };

    // ===== LIST ITEM OPERATIONS =====
    case 'update_item':
      // Handle list item updates (edit text or toggle completion)
      const listName = metadata.listName || target;
      
      if (metadata.updates.text !== undefined) {
        // Edit item text
        console.log(`📝 Editing item ${metadata.itemId} in list "${listName}"`);
        await this.db.updateListItemText(userId, listName, metadata.itemId, metadata.updates.text);
        
        return {
          success: true,
          type: 'list_item_updated',
          details: { 
            listName, 
            itemId: metadata.itemId, 
            operation: 'text_update',
            newText: metadata.updates.text
          }
        };
      }
      
      if (metadata.updates.completed !== undefined) {
        // Toggle completion status
        console.log(`🔄 Toggling completion for item ${metadata.itemId} in list "${listName}"`);
        await this.db.updateListItemStatus(userId, listName, metadata.itemId, metadata.updates.completed);
        
        return {
          success: true,
          type: 'list_item_updated',
          details: { 
            listName, 
            itemId: metadata.itemId, 
            operation: 'completion_toggle',
            completed: metadata.updates.completed
          }
        };
      }
      
      return { success: false, error: 'No valid updates provided for list item' };

    // ===== EVENT OPERATIONS =====
    case 'update_event':
      const scheduleName = metadata.scheduleName || target;
      
      console.log(`📝 Updating event ${metadata.eventId} in schedule "${scheduleName}"`);
      await this.db.updateEvent(userId, scheduleName, metadata.eventId, metadata.updates);
      
      return {
        success: true,
        type: 'event_updated',
        details: {
          scheduleName,
          eventId: metadata.eventId,
          updates: metadata.updates
        }
      };

    // ===== MEMORY OPERATIONS =====
    case 'update_memory':
      const categoryName = metadata.categoryName || target;
      
      console.log(`🧠 Updating memory item ${metadata.itemId} in category "${categoryName}"`);
      await this.db.updateMemoryItem(userId, categoryName, metadata.itemId, metadata.updates);
      
      return {
        success: true,
        type: 'memory_updated',
        details: {
          categoryName,
          itemId: metadata.itemId,
          updates: metadata.updates
        }
      };

    // ===== LEGACY OPERATIONS (for backward compatibility) =====
    case 'edit_list':
    case 'update_list':
      const allLists = await this.db.getUserLists(userId);
      const targetList = await this.aiMatcher.findBestListMatch(target, allLists);
      
      if (!targetList) {
        return { 
          success: false, 
          error: `Could not find list matching "${target}"` 
        };
      }
      
      // Handle different types of list updates
      if (values && values.length > 0) {
        // Add new items to the list
        for (const item of values) {
          await this.db.addItemToList(userId, targetList, item);
        }
      }
      
      return {
        success: true,
        type: 'list_updated',
        details: {
          targetList,
          originalRequest: target,
          itemsAdded: values?.length || 0,
          aiDecision: true
        }
      };

    default:
      return {
        success: false,
        error: `Unknown update operation: ${operation}`
      };
  }
}

/**
 * Handle smart deletion with AI matching
 */
async handleSmartDelete(data, userId) {
  const { target, operation, metadata } = data;
  
  console.log(`🗑️ Smart deleting: "${target}" with operation: ${operation}`);
  
  switch(operation) {
    // ===== LIST OPERATIONS =====
    case 'delete_item':
      const listName = metadata.listName || target;
      
      console.log(`🗑️ Deleting item ${metadata.itemId} from list "${listName}"`);
      await this.db.deleteListItem(userId, listName, metadata.itemId);
      
      return { 
        success: true, 
        type: 'list_item_deleted', 
        details: { 
          listName, 
          itemId: metadata.itemId 
        }
      };

    case 'delete_list':
      console.log(`🗑️ Deleting entire list "${target}"`);
      await this.db.deleteUserList(userId, target);
      
      return { 
        success: true, 
        type: 'list_deleted', 
        details: { listName: target }
      };

    // ===== SCHEDULE OPERATIONS =====
    case 'delete_event':
      const scheduleName = metadata.scheduleName || target;
      
      console.log(`🗑️ Deleting event ${metadata.eventId} from schedule "${scheduleName}"`);
      await this.db.deleteEvent(userId, scheduleName, metadata.eventId);
      
      return { 
        success: true, 
        type: 'event_deleted', 
        details: { 
          scheduleName, 
          eventId: metadata.eventId 
        }
      };

    case 'delete_schedule':
      console.log(`🗑️ Deleting entire schedule "${target}"`);
      await this.db.deleteUserSchedule(userId, target);
      
      return { 
        success: true, 
        type: 'schedule_deleted', 
        details: { scheduleName: target }
      };

    // ===== MEMORY OPERATIONS =====
    case 'delete_memory_item':
      const categoryName = metadata.categoryName || target;
      
      console.log(`🗑️ Deleting memory item ${metadata.itemId} from category "${categoryName}"`);
      await this.db.deleteMemoryItem(userId, categoryName, metadata.itemId);
      
      return { 
        success: true, 
        type: 'memory_item_deleted', 
        details: { 
          categoryName, 
          itemId: metadata.itemId 
        }
      };

    case 'delete_memory':
      console.log(`🗑️ Deleting entire memory category "${target}"`);
      await this.db.deleteMemoryCategory(userId, target);
      
      return { 
        success: true, 
        type: 'memory_deleted', 
        details: { categoryName: target }
      };

    // ===== FALLBACK FOR AI-MATCHED DELETIONS =====
    default:
      // Try to match using AI for ambiguous requests
      if (!operation) {
        // Try lists first
        const allLists = await this.db.getUserLists(userId);
        const listToDelete = await this.aiMatcher.findBestListMatch(target, allLists);
        
        if (listToDelete) {
          await this.db.deleteUserList(userId, listToDelete);
          return { 
            success: true, 
            type: 'list_deleted', 
            details: { listName: listToDelete, aiDecision: true }
          };
        }
        
        // Try schedules
        const allSchedules = await this.db.getUserSchedules(userId);
        const scheduleToDelete = await this.aiMatcher.findBestScheduleMatch(target, allSchedules);
        
        if (scheduleToDelete) {
          await this.db.deleteUserSchedule(userId, scheduleToDelete);
          return { 
            success: true, 
            type: 'schedule_deleted', 
            details: { scheduleName: scheduleToDelete, aiDecision: true }
          };
        }
        
        // Try memory
        const allMemory = await this.db.getUserMemories(userId);
        const memoryToDelete = await this.aiMatcher.findBestMemoryMatch(target, allMemory);
        
        if (memoryToDelete) {
          await this.db.deleteMemoryCategory(userId, memoryToDelete);
          return { 
            success: true, 
            type: 'memory_deleted', 
            details: { categoryName: memoryToDelete, aiDecision: true }
          };
        }
      }
      
      return { 
        success: false, 
        error: `Could not find target "${target}" for deletion` 
      };
  }
}
  
    /**
     * Handle smart scheduling
     */
    async handleSmartSchedule(data, userId) {
      const { target, operation, values, metadata } = data;
      
      console.log(`📅 Smart scheduling: "${target}"`);
      
      // This would delegate to handleSmartAdd with operation 'add_event'
      return await this.handleSmartAdd({
        target,
        operation: 'add_event',
        values,
        metadata
      }, userId);
    }
  
    /**
     * Handle smart memory storage
     */
    async handleSmartRemember(data, userId) {
      const { target, operation, values, metadata } = data;
      
      console.log(`🧠 Smart remembering: "${target}"`);
      
      // This would delegate to handleSmartAdd with operation 'store_memory'
      return await this.handleSmartAdd({
        target,
        operation: 'store_memory',
        values,
        metadata
      }, userId);
    }
  
    /**
     * Handle data queries (counting, searching, etc.)
     */
    async handleDataQuery(data, userId) {
      const { target, operation, parameters, type } = data;
      
      console.log(`🔍 Handling data query: ${operation || type}`);
      
      switch(type || operation) {
        case 'count_events':
          return await this.handleEventCount(userId, parameters);
          
        case 'list_items':
          return await this.handleListQuery(userId, parameters);
          
        case 'memory_search':
          return await this.handleMemoryQuery(userId, parameters);
          
        default:
          return {
            success: true,
            type: 'query_processed',
            details: { target, operation: operation || type }
          };
      }
    }
    
    /**
     * Handle event counting queries
     */
    async handleEventCount(userId, parameters) {
      try {
        const allSchedules = await this.db.getUserSchedules(userId);
        const scheduleNames = Object.keys(allSchedules);
        
        let totalEvents = 0;
        let todayEvents = 0;
        let upcomingEvents = 0;
        const breakdown = {};
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (const scheduleName of scheduleNames) {
          const events = allSchedules[scheduleName].events || [];
          const scheduleTotal = events.length;
          
          let scheduleToday = 0;
          let scheduleUpcoming = 0;
          
          for (const event of events) {
            const eventDate = new Date(event.startTime || event.date);
            eventDate.setHours(0, 0, 0, 0);
            
            if (eventDate.getTime() === today.getTime()) {
              scheduleToday++;
              todayEvents++;
            } else if (eventDate > today) {
              scheduleUpcoming++;
              upcomingEvents++;
            }
          }
          
          totalEvents += scheduleTotal;
          breakdown[scheduleName] = {
            total: scheduleTotal,
            today: scheduleToday,
            upcoming: scheduleUpcoming
          };
        }
        
        const summary = `You have ${totalEvents} total events scheduled across ${scheduleNames.length} schedules.${
          todayEvents > 0 ? ` ${todayEvents} events today.` : ''
        }${
          upcomingEvents > 0 ? ` ${upcomingEvents} upcoming events.` : ''
        }`;
        
        return {
          success: true,
          type: 'event_count',
          summary,
          data: {
            total: totalEvents,
            today: todayEvents,
            upcoming: upcomingEvents,
            schedules: scheduleNames.length,
            breakdown
          }
        };
        
      } catch (error) {
        console.error('❌ Error counting events:', error);
        return {
          success: false,
          error: 'Failed to count events'
        };
      }
    }
    
    /**
     * Handle list queries
     */
    async handleListQuery(userId, parameters) {
      try {
        const allLists = await this.db.getUserLists(userId);
        const listNames = Object.keys(allLists);
        
        let totalItems = 0;
        let completedItems = 0;
        let pendingItems = 0;
        const breakdown = {};
        
        for (const listName of listNames) {
          const items = allLists[listName].items || [];
          const listTotal = items.length;
          
          let listCompleted = 0;
          let listPending = 0;
          
          for (const item of items) {
            if (item.completed || item.status === 'completed') {
              listCompleted++;
              completedItems++;
            } else {
              listPending++;
              pendingItems++;
            }
          }
          
          totalItems += listTotal;
          breakdown[listName] = {
            total: listTotal,
            completed: listCompleted,
            pending: listPending
          };
        }
        
        const summary = `You have ${totalItems} total items across ${listNames.length} lists.${
          completedItems > 0 ? ` ${completedItems} completed.` : ''
        }${
          pendingItems > 0 ? ` ${pendingItems} pending.` : ''
        }`;
        
        return {
          success: true,
          type: 'list_count',
          summary,
          data: {
            total: totalItems,
            completed: completedItems,
            pending: pendingItems,
            lists: listNames.length,
            breakdown
          }
        };
        
      } catch (error) {
        console.error('❌ Error querying lists:', error);
        return {
          success: false,
          error: 'Failed to query lists'
        };
      }
    }
    
    /**
     * Handle memory queries
     */
    async handleMemoryQuery(userId, parameters) {
      try {
        const allMemory = await this.db.getUserMemories(userId);
        const categoryNames = Object.keys(allMemory);
        
        let totalItems = 0;
        const breakdown = {};
        
        for (const categoryName of categoryNames) {
          const items = allMemory[categoryName].items || [];
          const categoryTotal = items.length;
          
          totalItems += categoryTotal;
          breakdown[categoryName] = {
            total: categoryTotal,
            items: items.map(item => item.key || item.name || 'Unnamed item')
          };
        }
        
        const summary = `You have ${totalItems} total memory items across ${categoryNames.length} categories.`;
        
        return {
          success: true,
          type: 'memory_count',
          summary,
          data: {
            total: totalItems,
            categories: categoryNames.length,
            breakdown
          }
        };
        
      } catch (error) {
        console.error('❌ Error querying memory:', error);
        return {
          success: false,
          error: 'Failed to query memory'
        };
      }
    }
  
    /**
     * Parse event details with smart date parsing
     */
    parseEventDetails(eventString, metadata) {
      const details = {
        title: eventString,
        startTime: null,
        endTime: null,
        description: '',
        location: ''
      };
      
      // Use smart date parsing if available
      if (metadata?.smartDate) {
        details.startTime = this.dateParser.parseToActualDate(metadata.smartDate);
      }
      
      return details;
    }
  
    /**
     * Parse memory item into key-value pairs
     */
    parseMemoryItem(item) {
      const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
      
      // Try to extract key-value patterns
      const patterns = [
        /(.+?)\s+is\s+(.+)/i,           // "John's phone is 555-1234"
        /(.+?):\s*(.+)/,                // "Gmail password: abc123"
        /remember\s+that\s+(.+?)\s+is\s+(.+)/i,  // "remember that the wifi password is abc123"
        /(.+?)\s*=\s*(.+)/,             // "username = john123"
      ];
      
      for (const pattern of patterns) {
        const match = itemStr.match(pattern);
        if (match) {
          return {
            key: match[1].trim(),
            value: match[2].trim()
          };
        }
      }
      
      // If no pattern matches, use the whole item as key with empty value
      return {
        key: itemStr,
        value: ''
      };
    }
  
    /**
     * Infer list type from name and content
     */
    inferListType(listName, items = []) {
      const name = listName.toLowerCase();
      const itemText = items.join(' ').toLowerCase();
      
      if (name.includes('shop') || name.includes('grocery') || 
          itemText.includes('milk') || itemText.includes('bread')) {
        return 'shopping';
      }
      
      if (name.includes('todo') || name.includes('task') || name.includes('work')) {
        return 'todo';
      }
      
      return 'custom';
    }
  
    /**
     * Handle legacy actions for backward compatibility
     */
    async handleLegacyAction(action, userId) {
      console.log('🔄 Processing legacy action:', action.type);
      
      switch(action.type) {
        case 'create_list':
          return await this.handleSmartCreate({
            target: action.data.listName || action.data.name,
            operation: 'create_list',
            values: action.data.items || []
          }, userId);
          
        case 'add_to_list':
          return await this.handleSmartAdd({
            target: action.data.listName,
            operation: 'add_to_list',
            values: action.data.items || []
          }, userId);
          
        case 'create_schedule':
          return await this.handleSmartCreate({
            target: action.data.name || action.data.scheduleName,
            operation: 'create_schedule'
          }, userId);
          
        case 'add_event':
          return await this.handleSmartAdd({
            target: action.data.scheduleName,
            operation: 'add_event',
            values: [action.data.title || action.data.event],
            metadata: action.data
          }, userId);
          
        default:
          throw new Error(`Unknown legacy action: ${action.type}`);
      }
    }
}

module.exports = { EnhancedSmartActionProcessor };