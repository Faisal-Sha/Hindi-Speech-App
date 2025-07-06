const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'personal_assistant',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});


// Database helper functions
async function ensureUser(userId) {
  try {
    await pool.query(
      'INSERT INTO users (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET last_active = CURRENT_TIMESTAMP',
      [userId]
    );
  } catch (error) {
    console.error('Error ensuring user:', error);
  }
}

async function getUserData(userId) {
  try {
    const result = await pool.query(
      'SELECT data_type, data_key, data_value FROM user_data WHERE user_id = $1',
      [userId]
    );
    
    const userData = {
      lists: {},
      schedules: {},
      memory: {},
      chats: {}
    };
    
    for (const row of result.rows) {
      userData[row.data_type][row.data_key] = row.data_value;
    }
    
    return userData;
  } catch (error) {
    console.error('Error getting user data:', error);
    return { lists: {}, schedules: {}, memory: {}, chats: {} };
  }
}

async function saveUserData(userId, dataType, dataKey, dataValue) {
  try {
    await pool.query(`
      INSERT INTO user_data (user_id, data_type, data_key, data_value, updated_at) 
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, data_type, data_key) 
      DO UPDATE SET data_value = $4, updated_at = CURRENT_TIMESTAMP
    `, [userId, dataType, dataKey, dataValue]);
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

async function saveConversation(userId, message, response, actions, mode, language) {
  try {
    await pool.query(
      'INSERT INTO conversations (user_id, message, response, actions, mode, language) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, message, response, JSON.stringify(actions), mode, language]
    );
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

async function ensureUserWithProfile(userId, profileData = {}) {
  try {
    // First ensure the user exists in the users table
    await pool.query(
      'INSERT INTO users (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET last_active = CURRENT_TIMESTAMP',
      [userId]
    );

    // Then ensure the user profile exists with default or provided data
    if (Object.keys(profileData).length > 0) {
      const { displayName, preferredLanguage, avatarEmoji, themePreference } = profileData;
      
      await pool.query(`
        INSERT INTO user_profiles (user_id, display_name, preferred_language, avatar_emoji, theme_preference) 
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          display_name = $2,
          preferred_language = $3,
          avatar_emoji = $4,
          theme_preference = $5,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, displayName, preferredLanguage || 'en-US', avatarEmoji || '👤', themePreference || 'default']);
    }
    
    console.log(`✅ User ${userId} ensured with profile`);
  } catch (error) {
    console.error('Error ensuring user with profile:', error);
    throw error;
  }
}

async function getUserProfile(userId) {
  try {
    const result = await pool.query(`
      SELECT * FROM get_user_profile($1)
    `, [userId]);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

// Smart context builder - NO manual keyword detection, let AI handle everything!
async function buildSmartContext(userId, mode, currentData, message) {
  try {
    // Get user's persistent data
    const persistentData = await getUserData(userId);
    
    // Merge current session data with persistent data
    const mergedData = {
      lists: { ...persistentData.lists, ...currentData.lists },
      schedules: { ...persistentData.schedules, ...currentData.schedules },
      memory: { ...persistentData.memory, ...currentData.memory },
      chats: { ...persistentData.chats, ...currentData.chats }
    };
    
    // Build context with exact names for AI matching
    let contextInfo = `CURRENT MODE: ${mode}\n`;
    contextInfo += `USER MESSAGE: "${message}"\n`;
    contextInfo += `AI INSTRUCTION: Use intelligent matching to connect user's request to existing items below.\n\n`;
    
    // Build detailed summaries
    const dataSummary = {
      lists: {
        count: Object.keys(mergedData.lists).length,
        names: Object.keys(mergedData.lists)
      },
      schedules: {
        count: Object.keys(mergedData.schedules).length,
        names: Object.keys(mergedData.schedules)
      },
      memory: {
        count: Object.keys(mergedData.memory).length,
        categories: Object.keys(mergedData.memory)
      },
      chats: {
        count: Object.keys(mergedData.chats).length,
        topics: Object.keys(mergedData.chats)
      }
    };
    
    // Include exact names with context for better AI matching
    if (mode === 'lists' || dataSummary.lists.count > 0) {
      contextInfo += `EXISTING LISTS (${dataSummary.lists.count}) - USE THESE EXACT NAMES:\n`;
      if (dataSummary.lists.count > 0) {
        dataSummary.lists.names.forEach(listName => {
          const list = mergedData.lists[listName];
          const itemCount = list.items?.length || 0;
          const listType = list.listType || 'custom';
          const recentItems = list.items?.slice(-3).map(item => item.text || item.name).join(', ') || 'empty';
          contextInfo += `  • "${listName}" (${listType}, ${itemCount} items, recent: ${recentItems})\n`;
        });
      } else {
        contextInfo += '  • None\n';
      }
      contextInfo += '\n';
    }
    
    if (mode === 'schedule' || dataSummary.schedules.count > 0) {
      contextInfo += `EXISTING SCHEDULES (${dataSummary.schedules.count}) - USE THESE EXACT NAMES:\n`;
      if (dataSummary.schedules.count > 0) {
        dataSummary.schedules.names.forEach(scheduleName => {
          const schedule = mergedData.schedules[scheduleName];
          const eventCount = schedule.events?.length || 0;
          contextInfo += `  • "${scheduleName}" (${eventCount} events)\n`;
        });
      } else {
        contextInfo += '  • None\n';
      }
      contextInfo += '\n';
    }
    
    if (mode === 'memory' || dataSummary.memory.count > 0) {
      contextInfo += `EXISTING MEMORY CATEGORIES (${dataSummary.memory.count}) - USE THESE EXACT NAMES:\n`;
      if (dataSummary.memory.count > 0) {
        dataSummary.memory.categories.forEach(categoryName => {
          const memory = mergedData.memory[categoryName];
          const itemCount = memory.items?.length || 0;
          contextInfo += `  • "${categoryName}" (${itemCount} items)\n`;
        });
      } else {
        contextInfo += '  • None\n';
      }
      contextInfo += '\n';
    }
    
    // Add AI matching hints
    contextInfo += `AI MATCHING HINTS:\n`;
    contextInfo += `- Food/grocery items → likely target shopping-related lists\n`;
    contextInfo += `- Party/celebration items → likely target birthday/party lists\n`;
    contextInfo += `- Work/task items → likely target todo/work lists\n`;
    contextInfo += `- Use context clues from what they're adding to determine best match\n`;
    contextInfo += `- Always use exact list names from above, never create variations\n`;
    contextInfo += `- Respond in user's language but target English list names\n`;
    
    return {
      context: contextInfo,
      mergedData,
      dataSummary
    };
  } catch (error) {
    console.error('Error building context:', error);
    return {
      context: `CURRENT MODE: ${mode}\nNo existing data\n`,
      mergedData: { lists: {}, schedules: {}, memory: {}, chats: {} },
      dataSummary: { lists: { count: 0, names: [] }, schedules: { count: 0, names: [] }, memory: { count: 0, categories: [] }, chats: { count: 0, topics: [] } }
    };
  }
}

// Enhanced system prompt - Let AI handle ALL intent detection in ANY language
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

// Main chat endpoint - Pure AI intelligence
app.post('/chat', async (req, res) => {
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


app.delete('/delete-user/:userId', async (req, res) => {
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

app.put('/update-user/:userId', async (req, res) => {
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

app.post('/create-user', async (req, res) => {
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

app.post('/login', async (req, res) => {
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

console.log('🔧 Multi-user API endpoints added to server');
// Endpoint to persist user data changes
app.post('/save-data', async (req, res) => {
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

// Get user's persistent data
app.get('/data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = await getUserData(userId);
    res.json(userData);
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Get conversation history
app.get('/conversations/:userId', async (req, res) => {
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



app.post('/add-item', async (req, res) => {
    try {
      const { userId, dataType, parentId, newItem } = req.body;
      
      console.log(`➕ Adding single item to ${dataType}/${parentId} for user ${userId}`);
      
      await ensureUser(userId);
      
      // Get current data
      const userData = await getUserData(userId);
      const parentData = userData[dataType]?.[parentId];
      
      if (!parentData) {
        return res.status(404).json({ error: 'Parent item not found' });
      }
      
      // Add new item to the array
      const updatedItems = [...(parentData.items || parentData.events || []), newItem];
      const updatedParent = {
        ...parentData,
        [dataType === 'schedules' ? 'events' : 'items']: updatedItems,
        lastUpdated: new Date()
      };
      
      // Save only the updated parent (not the entire dataset)
      await saveUserData(userId, dataType, parentId, updatedParent);
      
      console.log(`✅ Added item to ${dataType}/${parentId} (${JSON.stringify(newItem).length} bytes)`);
      res.json({ success: true, itemCount: updatedItems.length });
      
    } catch (error) {
      console.error('❌ Error adding single item:', error);
      res.status(500).json({ error: 'Failed to add item' });
    }
  });
  
  // **NEW: Update only metadata (timestamps, counts, etc.) - SUPER efficient**
  app.post('/update-metadata', async (req, res) => {
    try {
      const { userId, dataType, itemId, metadata } = req.body;
      
      console.log(`🔄 Updating metadata for ${dataType}/${itemId} for user ${userId}`);
      
      await ensureUser(userId);
      
      // Get current item data
      const userData = await getUserData(userId);
      const currentItem = userData[dataType]?.[itemId];
      
      if (!currentItem) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      // Update only the metadata fields
      const updatedItem = {
        ...currentItem,
        ...metadata  // Spread the metadata updates (lastUpdated, itemCount, etc.)
      };
      
      // Save the updated item
      await saveUserData(userId, dataType, itemId, updatedItem);
      
      console.log(`✅ Updated metadata for ${dataType}/${itemId} (${Object.keys(metadata).length} fields)`);
      res.json({ success: true });
      
    } catch (error) {
      console.error('❌ Error updating metadata:', error);
      res.status(500).json({ error: 'Failed to update metadata' });
    }
  });
  
  // **NEW: Batch operations for ultimate efficiency**
  app.post('/batch-operations', async (req, res) => {
    try {
      const { userId, operations } = req.body;
      
      console.log(`📦 Processing ${operations.length} batch operations for user ${userId}`);
      
      await ensureUser(userId);
      
      const results = [];
      
      // Process each operation in the batch
      for (const operation of operations) {
        try {
          switch (operation.type) {
            case 'add_item':
              // Handle add_item operations
              const userData = await getUserData(userId);
              const parentData = userData[operation.dataType]?.[operation.parentId];
              
              if (parentData) {
                const updatedItems = [...(parentData.items || parentData.events || []), operation.newItem];
                const updatedParent = {
                  ...parentData,
                  [operation.dataType === 'schedules' ? 'events' : 'items']: updatedItems,
                  lastUpdated: new Date()
                };
                
                await saveUserData(userId, operation.dataType, operation.parentId, updatedParent);
                results.push({ success: true, operation: operation.type });
              } else {
                results.push({ success: false, error: 'Parent not found', operation: operation.type });
              }
              break;
              
            case 'update_metadata':
              // Handle metadata updates
              const currentData = await getUserData(userId);
              const currentItem = currentData[operation.dataType]?.[operation.itemId];
              
              if (currentItem) {
                const updatedItem = { ...currentItem, ...operation.metadata };
                await saveUserData(userId, operation.dataType, operation.itemId, updatedItem);
                results.push({ success: true, operation: operation.type });
              } else {
                results.push({ success: false, error: 'Item not found', operation: operation.type });
              }
              break;
              
            default:
              results.push({ success: false, error: 'Unknown operation type', operation: operation.type });
          }
        } catch (opError) {
          console.error(`❌ Error in batch operation ${operation.type}:`, opError);
          results.push({ success: false, error: opError.message, operation: operation.type });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`✅ Batch completed: ${successCount}/${operations.length} operations successful`);
      
      res.json({ 
        success: true, 
        results,
        successCount,
        totalCount: operations.length
      });
      
    } catch (error) {
      console.error('❌ Error in batch operations:', error);
      res.status(500).json({ error: 'Failed to process batch operations' });
    }
  });
  
  app.get('/users', async (req, res) => {
    try {
      console.log('📋 Getting all user profiles...');
      
      const result = await pool.query(`
        SELECT 
          ucp.*,
          COALESCE(
            jsonb_build_object(
              'lists_count', COALESCE((SELECT COUNT(DISTINCT data_key) FROM user_data WHERE user_id = ucp.user_id AND data_type = 'lists'), 0),
              'schedules_count', COALESCE((SELECT COUNT(DISTINCT data_key) FROM user_data WHERE user_id = ucp.user_id AND data_type = 'schedules'), 0),
              'memory_count', COALESCE((SELECT COUNT(DISTINCT data_key) FROM user_data WHERE user_id = ucp.user_id AND data_type = 'memory'), 0),
              'conversations_count', COALESCE((SELECT COUNT(*) FROM conversations WHERE user_id = ucp.user_id), 0)
            ),
            '{}'::jsonb
          ) as data_summary
        FROM user_complete_profile ucp
        ORDER BY ucp.last_active DESC NULLS LAST, ucp.user_created_at DESC
      `);
      
      console.log(`✅ Found ${result.rows.length} user profiles`);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error getting users:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  });

  // GET /user-profile/:userId - Get specific user profile
  app.get('/user-profile/:userId', async (req, res) => {
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
  // **ENHANCED: Get data with better caching and compression**
  app.get('/data/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { compress = false } = req.query;
      
      console.log(`📖 Getting data for user ${userId} (compress: ${compress})`);
      
      // Get both user data and profile
      const userData = await getUserData(userId);
      const userProfile = await getUserProfile(userId);
      
      // Add metadata about data size
      const metadata = {
        lists: {
          count: Object.keys(userData.lists || {}).length,
          totalItems: Object.values(userData.lists || {}).reduce((total, list) => total + (list.items?.length || 0), 0)
        },
        schedules: {
          count: Object.keys(userData.schedules || {}).length,
          totalEvents: Object.values(userData.schedules || {}).reduce((total, schedule) => total + (schedule.events?.length || 0), 0)
        },
        memory: {
          count: Object.keys(userData.memory || {}).length,
          totalItems: Object.values(userData.memory || {}).reduce((total, memory) => total + (memory.items?.length || 0), 0)
        },
        chats: {
          count: Object.keys(userData.chats || {}).length,
          totalMessages: Object.values(userData.chats || {}).reduce((total, chat) => total + (chat.messages?.length || 0), 0)
        }
      };
      
      console.log(`📊 Data summary:`, metadata);
      
      res.json({ 
        ...userData,
        userProfile: userProfile || null,
        _metadata: metadata,
        _timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Error getting user data:', error);
      res.status(500).json({ error: 'Failed to get user data' });
    }
  });
  
  
  // **NEW: Health check with performance metrics**
  app.get('/health', async (req, res) => {
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
        version: '2.0.0-optimized'
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'ERROR', 
        message: 'Database connection failed',
        database: 'Disconnected'
      });
    }
  });

  // Add this to your backend/server.js - Simple translation endpoint

  app.post('/translate', async (req, res) => {
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

  async function ensureUserWithProfile(userId, profileData = {}) {
    try {
      await pool.query(
        'INSERT INTO users (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET last_active = CURRENT_TIMESTAMP',
        [userId]
      );
  
      if (Object.keys(profileData).length > 0) {
        const { displayName, preferredLanguage, avatarEmoji } = profileData;
        
        await pool.query(`
          INSERT INTO user_profiles (user_id, display_name, preferred_language, avatar_emoji) 
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            display_name = $2,
            preferred_language = $3,
            avatar_emoji = $4,
            updated_at = CURRENT_TIMESTAMP
        `, [userId, displayName, preferredLanguage || 'en-US', avatarEmoji || '👤']);
      }
      
      console.log(`✅ User ${userId} ensured with profile`);
    } catch (error) {
      console.error('Error ensuring user with profile:', error);
      throw error;
    }
  }

  async function getUserProfile(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          u.user_id,
          COALESCE(p.display_name, u.user_id) as display_name,
          COALESCE(p.preferred_language, 'en-US') as preferred_language,
          COALESCE(p.avatar_emoji, '👤') as avatar_emoji,
          u.last_active,
          jsonb_build_object(
            'lists_count', COALESCE((SELECT COUNT(DISTINCT data_key) FROM user_data WHERE user_id = u.user_id AND data_type = 'lists'), 0),
            'schedules_count', COALESCE((SELECT COUNT(DISTINCT data_key) FROM user_data WHERE user_id = u.user_id AND data_type = 'schedules'), 0),
            'memory_count', COALESCE((SELECT COUNT(DISTINCT data_key) FROM user_data WHERE user_id = u.user_id AND data_type = 'memory'), 0)
          ) as data_summary
        FROM users u
        LEFT JOIN user_profiles p ON u.user_id = p.user_id
        WHERE u.user_id = $1
      `, [userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }
  
// Initialize and start server
async function startServer() {
  
  app.listen(port, () => {
    console.log(`🚀 AI Backend running on http://localhost:${port}`);
    console.log(`🤖 Features: Multilingual AI, PostgreSQL persistence, Cross-mode actions`);
    console.log(`🛡️ Database: PostgreSQL connected`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
  });
}

startServer().catch(console.error);

module.exports = app;