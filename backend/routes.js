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
const { EnhancedSmartActionProcessor } = require('./action-processor');

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


//AI SYSTEM PROMPT
const ENHANCED_SYSTEM_PROMPT = `You are an intelligent multilingual personal assistant. Your job is to understand natural language and help users manage their digital life intelligently.

🧠 CORE INTELLIGENCE PRINCIPLES:

1. **UNDERSTAND INTENT, NOT JUST KEYWORDS**: 
   - "create a list for tomorrow" → understand user wants a list for Thursday (if today is Wednesday)
   - "how many events do we have?" → understand user wants a count/query
   - "edit the shopping list" → understand user wants to modify existing list
   - "dad wants to edit the list" → same as "edit the list", just different phrasing

2. **BE CONTEXT-AWARE AND SMART**:
   - If user says "tomorrow" and today is Wednesday, create/target "Thursday" list
   - If user has one list and says "add milk", add to that list regardless of name
   - If user asks about "events" or "meetings", search all schedules
   - Handle ambiguity intelligently by asking clarifying questions when needed
   - Remember recent context - if they just mentioned a list, "edit it" refers to that list

3. **CONVERSATIONAL AND HELPFUL**:
   - Always be encouraging and positive
   - If someone wants to edit but doesn't specify what, ask friendly follow-up questions
   - Use natural language - "I'll help you edit that!" instead of "Operation acknowledged"
   - Handle family references naturally - "dad wants to..." is the same as "I want to..."

4. **FLEXIBLE ACTION HANDLING**:
   You can perform ANY of these operations based on user intent:
   
   **DATA OPERATIONS:**
   - query_data: Answer questions about existing data ("how many events?", "what's on my shopping list?")
   - smart_create: Create lists/schedules with intelligent naming
   - smart_add: Add items with smart targeting
   - smart_update: Update/edit items intelligently (THIS IS KEY FOR EDIT REQUESTS)
   - smart_delete: Delete with confirmation and smart matching
   
   **SCHEDULE OPERATIONS:**
   - smart_schedule: Handle any scheduling request with natural language dates
   - query_schedule: Answer questions about schedules
   
   **MEMORY OPERATIONS:**
   - smart_remember: Store any information naturally
   - query_memory: Retrieve stored information

5. **NATURAL LANGUAGE PROCESSING**:
   - Parse dates naturally: "tomorrow", "next Friday", "in 2 hours"
   - Handle quantities: "a few items", "several meetings"
   - Understand relationships: "the list I created yesterday"
   - Handle pronouns: "add it to the list", "delete that", "edit it"
   - Handle family references: "dad wants to", "mom said to", "we need to"

🎯 RESPONSE FORMAT - Always return valid JSON:
{
  "response": "Natural conversational response in user's language",
  "actions": [
    {
      "type": "action_type",
      "intent": "natural description of what you're doing",
      "data": {
        "target": "what you're targeting (list name, schedule, etc.)",
        "operation": "what you're doing (create, add, update, delete, query, prepare_edit)",
        "values": ["array of items/values"],
        "metadata": {
          "smartDate": "parsed date if relevant",
          "confidence": "high/medium/low",
          "disambiguation": "if multiple options exist",
          "conversationalContext": "recent context to remember"
        }
      }
    }
  ],
  "queries": [
    {
      "type": "count_events" | "list_items" | "memory_search",
      "parameters": { "category": "schedules", "filters": {} }
    }
  ],
  "clarifications": [
    "Which list did you mean - Shopping List or Todo List?"
  ]
}

🤖 EXAMPLE RESPONSES FOR BETTER CONVERSATION HANDLING:

User: "edit the shopping list"
{
  "response": "I'll help you edit your shopping list! What would you like to do - add new items, remove something, or mark items as completed?",
  "actions": [{
    "type": "smart_update",
    "intent": "preparing to edit the shopping list",
    "data": {
      "target": "Shopping List",
      "operation": "prepare_edit",
      "metadata": {
        "confidence": "high",
        "conversationalContext": "user wants to edit shopping list"
      }
    }
  }],
  "clarifications": ["What changes would you like to make to your shopping list?"]
}

User: "dad wants to edit the list" (when user has multiple lists)
{
  "response": "I'd be happy to help edit a list! I see you have several lists. Which one would you like to edit?",
  "actions": [{
    "type": "smart_update", 
    "intent": "preparing to edit a list (need clarification)",
    "data": {
      "target": "any_list",
      "operation": "prepare_edit",
      "metadata": {
        "confidence": "medium",
        "conversationalContext": "user (or dad) wants to edit some list",
        "needsListSelection": true
      }
    }
  }],
  "clarifications": ["Which list would you like to edit?"]
}

User: "dad wants to edit the list" (when user has only ONE list)
{
  "response": "I'll help edit your list! What changes would you like to make?",
  "actions": [{
    "type": "smart_update",
    "intent": "preparing to edit the user's only list", 
    "data": {
      "target": "user_only_list",
      "operation": "prepare_edit",
      "metadata": {
        "confidence": "high",
        "conversationalContext": "editing the single list user has"
      }
    }
  }],
  "clarifications": ["What would you like to add, remove, or change?"]
}

User: "how many events do we have scheduled?"
{
  "response": "Let me check your scheduled events...",
  "actions": [],
  "queries": [{
    "type": "count_events",
    "parameters": { "category": "all_schedules" }
  }]
}

User: "create a list for tomorrow" (today is Wednesday)
{
  "response": "I'll create a list for Thursday for you!",
  "actions": [{
    "type": "smart_create",
    "intent": "creating a list for Thursday",
    "data": {
      "target": "Thursday",
      "operation": "create_list",
      "values": [],
      "metadata": {
        "smartDate": "Thursday",
        "confidence": "high",
        "conversationalContext": "created Thursday list"
      }
    }
  }]
}

User: "add milk to it" (following previous context)
{
  "response": "I'll add milk to your Thursday list!",
  "actions": [{
    "type": "smart_add",
    "intent": "adding milk to the recently mentioned Thursday list",
    "data": {
      "target": "Thursday",
      "operation": "add_to_list", 
      "values": ["milk"],
      "metadata": {
        "confidence": "high",
        "conversationalContext": "adding to Thursday list from previous context"
      }
    }
  }]
}

🔍 INTELLIGENT MATCHING RULES:

1. **Smart Date Parsing**: 
   - "tomorrow" → calculate actual date
   - "next week" → calculate date range
   - "Friday" → next occurring Friday

2. **Smart Targeting**:
   - One list exists → always target it regardless of user's wording
   - Multiple lists → use content clues or ask for clarification
   - No lists → create with intelligent naming

3. **Query Intelligence**:
   - "events" → search all schedules
   - "items" → search all lists  
   - "contacts" → search memory for people
   - "how many" → return counts
   - "what's" → return contents

4. **Context Awareness**:
   - Remember what user was just talking about
   - Use pronouns intelligently ("add it", "delete that", "edit it")
   - Handle follow-up questions naturally
   - Family references are treated as user requests

5. **Edit Request Handling**:
   - "edit the list" → smart_update with prepare_edit operation
   - "change the schedule" → smart_update with prepare_edit for schedules
   - "modify my memory" → smart_update with prepare_edit for memory
   - Always ask follow-up questions for ambiguous edit requests

Remember: Your goal is to be genuinely helpful and intelligent, not just pattern matching. Think about what the user ACTUALLY wants to accomplish. Treat family member requests ("dad wants to", "mom said") as direct user requests. Always be encouraging and helpful when someone wants to edit or modify their data.`;


