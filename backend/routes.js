const express = require('express');
const { OpenAI } = require('openai');
const {
  pool,
  ensureUser,
  ensureUserWithProfile,
  getUserProfile,
  getUserData,
  saveUserData, 
  saveConversation,
  createUserList,
  addItemToList,
  getUserLists,
  updateListItemStatus, 
  updateListItemText,
  deleteListItem,
  deleteUserList, 
  createUserSchedule,
  addEventToSchedule,
  getUserSchedules,
  updateEvent, 
  deleteEvent, 
  deleteUserSchedule,
  createMemoryCategory, 
  addMemoryItem,
  getUserMemories,
  updateMemoryItem, 
  deleteMemoryItem, 
  deleteMemoryCategory,
  getAllUserData, 
  buildSmartContext
} = require('./database');

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


//AI SYSTEM PROMPT
const SYSTEM_PROMPT = `You are an intelligent multilingual personal assistant. You understand user intent in ANY language and help manage their digital life.

    🎯 CRITICAL TARGETING RULES:

    1. **RESPECT SPECIFIC LIST NAMES**: When user mentions a specific list name, ALWAYS use that exact name
    ✅ User: "add to TODO list" → Target: "TODO List" or "Todo List" (exact match)
    ❌ NOT: Target birthday/shopping list just because of item content

    2. **EXACT NAME PRIORITY**: Use existing names from context exactly as they appear
    Context: "Shopping List", "Birthday List", "TODO List"
    ✅ User: "add to todo" → "listName": "TODO List" 
    ❌ NOT: "listName": "Birthday List" (even if adding birthday-related tasks)

    3. **CONTENT-BASED MATCHING ONLY FOR VAGUE REQUESTS**: Only use item content to guess list when user doesn't specify
    ✅ User: "add milk" (no list specified) → Use content to target "Shopping List"
    ❌ User: "add birthday cake to TODO list" → Respect "TODO list", don't override with Birthday List

    🤖 AVAILABLE ACTIONS (detect these from user intent in any language):
      - create_list: Create new lists (any type: shopping, todo, books, movies, travel, etc.)
      - add_to_list: Add items to existing lists (RESPECT user's specified list name)
      - update_list: Mark items as complete, edit, or remove
      - delete_list: Delete entire lists
      - create_schedule: Create schedule categories
      - add_event: Add events/appointments to schedules  
      - update_event: Modify or cancel events
      - delete_event: Delete individual events from schedules
      - edit_event: Edit/modify individual events in schedules
      - delete_schedule: Delete entire schedules
      - create_memory: Create memory categories (contacts, notes, passwords, etc.)
      - store_memory: Store any information in memory
      - update_memory: Edit individual memory items 
      - delete_memory_item: Delete individual memory items 
      - delete_memory: Delete entire memory categories



    📋 RESPONSE FORMAT - ALWAYS return valid JSON:
    {
    "response": "Your conversational response in user's language",
    "actions": [
        {
        "type": "action_type",
        "data": { 
            "listName": "EXACT existing name from context OR user's specified name",
            "name": "for deletion operations",
            "listType": "shopping|todo|custom", 
            "items": ["for add_to_list"]
        }
        }
    ]
    }

    🎯 TARGETING EXAMPLES - RESPECT USER'S SPECIFIC REQUESTS:

    Context: LISTS (3): "Shopping List" (2 items), "Birthday List" (1 items), "TODO List" (0 items)

    User: "add birthday cake to TODO list"
    AI THINKING: User specifically said "TODO list" - respect that, don't override based on content.
    {
    "response": "Added birthday cake to your TODO list!",
    "actions": [{"type": "add_to_list", "data": {"listName": "TODO List", "items": ["birthday cake"]}}]
    }

    User: "add milk and bread" (no list specified)
    AI THINKING: No specific list mentioned, use content to guess - food items = Shopping List.
    {
    "response": "Added milk and bread to your shopping list!",
    "actions": [{"type": "add_to_list", "data": {"listName": "Shopping List", "items": ["milk", "bread"]}}]
    }

    

    User: "delete the shopping list"
    {
    "response": "I've deleted your shopping list!",
    "actions": [{"type": "delete_list", "data": {"name": "Shopping List"}}]
    }

    User: "delete birthday list"
    {
    "response": "I've deleted your birthday list!",
    "actions": [{"type": "delete_list", "data": {"name": "Birthday List"}}]
    }

    🧠 INTELLIGENT MATCHING STRATEGY:

    1. **USER SPECIFIES LIST NAME**: Always respect their choice
    - "add X to [list name]" → Use specified list name
    - "add X to todo" → Match to "TODO List" or similar
    - "add X to shopping" → Match to "Shopping List" or similar

    2. **USER DOESN'T SPECIFY LIST**: Use intelligent guessing
    - "add milk" → Probably Shopping List (food item)
    - "add decorations" → Probably Birthday List (party item)
    - "add meeting" → Probably TODO/Work List (task item)

    3. **MULTILINGUAL MATCHING**: Connect languages but respect specificity
    - Hindi "टूडू लिस्ट में जोड़ें" → Target "TODO List"
    - Spanish "añadir a lista de todo" → Target "TODO List"
    - Don't override based on item content

    🔧 DELETION HANDLING:
    - "delete [list name]" → Use exact list name from context
    - "remove shopping list" → Target "Shopping List"
    - "delete todo" → Target "TODO List" or closest match

    ⚠️ WHAT NOT TO DO:
    ❌ User says "add birthday cake to TODO list" → DON'T target "Birthday List"
    ❌ User says "add to shopping list" → DON'T create new "shopping list" if "Shopping List" exists
    ❌ User says "delete list" → DON'T delete without knowing which list


    🗓️ SCHEDULE EVENT FORMAT:
    For add_event, use this exact structure:
    {
      "type": "add_event",
      "data": {
        "scheduleName": "Monday",           // or whatever schedule name
        "eventTitle": "Doctor Appointment", // REQUIRED - the event name
        "startTime": "2025-07-20 14:30:00", // REQUIRED - when it happens
        "endTime": "2025-07-20 15:30:00",   // Optional - when it ends
        "location": "Medical Center",        // Optional - where it happens
        "description": "Annual checkup"      // Optional - additional details
      }
    }

    Example responses:
    User: "I have a meeting tomorrow at 3 PM"
    {
      "response": "I've added your meeting to tomorrow's schedule!",
      "actions": [{
        "type": "add_event",
        "data": {
          "scheduleName": "Monday",
          "eventTitle": "Meeting", 
          "startTime": "2025-07-17 15:00:00"
        }
      }]
    }
      User: "remove the work schedule"
    {
      "response": "I've deleted your work schedule!",
      "actions": [{"type": "delete_schedule", "data": {"name": "Work Schedule"}}]
    }

    User: "cancel the 3pm meeting"
    {
      "response": "I've cancelled your 3pm meeting!",
      "actions": [{"type": "delete_event", "data": {"scheduleName": "Work Schedule", "eventId": 123}}]
    }

    User: "change the meeting time to 4pm"
    {
      "response": "I've updated your meeting time to 4pm!",
      "actions": [{"type": "edit_event", "data": {"scheduleName": "Work Schedule", "eventId": 123, "updates": {"startTime": "2024-01-15T16:00:00Z"}}}]
    }

    🧠 MEMORY MANAGEMENT FORMAT:

    SMART MEMORY DETECTION:
- "Remember that..." → store_memory
- "Don't forget..." → store_memory  
- "Note that..." → store_memory
- "Keep in mind..." → store_memory
- "John's phone is 555-1234" → store_memory
- "My password for Gmail is xyz123" → store_memory
- "Create contacts category" → create_memory


    For create_memory (creating categories), use this structure:
    {
      "type": "create_memory",
      "data": {
        "category": "Contacts",        // REQUIRED - category name
        "categoryType": "contacts"     // Optional - type of category
      }
    }

    MEMORY EXAMPLES:
    User: "Create a contacts category"
    {
      "response": "I've created a contacts category for you!",
      "actions": [{
        "type": "create_memory",
        "data": {
          "category": "Contacts",
          "categoryType": "contacts"
        }
      }]
    }

    User: "Remember John's phone number is 555-1234"
    {
      "response": "I'll remember John's phone number for you!",
      "actions": [{
        "type": "store_memory",
        "data": {
          "category": "Contacts",
          "memoryKey": "John Smith",
          "memoryValue": "Phone: 555-1234"
        }
      }]
    }

    STORE_MEMORY FORMAT:
{
  "type": "store_memory",
  "data": {
    "category": "Contacts",           // Target category
    "memoryKey": "John Smith",        // What to call this memory
    "memoryValue": "555-1234"         // The actual information
  }
}

EXAMPLES:
User: "Remember John's phone number is 555-1234"
{
  "response": "I'll remember John's phone number!",
  "actions": [{
    "type": "store_memory",
    "data": {
      "category": "Contacts",
      "memoryKey": "John Smith Phone",
      "memoryValue": "555-1234"
    }
  }]
}

User: "My Gmail password is secretpass123"
{
  "response": "I've securely stored your Gmail password!",
  "actions": [{
    "type": "store_memory", 
    "data": {
      "category": "Passwords",
      "memoryKey": "Gmail Password",
      "memoryValue": "secretpass123"
    }
  }]
}

User: "Note that the meeting is moved to Friday"
{
  "response": "I've noted that the meeting is moved to Friday!",
  "actions": [{
    "type": "store_memory",
    "data": {
      "category": "Notes",
      "memoryKey": "Meeting Update",
      "memoryValue": "Meeting moved to Friday"
    }
  }]
}

EDITING MEMORY ITEMS:
User: "Edit John's phone number to 555-9999"
{
  "response": "I've updated John's phone number to 555-9999!",
  "actions": [{
    "type": "update_memory",
    "data": {
      "categoryName": "Contacts",
      "itemId": 123,
      "operation": "edit",
      "updates": {
        "key": "John Phone",
        "value": "555-9999"
      }
    }
  }]
}

User: "Change my Gmail password to newpass123"
{
  "response": "I've updated your Gmail password!",
  "actions": [{
    "type": "update_memory",
    "data": {
      "categoryName": "Passwords", 
      "itemId": 456,
      "operation": "edit",
      "updates": {
        "value": "newpass123"
      }
    }
  }]
}

DELETING MEMORY ITEMS:
User: "Delete John's phone number"
{
  "response": "I've deleted John's phone number from your contacts!",
  "actions": [{
    "type": "delete_memory_item",
    "data": {
      "categoryName": "Contacts",
      "itemId": 123
    }
  }]
}

User: "Remove my old Gmail password"
{
  "response": "I've removed your Gmail password!",
  "actions": [{
    "type": "delete_memory_item", 
    "data": {
      "categoryName": "Passwords",
      "itemId": 456
    }
  }]
}

DELETING MEMORY CATEGORIES:
User: "Delete the entire Contacts category"
{
  "response": "I've deleted your entire Contacts category and all contact information!",
  "actions": [{
    "type": "delete_memory",
    "data": {
      "name": "Contacts"
    }
  }]
}

SMART MEMORY ITEM IDENTIFICATION:
- AI will identify memory items by matching key content in voice commands
- "John's phone" → Look for item with key containing "John" and "phone"
- "Gmail password" → Look for item with key containing "Gmail" and "password"
- "Meeting note" → Look for item with key containing "meeting" or "note"

AUTOMATIC CATEGORY DETECTION:
- Phone numbers, emails, addresses → "Contacts" category
- Passwords, PINs, codes → "Passwords" category  
- General notes, reminders → "Notes" category
- Important dates, anniversaries → "Dates" category
- Work info, meeting notes → "Work" category

SMART CONTENT PARSING:
- "John's phone is 555-1234" → memoryKey: "John Phone", memoryValue: "555-1234"
- "Remember my password is abc123" → memoryKey: "Password", memoryValue: "abc123"
- "Note that Sarah likes chocolate" → memoryKey: "Sarah Preferences", memoryValue: "likes chocolate"
- "Don't forget the meeting at 3pm" → memoryKey: "Meeting Reminder", memoryValue: "meeting at 3pm"

CRITICAL: Always include both memoryKey AND memoryValue for store_memory actions!
*/

    ✅ ALWAYS RESPECT USER'S EXPLICIT CHOICE OVER CONTENT-BASED GUESSING

    🌍 LANGUAGE RESPONSE GUIDELINES:
    - Respond in the same language the user spoke
    - Use natural, conversational responses
    - Acknowledge what was added/deleted and to/from which list

    ALWAYS return valid JSON. PRIORITIZE user's explicit list naming over intelligent content guessing.`;


