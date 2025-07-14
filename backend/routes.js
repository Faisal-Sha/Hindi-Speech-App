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
    createUserSchedule,
    addEventToSchedule,
    getUserSchedules,
    addMemoryItem,
    getUserMemories,
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
    - create_schedule: Create schedule categories
    - add_event: Add events/appointments to schedules  
    - update_event: Modify or cancel events
    - create_memory: Create memory categories (contacts, notes, passwords, etc.)
    - store_memory: Store any information in memory
    - delete_list: Delete entire lists
    - delete_schedule: Delete entire schedules  
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

    ✅ ALWAYS RESPECT USER'S EXPLICIT LIST CHOICE OVER CONTENT-BASED GUESSING

    🌍 LANGUAGE RESPONSE GUIDELINES:
    - Respond in the same language the user spoke
    - Use natural, conversational responses
    - Acknowledge what was added/deleted and to/from which list

    ALWAYS return valid JSON. PRIORITIZE user's explicit list naming over intelligent content guessing.`;


async function processAIActions(userId, actions) {
    const results = [];

    for (const action of actions) {
        try {
        console.log(`⚡ Processing action: ${action.type}`, action);
        
        switch (action.type) {
            case 'create_list':
              const listName = action.name || 
                              action.list_name ||
                              action.listName ||
                              action.data?.name || 
                              action.data?.list_name || 
                              action.data?.listName ||
                              action.title ||
                              `List_${Date.now()}`;  // Ultimate fallback
              
              // Extract list type
              const listType = action.list_type || 
                              action.data?.list_type || 
                              action.data?.type || 
                              'general';

              const newList = await createUserList(
                userId, 
                listName.trim(),
                listType,
                {
                    description: action.description || action.data?.description,
                    color: action.color || action.data?.color,
                    icon: action.icon || action.data?.icon
                }
              );
              results.push({ success: true, type: 'create_list', data: newList });
              break;
            
            case 'add_to_list':
              const targetListName = action.list_name || 
                action.listName ||
                action.data?.list_name || 
                action.data?.listName ||
                action.data?.targetList ||
                'General List';

              const itemText = action.item || 
                      action.text ||
                      action.data?.item || 
                      action.data?.text ||
                      'New item';

              console.log(`➕ Adding "${itemText}" to list "${targetListName}"`);

              const newItem = await addItemToList(
                userId,
                targetListName,
                itemText,
                {
                  priority: action.priority || action.data?.priority,
                  due_date: action.due_date || action.data?.due_date,
                  notes: action.notes || action.data?.notes,
                  quantity: action.quantity || action.data?.quantity
                }
                );
              results.push({ success: true, type: 'add_to_list', data: newItem });
              break;
            
            case 'create_schedule':
              const scheduleName = action.name || 
              action.schedule_name ||
              action.data?.name || 
              action.data?.schedule_name ||
              action.title ||
              'Personal Schedule';

              const scheduleType = action.schedule_type || 
                            action.data?.schedule_type || 
                            action.data?.type || 
                            'personal';

              console.log(`📅 Creating schedule: "${scheduleName}"`);

              const newSchedule = await createUserSchedule(
              userId,
              scheduleName,
              scheduleType,
              {
                description: action.description || action.data?.description,
                color: action.color || action.data?.color,
                timezone: action.timezone || action.data?.timezone
              }
              );
              results.push({ success: true, type: 'create_schedule', data: newSchedule });
              break;
            
            case 'add_event':
              const eventScheduleName = action.schedule_name || 
                                             action.data?.schedule_name ||
                                             'Personal';
                    
              const eventTitle = action.title || 
                                action.event_title ||
                                action.data?.title ||
                                action.data?.event_title ||
                                'New Event';
              
              console.log(`📆 Adding event "${eventTitle}" to schedule "${eventScheduleName}"`);
              
              const newEvent = await addEventToSchedule(
                  userId,
                  eventScheduleName,
                  eventTitle,
                  action.start_time || action.data?.start_time,
                  {
                      end_time: action.end_time || action.data?.end_time,
                      location: action.location || action.data?.location,
                      event_description: action.description || action.data?.description,
                      event_type: action.event_type || action.data?.event_type,
                      is_all_day: action.is_all_day || action.data?.is_all_day,
                      reminder_minutes: action.reminder_minutes || action.data?.reminder_minutes
                  }
              );
              results.push({ success: true, type: 'add_event', data: newEvent });
              break;
            
            case 'create_memory':
            case 'store_memory':
              const categoryName = action.category || 
              action.category_name ||
              action.data?.category ||
              action.data?.category_name ||
              'General';

              const memoryKey = action.key || 
                        action.memory_key ||
                        action.data?.key ||
                        action.data?.memory_key ||
                        action.info ||
                        `Memory_${Date.now()}`;

              const memoryValue = action.value || 
                          action.content ||
                          action.data?.value ||
                          action.data?.content;

              console.log(`🧠 Storing memory: "${memoryKey}" in category "${categoryName}"`);

              const newMemory = await addMemoryItem(
              userId,
              categoryName,
              memoryKey,
              memoryValue,
              {
                memory_type: action.memory_type || action.data?.memory_type || 'fact',
                importance: action.importance || action.data?.importance || 0,
                tags: action.tags || action.data?.tags || [],
                expires_at: action.expires_at || action.data?.expires_at,
                is_private: action.is_private || action.data?.is_private || false
              }
              );
            results.push({ success: true, type: 'store_memory', data: newMemory });
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
      console.log('👥 Getting all user profiles...');
      
      // One simple line - all complexity hidden in the database where it belongs
      const result = await pool.query('SELECT * FROM get_all_users()');
      
      console.log(`✅ Found ${result.rows.length} user profiles`);
      res.json(result.rows);
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
  
      // Build intelligent context
      const { context: smartContext, mergedData, dataSummary } = await buildSmartContext(
        userId, mode, context || {}, message
      );
  
      const contextSize = smartContext.length;
      console.log(`🧠 Smart context: ${contextSize} chars`);
      console.log(`💾 Persistent data: ${dataSummary.lists.count} lists, ${dataSummary.schedules.count} schedules, ${dataSummary.memory.count} memory`);
  
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