// Initialize smart processor
let smartProcessor;

function initializeSmartProcessor() {
  const dbFunctions = {
    createUserList,
    addItemToList,
    getUserLists,
    createUserSchedule,
    addEventToSchedule,
    getUserSchedules,
    createMemoryCategory,
    addMemoryItem,
    getUserMemories,
    updateListItemStatus,
    updateListItemText,
    deleteListItem,
    deleteUserList,
    updateEvent,
    deleteEvent,
    deleteUserSchedule,
    updateMemoryItem,
    deleteMemoryItem,
    deleteMemoryCategory
  };
  
  // Initialize processor with database functions and OpenAI
  smartProcessor = new EnhancedSmartActionProcessor(dbFunctions, openai);
  
  console.log('✅ Smart action processor initialized with organized imports');
}

// Initialize on startup
initializeSmartProcessor();

/*============================================
  MAIN CHAT ROUTE - AI-POWERED INTELLIGENCE
============================================*/

router.post('/chat', async (req, res) => {
  try {
    const { message, mode, context, language, userId = 'default' } = req.body;
    
    console.log(`📨 [${userId}] "${message}" (${mode} mode)`);

    // Ensure user exists and get their profile
    await ensureUser(userId);
    const userProfile = await getUserProfile(userId);
    const effectiveLanguage = language || userProfile?.preferred_language || 'en-US';

    // Build smart context for AI
    const { context: smartContext, dataSummary } = await buildSmartContext(userId, mode, context || {}, message);

    // Create AI prompt with context - FORCE JSON RESPONSE
    const aiPrompt = `${ENHANCED_SYSTEM_PROMPT}

      CURRENT USER DATA:
      ${smartContext}

      DATA SUMMARY:
      - Lists: ${dataSummary.lists.count} (${dataSummary.lists.names.join(', ') || 'none'})
      - Schedules: ${dataSummary.schedules.count} (${dataSummary.schedules.names.join(', ') || 'none'})
      - Memory Categories: ${dataSummary.memory.count} (${dataSummary.memory.categories.join(', ') || 'none'})

      IMPORTANT: The AI matching system will handle finding the right lists/schedules, so don't worry about exact names. Focus on understanding what the user wants to accomplish.

      USER MESSAGE: "${message}"

      CRITICAL: You MUST respond with VALID JSON in this exact format. Do not include any text outside the JSON:

      {
        "response": "Natural conversational response in ${effectiveLanguage}",
        "actions": [
          {
            "type": "smart_add",
            "intent": "description of what you're doing",
            "data": {
              "target": "Shopping List",
              "operation": "add_to_list",
              "values": ["milk", "bread", "eggs"],
              "metadata": {
                "confidence": "high"
              }
            }
          }
        ],
        "queries": []
      }`;

    // Get AI response with JSON mode
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: aiPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 1500,
      temperature: 0.7,
      response_format: { type: "json_object" } // Force JSON response
    });

    let aiResponse = completion.choices[0].message.content;
    console.log(`🤖 AI Response: ${aiResponse.substring(0, 200)}...`);

    // Parse AI response with better error handling
    let responseData;
    try {
      responseData = JSON.parse(aiResponse);
      console.log('✅ Successfully parsed JSON response');
      console.log('📋 Actions generated:', responseData.actions?.length || 0);
    } catch (e) {
      console.error("❌ AI didn't return valid JSON:", e);
      console.error("Raw AI response:", aiResponse);
      
      // Create a manual action based on the message content
      responseData = {
        response: aiResponse || "I'll help you with that!",
        actions: [],
        queries: []
      };
      
      // Try to manually create an action for common patterns
      if (message.toLowerCase().includes('add') && message.toLowerCase().includes('list')) {
        const items = extractItemsFromMessage(message);
        const targetList = extractListFromMessage(message, Object.keys(dataSummary.lists.names || {}));
        
        if (items.length > 0) {
          responseData.actions = [{
            type: "smart_add",
            intent: `Adding items to list`,
            data: {
              target: targetList || "Shopping List",
              operation: "add_to_list", 
              values: items,
              metadata: {
                confidence: "medium",
                fallbackGenerated: true
              }
            }
          }];
          responseData.response = `I'll add ${items.join(', ')} to your ${targetList || 'Shopping List'}!`;
          console.log('🔧 Generated fallback action:', responseData.actions[0]);
        }
      }
    }

    // Validate response structure
    responseData.response = responseData.response || "I'm here to help!";
    responseData.actions = responseData.actions || [];
    responseData.queries = responseData.queries || [];

    console.log(`🎯 Final actions to process: ${responseData.actions.length}`);
    responseData.actions.forEach((action, i) => {
      console.log(`  ${i+1}. ${action.type}: ${action.intent || action.data?.operation}`);
    });

    // Process all actions and queries with smart processor
    let actionResults = [];
    const allActions = [...(responseData.actions || []), ...(responseData.queries || [])];
    
    if (allActions.length > 0) {
      console.log(`🎯 Processing ${allActions.length} actions/queries`);
      
      for (const action of allActions) {
        try {
          console.log(`🤖 Processing: ${action.type} - ${action.intent || 'query'}`);
          
          // Smart processor handles everything (actions AND queries)
          const result = await smartProcessor.processAction(action, userId);
          actionResults.push(result);
          
          // Enhance response with results
          if (result.success) {
            if (result.summary) {
              // Query result - add summary to response
              responseData.response += `\n\n${result.summary}`;
            }
            
            if (result.details?.aiDecision) {
              // Action result - mention AI decision
              responseData.response += `\n\n(Successfully processed!)`;
            }
          }
          
          console.log(`✅ Action/Query completed:`, result);
        } catch (error) {
          console.error(`❌ Error processing action/query:`, action, error);
          actionResults.push({
            success: false,
            error: error.message,
            action: action.type
          });
        }
      }
    } else {
      console.log('⚠️ No actions generated - AI may need better prompting');
    }

    // Save conversation to database
    await saveConversation(userId, message, responseData.response, responseData.actions, mode, effectiveLanguage);

    // Send enhanced response
    const finalResponse = {
      ...responseData,
      actionResults,
      metadata: {
        actionsProcessed: actionResults.length,
        aiMatchingUsed: actionResults.some(r => r.details?.aiDecision),
        language: effectiveLanguage,
        mode,
        architecture: 'organized-files',
        contextSize: smartContext.length
      }
    };

    console.log(`📤 Sending response with ${actionResults.length} processed actions/queries`);
    res.json(finalResponse);

  } catch (error) {
    console.error('❌ Enhanced chat error:', error);
    res.status(500).json({ 
      response: "Sorry, I encountered an error. Please try again.",
      actions: [],
      queries: [],
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    });
  }
});