function extractListData(action) {
  console.log('🔍 Extracting list data from action:', action);
  
  // Try all possible locations for list data (just like create_user_list fix)
  const listName = action.listName || 
                  action.list_name ||
                  action.name ||
                  action.data?.listName ||
                  action.data?.list_name ||
                  action.data?.name ||
                  action.data?.targetList ||
                  action.data?.target ||
                  null;
  
  const items = action.items ||
                action.data?.items ||
                (action.item ? [action.item] : []) ||
                (action.data?.item ? [action.data.item] : []) ||
                [];
  
  const listType = action.listType ||
                  action.list_type ||
                  action.type ||
                  action.data?.listType ||
                  action.data?.list_type ||
                  action.data?.type ||
                  'general';
  
  console.log(`✅ Extracted list data - Name: "${listName}", Items: ${items.length}, Type: "${listType}"`);
  
  return { listName, items, listType };
}

function extractScheduleData(action) {
  console.log('🔍 Extracting schedule data from action:', action);
  console.log('🔍 Full action object:', JSON.stringify(action, null, 2));
  
  // ENHANCED: Look in many more places for the data
  const scheduleName = action.scheduleName ||
                      action.schedule_name ||
                      action.name ||
                      action.schedule ||
                      action.target ||
                      action.data?.scheduleName ||
                      action.data?.schedule_name ||
                      action.data?.name ||
                      action.data?.schedule ||
                      action.data?.target ||
                      null;
  
  // ENHANCED: Look for event title in more places
  const eventTitle = action.eventTitle ||
                    action.event_title ||
                    action.title ||
                    action.event ||
                    action.eventName ||
                    action.data?.eventTitle ||
                    action.data?.event_title ||
                    action.data?.title ||
                    action.data?.event ||
                    action.data?.eventName ||
                    null;
  
  // ENHANCED: Look for time in more places and handle different formats
  const startTime = action.startTime ||
                    action.start_time ||
                    action.time ||
                    action.when ||
                    action.datetime ||
                    action.data?.startTime ||
                    action.data?.start_time ||
                    action.data?.time ||
                    action.data?.when ||
                    action.data?.datetime ||
                    null;
  
  const scheduleType = action.scheduleType ||
                      action.schedule_type ||
                      action.type ||
                      action.data?.scheduleType ||
                      action.data?.schedule_type ||
                      action.data?.type ||
                      'personal';
  
  console.log(`✅ Extracted schedule data:`, {
      scheduleName, 
      eventTitle, 
      startTime, 
      scheduleType
  });
  
  return { scheduleName, eventTitle, startTime, scheduleType };
}

