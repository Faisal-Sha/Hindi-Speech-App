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
            return await this.handleDataQuery(data, userId);
            
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
      
      console.log(`➕ Enhanced smart adding to: "${target}"`);
      
      switch(operation) {
        case 'add_to_list':
          const allLists = await this.db.getUserLists(userId);
          
          // Let AI find the best match
          const targetList = await this.aiMatcher.findBestListMatch(target, allLists, values);
          
          if (!targetList) {
            // AI decided we should create a new list
            console.log('🤖 AI suggests creating new list');
            
            const newListResult = await this.handleSmartCreate({
              target,
              operation: 'create_list',
              values
            }, userId);
            
            return newListResult;
          }
          
          // Add items to the AI-chosen list
          const results = [];
          for (const item of values) {
            const result = await this.db.addItemToList(userId, targetList, item);
            results.push(result);
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
          
          // Let AI find the best schedule
          const scheduleTarget = await this.aiMatcher.findBestScheduleMatch(target, allSchedules);
          
          if (!scheduleTarget) {
            // Create new schedule
            const newScheduleResult = await this.handleSmartCreate({
              target,
              operation: 'create_schedule'
            }, userId);
            
            // Then add the event
            const eventDetails = this.parseEventDetails(values[0], metadata);
            await this.db.addEventToSchedule(userId, newScheduleResult.details.name, eventDetails.title, eventDetails);
            
            return {
              success: true,
              type: 'schedule_created_and_event_added',
              details: {
                schedule: newScheduleResult.details.name,
                event: eventDetails,
                aiDecision: true
              }
            };
          }
          
          const eventDetails = this.parseEventDetails(values[0], metadata);
          const eventResult = await this.db.addEventToSchedule(
            userId, 
            scheduleTarget, 
            eventDetails.title,
            eventDetails
          );
          
          return {
            success: true,
            type: 'event_added',
            details: {
              schedule: scheduleTarget,
              event: eventDetails,
              aiDecision: true
            }
          };
          
        case 'store_memory':
          const allMemory = await this.db.getUserMemories(userId);
          
          // Let AI find the best memory category
          const memoryTarget = await this.aiMatcher.findBestMemoryMatch(target, allMemory, values);
          
          if (!memoryTarget) {
            // Create new memory category
            const newMemoryResult = await this.handleSmartCreate({
              target,
              operation: 'create_memory'
            }, userId);
            
            // Then store the memory items
            const memoryResults = [];
            for (const item of values) {
              const { key, value } = this.parseMemoryItem(item);
              const result = await this.db.addMemoryItem(userId, newMemoryResult.details.category, key, value);
              memoryResults.push(result);
            }
            
            return {
              success: true,
              type: 'memory_category_created_and_items_stored',
              details: {
                category: newMemoryResult.details.category,
                itemsStored: values.length,
                items: values,
                aiDecision: true
              }
            };
          }
          
          // Store memory items in AI-matched category
          const memoryResults = [];
          for (const item of values) {
            const { key, value } = this.parseMemoryItem(item);
            const result = await this.db.addMemoryItem(userId, memoryTarget, key, value);
            memoryResults.push(result);
          }
          
          return {
            success: true,
            type: 'memory_stored',
            details: {
              category: memoryTarget,
              itemsStored: values.length,
              items: values,
              aiDecision: true
            }
          };
          
        default:
          throw new Error(`Unknown add operation: ${operation}`);
      }
    }
  
    /**
     * Handle smart updates
     */
    async handleSmartUpdate(data, userId) {
      const { target, operation, values, metadata } = data;
      
      console.log(`🔄 Smart updating: "${target}"`);
      
      // This would handle intelligent updates
      // For now, maintain existing functionality
      return { 
        success: true, 
        type: 'update_processed',
        details: { target, operation }
      };
    }
  
    /**
     * Handle smart deletion
     */
    async handleSmartDelete(data, userId) {
      const { target, operation } = data;
      
      console.log(`🗑️ Smart deleting: "${target}"`);
      
      if (operation === 'delete_list' || !operation) {
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
      }
      
      return { success: false, error: 'Target not found for deletion' };
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
      const { target, operation, values, metadata } = data;
      
      console.log(`🔍 Handling data query: ${operation} for ${target}`);
      
      // This would delegate to the EnhancedQueryHandler
      // For now, return a placeholder
      return {
        success: true,
        type: 'query_processed',
        details: { target, operation }
      };
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