// Helper functions for fallback action generation
function extractItemsFromMessage(message) {
  const addPatterns = [
    /add\s+(.+?)\s+to/i,
    /add\s+(.+)$/i
  ];
  
  for (const pattern of addPatterns) {
    const match = message.match(pattern);
    if (match) {
      const itemsStr = match[1];
      // Split by common delimiters
      const items = itemsStr.split(/,|\sand\s|\&/).map(item => item.trim()).filter(item => item.length > 0);
      return items;
    }
  }
  
  return [];
}

function extractListFromMessage(message, existingLists) {
  const listPatterns = [
    /to\s+(?:the\s+)?(.+?)\s*(?:list)?$/i,
    /to\s+(?:my\s+)?(.+?)$/i
  ];
  
  for (const pattern of listPatterns) {
    const match = message.match(pattern);
    if (match) {
      const targetName = match[1].trim();
      
      // Try to find exact match first
      for (const listName of existingLists) {
        if (listName.toLowerCase().includes(targetName.toLowerCase()) || 
            targetName.toLowerCase().includes(listName.toLowerCase())) {
          return listName;
        }
      }
      
      return targetName;
    }
  }
  
  return null;
}

/*============================================
  ENHANCED DATA PROCESSING ROUTE
============================================*/

router.post('/save-data-enhanced', async (req, res) => {
  try {
    const { userId, actions } = req.body;
    
    console.log(`💾 Processing ${actions.length} enhanced actions for user ${userId}`);
    
    await ensureUser(userId);
    
    const results = [];
    
    for (const action of actions) {
      try {
        // Smart processor handles all action types
        const result = await smartProcessor.processAction(action, userId);
        
        results.push({
          success: true,
          action: action.type,
          result
        });
        
      } catch (error) {
        console.error(`❌ Error processing action ${action.type}:`, error);
        results.push({
          success: false,
          action: action.type,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    console.log(`✅ Enhanced processing complete: ${successCount} successful, ${errorCount} failed`);
    
    res.json({ 
      success: true, 
      processed: results.length,
      successful: successCount,
      failed: errorCount,
      results,
      architecture: 'organized-files'
    });
  } catch (error) {
    console.error('❌ Error in enhanced data processing:', error);
    res.status(500).json({ error: 'Failed to process enhanced data' });
  }
});

























/* Health Functions */
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


///////////////////////////
/* DATA RETRIEVAL*/
//////////////////////////

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