function extractMemoryData(action) {
  console.log('📋 [DEEP DEBUG] === EXTRACT MEMORY DATA START ===');
  console.log('📋 [DEEP DEBUG] Action type:', typeof action);
  console.log('📋 [DEEP DEBUG] Action keys:', Object.keys(action || {}));
  console.log('📋 [DEEP DEBUG] Raw action:', action);
  
  if (!action) {
    console.error('📋 [DEEP DEBUG] Action is null/undefined!');
    return { category: 'General', memoryKey: `Memory_${Date.now()}`, memoryValue: null, categoryType: 'general' };
  }
  
  try {
    console.log('📋 [DEEP DEBUG] Extracting category...');
    const category = action.category ||
                    action.categoryName ||
                    action.data?.category ||
                    action.data?.categoryName ||
                    'General';
    console.log('📋 [DEEP DEBUG] Extracted category:', category);
    
    console.log('📋 [DEEP DEBUG] Extracting memoryKey...');
    const memoryKey = action.memoryKey ||
                     action.key ||
                     action.data?.memoryKey ||
                     action.data?.key ||
                     action.data?.name ||
                     `Memory_${Date.now()}`;
    console.log('📋 [DEEP DEBUG] Extracted memoryKey:', memoryKey);
    
    console.log('📋 [DEEP DEBUG] Extracting memoryValue...');
    const memoryValue = action.memoryValue ||
                       action.value ||
                       action.data?.memoryValue ||
                       action.data?.value ||
                       action.data?.content ||
                       null;
    console.log('📋 [DEEP DEBUG] Extracted memoryValue:', memoryValue);
    
    const categoryType = action.categoryType ||
                        action.data?.categoryType ||
                        'general';
    console.log('📋 [DEEP DEBUG] Extracted categoryType:', categoryType);
    
    const result = { category, memoryKey, memoryValue, categoryType };
    console.log('📋 [DEEP DEBUG] Final result:', result);
    console.log('📋 [DEEP DEBUG] === EXTRACT MEMORY DATA SUCCESS ===');
    
    return result;
    
  } catch (error) {
    console.error('📋 [DEEP DEBUG] === EXTRACT MEMORY DATA FAILED ===');
    console.error('📋 [DEEP DEBUG] Error:', error);
    console.error('📋 [DEEP DEBUG] Error stack:', error.stack);
    throw error;
  }
}


async function processAIActions(userId, actions) {
    const results = [];

    for (const action of actions) {
        try {
        console.log(`⚡ Processing action: ${action.type}`, action);
        
        switch (action.type) {
          case 'create_list':
            console.log('📝 Creating new list...');
            const createListData = extractListData(action);
            if (!createListData.listName) {
                throw new Error('List name is required for create_list');
            }
                  
            await createUserList(
                userId, 
                createListData.listName, 
                createListData.listType,
                {
                    description: action.description || action.data?.description,
                    color: action.color || action.data?.color,
                    icon: action.icon || action.data?.icon
                }
            );

            if (createListData.items.length > 0) {
                for (const item of createListData.items) {
                    await addItemToList(userId, createListData.listName, item);
                }
            }
            
            results.push({ 
                success: true, 
                type: 'create_list', 
                data: { 
                    listName: createListData.listName,
                    itemsAdded: createListData.items.length 
                } 
            });
            break;

            
            case 'add_to_list':
              console.log('➕ Adding items to existing list...');
              const addListData = extractListData(action);
              if (!addListData.listName) {
                  throw new Error('List name is required for add_to_list');
              }
              if (addListData.items.length === 0) {
                  throw new Error('Items are required for add_to_list');
              }
              
              // Add each item to the list
              for (const item of addListData.items) {
                  await addItemToList(
                      userId, 
                      addListData.listName, 
                      typeof item === 'string' ? item : item.text || JSON.stringify(item),
                      {
                          priority: item.priority || 0,
                          due_date: item.dueDate || item.due_date,
                          notes: item.notes,
                          quantity: item.quantity || 1
                      }
                  );
              }
              
              results.push({ 
                  success: true, 
                  type: 'add_to_list', 
                  data: { 
                      listName: addListData.listName,
                      itemsAdded: addListData.items.length 
                  } 
              });
              break;

            case 'update_list':
              console.log('📝 Updating list item...');
              const updateData = action.data;
              const { listName, itemId, operation, newText } = updateData;
              
              if (!listName || !itemId || !operation) {
                  throw new Error('Missing required fields for update_list: listName, itemId, operation');
              }
              
              let updateResult;
              
              switch (operation) {
                case 'complete':
                  updateResult = await updateListItemStatus(userId, listName, itemId, true);
                  break;
                case 'uncomplete':
                  updateResult = await updateListItemStatus(userId, listName, itemId, false);
                  break;
                case 'delete':
                  updateResult = await deleteListItem(userId, listName, itemId);
                  break;
                case 'edit':
                  if (!newText) {
                      throw new Error('newText is required for edit operation');
                  }
                  updateResult = await updateListItemText(userId, listName, itemId, newText);
                  break;
                default:
                  throw new Error(`Unknown update operation: ${operation}`);
              }
              
              results.push({ 
                  success: true, 
                  type: 'update_list', 
                  operation: operation,
                  data: { 
                      listName: listName,
                      itemId: itemId,
                      result: updateResult
                  } 
              });
            break;
              
            // ADD THIS NEW CASE FOR DELETE_LIST
            case 'delete_list':
              console.log('🗑️ Deleting entire list...');
              const deleteListData = action.data;
              const listToDelete = deleteListData?.name || deleteListData?.listName;
              
              if (!listToDelete) {
                  throw new Error('List name is required for delete_list');
              }
              
              const deleteListResult = await deleteUserList(userId, listToDelete);
              
              results.push({ 
                  success: true, 
                  type: 'delete_list', 
                  data: { 
                      listName: listToDelete,
                      deletedList: deleteListResult,
                      deletedItemsCount: deleteListResult.deletedItemsCount
                  } 
              });
              break;
            
            case 'create_schedule':
              console.log('📅 Creating new schedule...');
              const createScheduleData = extractScheduleData(action);
              
              if (!createScheduleData.scheduleName) {
                  throw new Error('Schedule name is required for create_schedule');
              }
              
              // Create the schedule
              await createUserSchedule(
                  userId,
                  createScheduleData.scheduleName,
                  createScheduleData.scheduleType,
                  {
                      description: action.description || action.data?.description,
                      color: action.color || action.data?.color,
                      timezone: action.timezone || action.data?.timezone || 'UTC'
                  }
              );
              
              results.push({ 
                  success: true, 
                  type: 'create_schedule', 
                  data: { scheduleName: createScheduleData.scheduleName } 
              });
              break;

            
            case 'add_event':
              console.log('📆 Adding event to schedule...');
              const addEventData = extractScheduleData(action);
              
              if (!addEventData.scheduleName) {
                  throw new Error('Schedule name is required for add_event');
              }
              
              if (!addEventData.eventTitle) {
                  throw new Error('Event title is required for add_event');
              }
              
              if (!addEventData.startTime) {
                  throw new Error('Start time is required for add_event');
              }
              
              // Add the event
              await addEventToSchedule(
                  userId,
                  addEventData.scheduleName,
                  addEventData.eventTitle,
                  addEventData.startTime,
                  {
                      end_time: action.endTime || action.end_time || action.data?.endTime || action.data?.end_time,
                      location: action.location || action.data?.location,
                      event_description: action.description || action.data?.description,
                      event_type: action.eventType || action.event_type || action.data?.eventType || action.data?.event_type || 'appointment',
                      is_all_day: action.isAllDay || action.is_all_day || action.data?.isAllDay || action.data?.is_all_day || false,
                      reminder_minutes: action.reminderMinutes || action.reminder_minutes || action.data?.reminderMinutes || action.data?.reminder_minutes
                  }
              );
              
              results.push({ 
                  success: true, 
                  type: 'add_event', 
                  data: { 
                      scheduleName: addEventData.scheduleName,
                      eventTitle: addEventData.eventTitle 
                  } 
              });
              break;

            case 'edit_event':
              console.log('📝 Editing event...');
              const editEventData = action.data;
              const { scheduleName: editSchedule, eventId: editEventId, updates } = editEventData;
              
              if (!editSchedule || !editEventId || !updates) {
                  throw new Error('Schedule name, event ID, and updates are required for edit_event');
              }
              
              const editEventResult = await updateEvent(userId, editSchedule, editEventId, updates);
              
              results.push({ 
                  success: true, 
                  type: 'edit_event', 
                  data: { 
                      scheduleName: editSchedule,
                      eventId: editEventId,
                      updatedEvent: editEventResult,
                      appliedUpdates: Object.keys(updates)
                  } 
              });
              break;

            case 'delete_event':
              console.log('🗑️ Deleting event...');
              const deleteEventData = action.data;
              const { scheduleName: eventSchedule, eventId } = deleteEventData;
              
              if (!eventSchedule || !eventId) {
                  throw new Error('Schedule name and event ID are required for delete_event');
              }
              
              const deleteEventResult = await deleteEvent(userId, eventSchedule, eventId);
              
              results.push({ 
                  success: true, 
                  type: 'delete_event', 
                  data: { 
                      scheduleName: eventSchedule,
                      eventId: eventId,
                      deletedEvent: deleteEventResult
                  } 
              });
              break;

            case 'delete_schedule':
              console.log('🗑️ Deleting entire schedule...');
              const deleteScheduleData = action.data;
              const scheduleToDelete = deleteScheduleData?.name || deleteScheduleData?.scheduleName;
              
              if (!scheduleToDelete) {
                  throw new Error('Schedule name is required for delete_schedule');
              }
              
              const deleteScheduleResult = await deleteUserSchedule(userId, scheduleToDelete);
              
              results.push({ 
                  success: true, 
                  type: 'delete_schedule', 
                  data: { 
                      scheduleName: scheduleToDelete,
                      deletedSchedule: deleteScheduleResult,
                      deletedEventsCount: deleteScheduleResult.deletedEventsCount
                  } 
              });
              break;

            
            case 'create_memory':
              console.log('🧠 Creating memory category...');
              const createMemoryData = extractMemoryData(action);
              
              if (!createMemoryData.category) {
                  throw new Error('Category name is required for create_memory');
              }
              
              // Create the memory category (not an item!)
              await createMemoryCategory(
                  userId,
                  createMemoryData.category,
                  createMemoryData.categoryType || 'general',
                  {
                      description: action.description || action.data?.description,
                      color: action.color || action.data?.color,
                      icon: action.icon || action.data?.icon
                  }
              );
              
              results.push({ 
                  success: true, 
                  type: 'create_memory', 
                  data: { category: createMemoryData.category } 
              });
              break;

              case 'store_memory':
                console.log('🧠 [DEEP DEBUG] === STORE MEMORY START ===');
                console.log('🧠 [DEEP DEBUG] Raw action:', JSON.stringify(action, null, 2));
                
                // FIXED: Declare storeMemoryData in the right scope
                let storeMemoryData;
                
                try {
                  console.log('🧠 [DEEP DEBUG] Step 1: Extracting memory data...');
                  storeMemoryData = extractMemoryData(action);
                  console.log('🧠 [DEEP DEBUG] Extracted data:', storeMemoryData);
                  
                  if (!storeMemoryData.memoryValue) {
                      throw new Error('Memory value is required for store_memory');
                  }
                  
                  console.log('🧠 [DEEP DEBUG] Step 2: Preparing parameters...');
                  const params = {
                    userId: userId,
                    category: storeMemoryData.category,
                    memoryKey: storeMemoryData.memoryKey,
                    memoryValue: storeMemoryData.memoryValue
                  };
                  console.log('🧠 [DEEP DEBUG] Parameters:', params);
                  
                  console.log('🧠 [DEEP DEBUG] Step 3: Calling addMemoryItem...');
                  
                  // Try with minimal options first
                  const result = await addMemoryItem(
                      userId,
                      storeMemoryData.category,
                      storeMemoryData.memoryKey,
                      storeMemoryData.memoryValue,
                      {} // Empty options object
                  );
                  
                  console.log('🧠 [DEEP DEBUG] addMemoryItem succeeded:', result);
                  
                } catch (firstError) {
                  console.log('🧠 [DEEP DEBUG] First attempt failed:', firstError.message);
                  
                  // FIXED: Check if storeMemoryData exists before using it
                  if (!storeMemoryData) {
                    console.error('🧠 [DEEP DEBUG] storeMemoryData is undefined, cannot retry');
                    throw firstError;
                  }
                  
                  // If category doesn't exist, try creating it
                  if (firstError.message.includes('not found') || firstError.message.includes('Category')) {
                    console.log(`🧠 [DEEP DEBUG] Creating category "${storeMemoryData.category}"...`);
                    
                    try {
                      await createMemoryCategory(userId, storeMemoryData.category, 'general');
                      console.log('🧠 [DEEP DEBUG] Category created successfully');
                      
                      // Try adding memory item again
                      console.log('🧠 [DEEP DEBUG] Retrying addMemoryItem...');
                      const result = await addMemoryItem(
                          userId,
                          storeMemoryData.category,
                          storeMemoryData.memoryKey,
                          storeMemoryData.memoryValue,
                          {} // Empty options object
                      );
                      
                      console.log('🧠 [DEEP DEBUG] Retry succeeded:', result);
                      
                    } catch (retryError) {
                      console.error('🧠 [DEEP DEBUG] Retry failed:', retryError);
                      console.error('🧠 [DEEP DEBUG] Retry error stack:', retryError.stack);
                      throw retryError;
                    }
                  } else {
                    console.error('🧠 [DEEP DEBUG] Non-category error:', firstError);
                    console.error('🧠 [DEEP DEBUG] Error stack:', firstError.stack);
                    throw firstError;
                  }
                }
                
                console.log('🧠 [DEEP DEBUG] === STORE MEMORY SUCCESS ===');
                
                // FIXED: Use safe fallback if storeMemoryData is undefined
                results.push({ 
                    success: true, 
                    type: 'store_memory', 
                    data: { 
                        category: storeMemoryData?.category || 'Unknown',
                        key: storeMemoryData?.memoryKey || 'Unknown'
                    } 
                });
                break;
            
              case 'update_memory':
                console.log('📝 Updating memory item with data:', action.data);
                
                const updateMemoryData = action.data;
                const targetCategory = updateMemoryData?.categoryName || updateMemoryData?.category;
                const memoryItemId = updateMemoryData?.itemId;
                const memoryUpdates = updateMemoryData?.updates || {};
                
                if (!targetCategory || !memoryItemId) {
                  throw new Error('Category name and item ID required for update_memory');
                }
                
                await updateMemoryItem(
                  userId,
                  targetCategory,
                  memoryItemId,
                  memoryUpdates
                );
                
                results.push({ 
                  success: true, 
                  type: 'update_memory', 
                  data: { 
                    category: targetCategory,
                    itemId: memoryItemId,
                    updates: memoryUpdates
                  } 
                });
                break;
                
              case 'delete_memory_item':
                console.log('🗑️ Deleting memory item with data:', action.data);
                
                const deleteItemData = action.data;
                const deleteCategory = deleteItemData?.categoryName || deleteItemData?.category;
                const deleteItemId = deleteItemData?.itemId;
                
                if (!deleteCategory || !deleteItemId) {
                  throw new Error('Category name and item ID required for delete_memory_item');
                }
                
                await deleteMemoryItem(
                  userId,
                  deleteCategory,
                  deleteItemId
                );
                
                results.push({ 
                  success: true, 
                  type: 'delete_memory_item', 
                  data: { 
                    category: deleteCategory,
                    itemId: deleteItemId
                  } 
                });
                break;
                
                
              case 'delete_memory':
                console.log('🗑️ Deleting memory category with data:', action.data);
                
                const deleteCategoryData = action.data;
                const categoryToDelete = deleteCategoryData?.name || deleteCategoryData?.category;
                
                if (!categoryToDelete) {
                  throw new Error('Category name required for delete_memory');
                }
                
                await deleteMemoryCategory(userId, categoryToDelete);
                
                results.push({ 
                  success: true, 
                  type: 'delete_memory', 
                  data: { 
                    category: categoryToDelete
                  } 
                });
                  break;
              
            
            default:
            console.log(`❓ Unknown action type: ${action.type}`);
            results.push({ success: false, type: action.type, error: 'Unknown action type' });
        }
        } catch (error) {
        console.error(`❌ Error processing action ${action.type}:`, error);
        results.push({ success: false, type: action.type, error: error.message });
        }
    }

    return results;
}

/* Health FUnctions */
router.get('/health', async (req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - start;
    
    res.json({ 
      status: 'OK', 
      message: 'AI-Powered Multilingual Backend with PostgreSQL',
      features: ['Multilingual AI Intent Detection', 'PostgreSQL Persistence', 'Cross-Mode Functionality', 'Optimized Data Operations'],
      database: 'Connected',
      performance: {
        dbLatency: `${dbLatency}ms`,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      version: '2.0.0-organized'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Database connection failed',
      database: 'Disconnected'
    });
  }
});

/* Users and Authentication */
router.get('/users', async (req, res) => {
  try {
    console.log('👥 Getting all user profiles with data counts...');
    
    // Instead of relying on the stored procedure, let's build the data ourselves
    // Step 1: Get all user profiles
    const profilesResult = await pool.query(`
      SELECT 
        u.user_id,
        COALESCE(up.display_name, u.user_id) as display_name,
        COALESCE(up.preferred_language, 'en-US') as preferred_language,
        COALESCE(up.avatar_emoji, '👤') as avatar_emoji,
        COALESCE(up.theme_preference, 'default') as theme_preference,
        u.last_active,
        u.created_at
      FROM users u
      LEFT JOIN user_profiles up ON u.user_id = up.user_id
      ORDER BY u.last_active DESC NULLS LAST
    `);
    
    console.log(`📋 Found ${profilesResult.rows.length} user profiles`);
    
    // Step 2: For each user, get their actual data counts
    const usersWithCounts = await Promise.all(
      profilesResult.rows.map(async (user) => {
        try {
          // Count lists for this user
          const listsCount = await pool.query(`
            SELECT COUNT(*) as count 
            FROM user_lists 
            WHERE user_id = $1 AND is_archived = false
          `, [user.user_id]);
          
          // Count schedules for this user  
          const schedulesCount = await pool.query(`
            SELECT COUNT(*) as count 
            FROM user_schedules 
            WHERE user_id = $1
          `, [user.user_id]);
          
          // Count memory categories for this user
          const memoryCount = await pool.query(`
            SELECT COUNT(*) as count 
            FROM memory_categories 
            WHERE user_id = $1
          `, [user.user_id]);
          
          console.log(`📊 User ${user.display_name}: ${listsCount.rows[0].count} lists, ${schedulesCount.rows[0].count} schedules, ${memoryCount.rows[0].count} memory categories`);
          
          return {
            ...user,
            // Add the counts in the format the frontend expects
            lists_count: parseInt(listsCount.rows[0].count) || 0,
            schedules_count: parseInt(schedulesCount.rows[0].count) || 0,
            memory_count: parseInt(memoryCount.rows[0].count) || 0,
            // Also provide in data_summary format for backward compatibility
            data_summary: {
              lists_count: parseInt(listsCount.rows[0].count) || 0,
              schedules_count: parseInt(schedulesCount.rows[0].count) || 0,
              memory_count: parseInt(memoryCount.rows[0].count) || 0
            }
          };
        } catch (error) {
          console.error(`❌ Error getting counts for user ${user.user_id}:`, error);
          // Return user with zero counts if there's an error
          return {
            ...user,
            lists_count: 0,
            schedules_count: 0,
            memory_count: 0,
            data_summary: {
              lists_count: 0,
              schedules_count: 0,
              memory_count: 0
            }
          };
        }
      })
    );
    
    console.log(`✅ Returning ${usersWithCounts.length} users with complete data counts`);
    res.json(usersWithCounts);
    
  } catch (error) {
    console.error('❌ Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/user-profile/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log(`👤 Getting profile for user: ${userId}`);
      
      const userProfile = await getUserProfile(userId);
      
      if (!userProfile) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      console.log(`✅ Profile loaded for ${userId}:`, userProfile.display_name);
      res.json(userProfile);
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
});

router.post('/create-user', async (req, res) => {
    try {
      const { userId, displayName, preferredLanguage, avatarEmoji } = req.body;
      
      console.log(`➕ Creating new user: ${userId} (${displayName})`);
      
      // Validation
      if (!userId || !displayName) {
        return res.status(400).json({ error: 'User ID and Display Name are required' });
      }
      
      // Check if user already exists
      const existingUser = await getUserProfile(userId);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }
      
      // Create user with profile
      await ensureUserWithProfile(userId, {
        displayName,
        preferredLanguage: preferredLanguage || 'en-US',
        avatarEmoji: avatarEmoji || '👤',
        themePreference: 'default'
      });
      
      // Return the created user profile
      const newUserProfile = await getUserProfile(userId);
      
      console.log(`✅ User created successfully: ${userId}`);
      res.status(201).json(newUserProfile);
    } catch (error) {
      console.error('❌ Error creating user:', error);
      
      if (error.code === '23505') { // Unique violation
        res.status(409).json({ error: 'User already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create user' });
      }
    }
});

router.post('/login', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const userProfile = await getUserProfile(userId);
      
      if (!userProfile) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update last active
      await pool.query(
        'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );
      
      console.log(`🔐 User logged in: ${userId} (${userProfile.display_name})`);
      
      res.json({
        message: 'Login successful',
        user: userProfile
      });
    } catch (error) {
      console.error('❌ Error during login:', error);
      res.status(500).json({ error: 'Login failed' });
    }
});

router.put('/update-user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { displayName, preferredLanguage, avatarEmoji, themePreference } = req.body;
      
      console.log(`📝 Updating user profile: ${userId}`);
      
      // Update user profile
      await pool.query(`
        UPDATE user_profiles 
        SET 
          display_name = COALESCE($2, display_name),
          preferred_language = COALESCE($3, preferred_language),
          avatar_emoji = COALESCE($4, avatar_emoji),
          theme_preference = COALESCE($5, theme_preference),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [userId, displayName, preferredLanguage, avatarEmoji, themePreference]);
      
      // Also update last_active in users table
      await pool.query(
        'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );
      
      const updatedProfile = await getUserProfile(userId);
      
      console.log(`✅ User profile updated: ${userId}`);
      res.json(updatedProfile);
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
});

//❌Need to fix
router.delete('/delete-user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      console.log(`🗑️ Deleting user and all data: ${userId}`);
      
      // Start transaction to ensure all data is deleted atomically
      await pool.query('BEGIN');
      
      try {
        // Delete in order to respect foreign key constraints
        await pool.query('DELETE FROM conversations WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_data WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
        
        await pool.query('COMMIT');
        
        console.log(`✅ User ${userId} and all data deleted successfully`);
        res.json({ message: 'User deleted successfully' });
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
});

/* Getting all the data */

router.get('/data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await ensureUser(userId);
    
    // Get all user data
    const [lists, schedules, memories] = await Promise.all([
        getUserLists(userId),
        getUserSchedules(userId) || {},
        getUserMemories(userId) || {}
    ]);
    
    const userData = {
        lists: lists || {},
        schedules: schedules || {},
        memory: memories || {},
        chats: {}
    };
    res.json(userData);
    
} catch (error) {
    console.error('❌ Error getting user data:', error);
    res.status(500).json({ error: 'Failed to get user data' });
}});

router.post('/save-data-enhanced', async (req, res) => {
    try {
      const { userId, actions } = req.body;
      
      console.log(`💾 Processing ${actions.length} actions for user ${userId}`);
      
      await ensureUser(userId);
      const results = await processAIActions(userId, actions);
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      console.log(`✅ Processed actions: ${successCount} successful, ${errorCount} failed`);
      
      res.json({ 
        success: true, 
        processed: results.length,
        successful: successCount,
        failed: errorCount,
        results 
      });
    } catch (error) {
      console.error('❌ Error saving enhanced data:', error);
      res.status(500).json({ error: 'Failed to save data' });
    }
});
  
  // Legacy data endpoints for backwards compatibility
router.post('/save-data', async (req, res) => {
    try {
      const { userId, dataType, dataKey, dataValue } = req.body;
      
      await ensureUser(userId);
      await saveUserData(userId, dataType, dataKey, dataValue);
      
      console.log(`💾 Saved ${dataType}/${dataKey} for user ${userId}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving data:', error);
      res.status(500).json({ error: 'Failed to save data' });
    }
});


/////////////////////////////////
/* Specific LISTS, SCHEDULES, MEMORY Routes */
////////////////////////////////


//LISTS
router.post('/lists/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { listName, listType, description, color, icon } = req.body;
      
      await ensureUser(userId);
      const list = await createUserList(userId, listName, listType, { description, color, icon });
      
      res.status(201).json(list);
    } catch (error) {
      console.error('❌ Error creating list:', error);
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create list' });
      }
    }
});

router.post('/lists/:userId/:listName/items', async (req, res) => {
    try {
      const { userId, listName } = req.params;
      const { itemText, priority, due_date, notes, quantity } = req.body;
      
      await ensureUser(userId);
      const item = await addItemToList(userId, listName, itemText, { priority, due_date, notes, quantity });
      
      res.status(201).json(item);
    } catch (error) {
      console.error('❌ Error adding item to list:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to add item to list' });
      }
    }
});
  
router.get('/lists/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { includeArchived = false } = req.query;
      
      const lists = await getUserLists(userId, includeArchived === 'true');
      res.json(lists);
    } catch (error) {
      console.error('❌ Error getting user lists:', error);
      res.status(500).json({ error: 'Failed to get user lists' });
    }
});

router.post('/lists/update', async (req, res) => {
  try {
    console.log('\n🔍 ===== DEBUGGING /lists/update =====');
    console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
    
    const { userId, action } = req.body;
    
    console.log(`👤 User ID: ${userId}`);
    console.log(`🎯 Action type: ${action?.type}`);
    console.log(`📊 Action data:`, JSON.stringify(action?.data, null, 2));
    
    // Validate user exists
    const userCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    console.log(`👤 User check: ${userCheck.rows.length} rows found`);
    
    if (userCheck.rows.length === 0) {
      console.error(`❌ User ${userId} not found`);
      return res.status(404).json({ 
        error: 'User not found',
        message: `User with ID ${userId} does not exist`
      });
    }
    
    const { listName, itemId, operation, newText } = action.data || {};
    
    console.log(`📋 Extracted values:`);
    console.log(`   - listName: "${listName}"`);
    console.log(`   - itemId: ${itemId}`);
    console.log(`   - operation: "${operation}"`);
    console.log(`   - newText: "${newText}"`);
    
    if (!listName || !itemId || !operation) {
      console.error('❌ Missing required fields:', { listName, itemId, operation });
      return res.status(400).json({ 
        error: 'Missing required fields: listName, itemId, operation',
        received: { listName, itemId, operation }
      });
    }
    
    let result;
    
    console.log(`🚀 Starting ${operation} operation...`);
    
    switch (operation) {
      case 'complete':
        console.log(`✅ Calling updateListItemStatus(${userId}, "${listName}", ${itemId}, true)`);
        result = await updateListItemStatus(userId, listName, itemId, true);
        break;
        
      case 'uncomplete':
        console.log(`⭕ Calling updateListItemStatus(${userId}, "${listName}", ${itemId}, false)`);
        result = await updateListItemStatus(userId, listName, itemId, false);
        break;
        
      case 'delete':
        console.log(`🗑️ Calling deleteListItem(${userId}, "${listName}", ${itemId})`);
        result = await deleteListItem(userId, listName, itemId);
        break;
        
      case 'edit':
        if (!newText) {
          console.error('❌ newText is required for edit operation');
          return res.status(400).json({ 
            error: 'newText is required for edit operation' 
          });
        }
        console.log(`📝 Calling updateListItemText(${userId}, "${listName}", ${itemId}, "${newText}")`);
        result = await updateListItemText(userId, listName, itemId, newText);
        break;
        
      default:
        console.error(`❌ Unknown operation: ${operation}`);
        return res.status(400).json({ 
          error: `Unknown operation: ${operation}` 
        });
    }
    
    console.log(`✅ Operation completed successfully!`);
    console.log(`📄 Result:`, JSON.stringify(result, null, 2));
    console.log('🔍 ===== END DEBUGGING =====\n');
    
    res.json({ 
      success: true, 
      operation,
      listName,
      itemId,
      result 
    });
    
  } catch (error) {
    console.error('❌ ERROR in /lists/update:', error);
    console.error('❌ Error stack:', error.stack);
    console.log('🔍 ===== END DEBUGGING (ERROR) =====\n');
    
    res.status(500).json({ 
      error: 'Failed to update list item',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.delete('/lists/:userId/:listName', async (req, res) => {
  try {
    const { userId, listName } = req.params;
    
    console.log(`🗑️ DELETE LIST Request - User: ${userId}, List: "${listName}"`);
    
    await ensureUser(userId);
    const result = await deleteUserList(userId, listName);
    
    console.log(`✅ Successfully deleted list: "${listName}"`);
    res.json({ 
      success: true, 
      message: `List "${listName}" deleted successfully`,
      deletedList: result,
      deletedItemsCount: result.deletedItemsCount
    });
    
  } catch (error) {
    console.error('❌ Error deleting list:', error);
    res.status(500).json({ 
      error: 'Failed to delete list',
      details: error.message
    });
  }
});


//SCHEDULE 

router.post('/schedules/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { scheduleName, scheduleType, description, color, timezone } = req.body;
      
      await ensureUser(userId);
      const schedule = await createUserSchedule(userId, scheduleName, scheduleType, { description, color, timezone });
      
      res.status(201).json(schedule);
    } catch (error) {
      console.error('❌ Error creating schedule:', error);
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create schedule' });
      }
    }
});

router.post('/schedules/:userId/:scheduleName/events', async (req, res) => {
    try {
      const { userId, scheduleName } = req.params;
      const { 
        eventTitle, 
        startTime, 
        endTime, 
        location, 
        eventDescription, 
        eventType,
        isAllDay,
        reminderMinutes 
      } = req.body;
      
      await ensureUser(userId);
      const event = await addEventToSchedule(userId, scheduleName, eventTitle, startTime, {
        end_time: endTime,
        location,
        event_description: eventDescription,
        event_type: eventType,
        is_all_day: isAllDay,
        reminder_minutes: reminderMinutes
      });
      
      res.status(201).json(event);
    } catch (error) {
      console.error('❌ Error adding event to schedule:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to add event to schedule' });
      }
    }
});
  
router.get('/schedules/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const schedules = await getUserSchedules(userId);
      res.json(schedules);
    } catch (error) {
      console.error('❌ Error getting user schedules:', error);
      res.status(500).json({ error: 'Failed to get user schedules' });
    }
});

router.put('/schedules/:userId/:scheduleName/events/:eventId', async (req, res) => {
  try {
    const { userId, scheduleName, eventId } = req.params;
    const updates = req.body;
    
    console.log(`📝 EDIT EVENT Request - User: ${userId}, Schedule: "${scheduleName}", Event: ${eventId}`);
    console.log(`📝 Updates:`, updates);
    
    await ensureUser(userId);
    const result = await updateEvent(userId, scheduleName, parseInt(eventId), updates);
    
    console.log(`✅ Successfully updated event: ${eventId}`);
    res.json({ 
      success: true, 
      message: `Event updated successfully`,
      updatedEvent: result,
      appliedUpdates: Object.keys(updates)
    });
    
  } catch (error) {
    console.error('❌ Error updating event:', error);
    res.status(500).json({ 
      error: 'Failed to update event',
      details: error.message
    });
  }
});


router.delete('/schedules/:userId/:scheduleName/events/:eventId', async (req, res) => {
  try {
    const { userId, scheduleName, eventId } = req.params;
    
    console.log(`🗑️ DELETE EVENT Request - User: ${userId}, Schedule: "${scheduleName}", Event: ${eventId}`);
    
    await ensureUser(userId);
    const result = await deleteEvent(userId, scheduleName, parseInt(eventId));
    
    console.log(`✅ Successfully deleted event: ${eventId}`);
    res.json({ 
      success: true, 
      message: `Event deleted successfully`,
      deletedEvent: result
    });
    
  } catch (error) {
    console.error('❌ Error deleting event:', error);
    res.status(500).json({ 
      error: 'Failed to delete event',
      details: error.message
    });
  }
});


router.delete('/schedules/:userId/:scheduleName', async (req, res) => {
  try {
    const { userId, scheduleName } = req.params;
    
    console.log(`🗑️ DELETE SCHEDULE Request - User: ${userId}, Schedule: "${scheduleName}"`);
    
    await ensureUser(userId);
    const result = await deleteUserSchedule(userId, scheduleName);
    
    console.log(`✅ Successfully deleted schedule: "${scheduleName}"`);
    res.json({ 
      success: true, 
      message: `Schedule "${scheduleName}" deleted successfully`,
      deletedSchedule: result,
      deletedEventsCount: result.deletedEventsCount
    });
    
  } catch (error) {
    console.error('❌ Error deleting schedule:', error);
    res.status(500).json({ 
      error: 'Failed to delete schedule',
      details: error.message
    });
  }
});


//MEMORY
router.post('/memory/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { categoryName, categoryType, description, color, icon } = req.body;
      
      await ensureUser(userId);
      const category = await createMemoryCategory(userId, categoryName, categoryType, { description, color, icon });
      
      res.status(201).json(category);
    } catch (error) {
      console.error('❌ Error creating memory category:', error);
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create memory category' });
      }
    }
});
  
router.post('/memory/:userId/:categoryName/items', async (req, res) => {
    try {
      const { userId, categoryName } = req.params;
      const { 
        memoryKey, 
        memoryValue, 
        memoryType, 
        importance, 
        tags, 
        expiresAt,
        isPrivate 
      } = req.body;
      
      await ensureUser(userId);
      const memory = await addMemoryItem(userId, categoryName, memoryKey, memoryValue, {
        memory_type: memoryType,
        importance,
        tags,
        expires_at: expiresAt,
        is_private: isPrivate
      });
      
      res.status(201).json(memory);
    } catch (error) {
      console.error('❌ Error adding memory item:', error);
      res.status(500).json({ error: 'Failed to add memory item' });
    }
});
  
router.get('/memory/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const memories = await getUserMemories(userId);
      res.json(memories);
    } catch (error) {
      console.error('❌ Error getting user memories:', error);
      res.status(500).json({ error: 'Failed to get user memories' });
    }
});

//Conversation History 
router.get('/conversations/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 50 } = req.query;
      
      const result = await pool.query(
        'SELECT message, response, actions, mode, language, created_at FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error getting conversations:', error);
      res.status(500).json({ error: 'Failed to get conversations' });
    }
});
  
/*AI CHAT ROUTE */

router.post('/chat', async (req, res) => {
    try {
      const { message, mode, context, language, userId = 'default' } = req.body;
      
      console.log(`📨 [${userId}] "${message}" (${mode} mode)`);
  
      // Ensure user exists and get their profile
      await ensureUser(userId);
      const userProfile = await getUserProfile(userId);
      
      // Use user's preferred language if not specified
      const effectiveLanguage = language || userProfile?.preferred_language || 'en-US';
      
      console.log(`🌍 Using language: ${effectiveLanguage} (user preference: ${userProfile?.preferred_language})`);
  
      const { context: smartContext } = await buildSmartContext(userId, mode, context || {}, message);

  
      const contextSize = smartContext.length;
      console.log(`🧠 Smart context: ${contextSize} chars`);
  
      // Enhanced system prompt with user context
      const enhancedSystemPrompt = `You are an intelligent multilingual personal assistant for ${userProfile?.display_name || userId}. 
      
    User's preferred language: ${effectiveLanguage}
    User's display name: ${userProfile?.display_name || userId}
    
    ${SYSTEM_PROMPT}`;
    
        // Create AI prompt with smart context
        const aiPrompt = `${enhancedSystemPrompt}
    
    CURRENT CONTEXT:
    ${smartContext}
    
    USER MESSAGE: "${message}"
    
    Respond in ${effectiveLanguage} and understand the user's intent, providing actions if needed.`;
  
      // Let AI handle everything
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: aiPrompt
          },
          {
            role: "user", 
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
  
      let aiResponse = completion.choices[0].message.content;
      console.log(`🤖 AI Response: ${aiResponse.substring(0, 100)}...`);
  
      // Parse AI response
      let responseData;
      try {
        responseData = JSON.parse(aiResponse);
      } catch (e) {
        console.log("⚠️ AI didn't return JSON, creating structure");
        responseData = {
          response: aiResponse,
          actions: []
        };
      }
  
      // Validate response structure
      if (!responseData.response) {
        responseData.response = "I'm here to help! What would you like me to do?";
      }
      if (!responseData.actions) {
        responseData.actions = [];
      }
  
      // Save conversation to database with effective language
      await saveConversation(userId, message, responseData.response, responseData.actions, mode, effectiveLanguage);
  
      console.log(`📤 Sending ${responseData.actions.length} actions`);
      res.json(responseData);
  
    } catch (error) {
      console.error('❌ Error:', error);
      res.status(500).json({ 
        response: "Sorry, I encountered an error. Please try again.",
        actions: []
      });
    }
});


/* Translation Route */
router.post('/translate', async (req, res) => {
    try {
      const { text, targetLanguage } = req.body;
      
      console.log(`🌍 Translating "${text}" to ${targetLanguage}`);

      // Use your existing OpenAI instance for translation
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a translator. Translate the given text to ${targetLanguage}. Only return the translated text, nothing else.`
          },
          {
            role: "user", 
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const translatedText = completion.choices[0].message.content.trim();
      
      console.log(`✅ Translated: "${text}" -> "${translatedText}"`);
      
      res.json({ translatedText });

    } catch (error) {
      console.error('❌ Translation error:', error);
      res.status(500).json({ 
        error: 'Translation failed',
        translatedText: text // Return original text on error
      });
    }
});

module.exports = router;