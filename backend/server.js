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
    
    // Build intelligent summary based on current mode and data
    const dataSummary = {
      lists: {
        count: Object.keys(mergedData.lists).length,
        names: Object.values(mergedData.lists).map(list => ({
          name: list.title,
          type: list.type || 'custom',
          itemCount: list.items?.length || 0
        }))
      },
      schedules: {
        count: Object.keys(mergedData.schedules).length,
        names: Object.values(mergedData.schedules).map(schedule => ({
          name: schedule.title,
          eventCount: schedule.events?.length || 0
        })),
        upcomingEvents: Object.values(mergedData.schedules)
          .flatMap(schedule => schedule.events || [])
          .slice(0, 5)
          .map(event => ({ title: event.title, time: event.time }))
      },
      memory: {
        count: Object.keys(mergedData.memory).length,
        categories: Object.values(mergedData.memory).map(category => ({
          name: category.title,
          itemCount: category.items?.length || 0
        }))
      },
      chats: {
        count: Object.keys(mergedData.chats).length,
        topics: Object.values(mergedData.chats).map(chat => chat.title)
      }
    };
    
    // Build mode-aware context (but don't limit functionality to mode)
    let contextInfo = `CURRENT MODE: ${mode}\n`;
    
    // Always include summary, but emphasize current mode
    if (mode === 'lists' || dataSummary.lists.count > 0) {
      contextInfo += `LISTS (${dataSummary.lists.count}): ${dataSummary.lists.names.map(l => `"${l.name}" (${l.itemCount} items)`).join(', ')}\n`;
    }
    
    if (mode === 'schedule' || dataSummary.schedules.count > 0) {
      contextInfo += `SCHEDULES (${dataSummary.schedules.count}): ${dataSummary.schedules.names.map(s => `"${s.name}" (${s.eventCount} events)`).join(', ')}\n`;
      if (dataSummary.schedules.upcomingEvents.length > 0) {
        contextInfo += `UPCOMING: ${dataSummary.schedules.upcomingEvents.map(e => `${e.title} at ${e.time}`).join(', ')}\n`;
      }
    }
    
    if (mode === 'memory' || dataSummary.memory.count > 0) {
      contextInfo += `MEMORY (${dataSummary.memory.count}): ${dataSummary.memory.categories.map(c => `"${c.name}" (${c.itemCount} items)`).join(', ')}\n`;
    }
    
    if (mode === 'chat' || dataSummary.chats.count > 0) {
      contextInfo += `CHAT TOPICS (${dataSummary.chats.count}): ${dataSummary.chats.topics.join(', ')}\n`;
    }
    
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
      dataSummary: { lists: { count: 0, names: [] }, schedules: { count: 0, names: [] }, memory: { count: 0, categories: [] } }
    };
  }
}

// Enhanced system prompt - Let AI handle ALL intent detection in ANY language
const SYSTEM_PROMPT = `You are an intelligent multilingual personal assistant. You understand user intent in ANY language and help manage their digital life.

🎯 CORE PRINCIPLE: 
- Understand user intent regardless of language
- Current mode provides context but doesn't limit functionality
- Users can create/manage lists/schedules/memory from any mode

🤖 AVAILABLE ACTIONS (detect these from user intent in any language):
- create_list: Create new lists (any type: shopping, todo, books, movies, travel, etc.)
- add_to_list: Add items to existing lists (determine which list from context)
- update_list: Mark items as complete, edit, or remove
- create_schedule: Create schedule categories
- add_event: Add events/appointments to schedules  
- update_event: Modify or cancel events
- create_memory: Create memory categories (contacts, notes, passwords, etc.)
- store_memory: Store any information in memory
- create_chat: Create new chat topics for organized conversations

📋 RESPONSE FORMAT - ALWAYS return valid JSON:
{
  "response": "Your conversational response in user's language",
  "actions": [
    {
      "type": "action_type",
      "data": { 
        "targetId": "existing_item_id_if_applicable",
        "listName": "for create_list",
        "listType": "shopping|todo|custom", 
        "items": ["for add_to_list"],
        "title": "for events/memory",
        "time": "for events",
        "category": "for memory",
        "info": "for storing information"
      }
    }
  ]
}

🌍 LANGUAGE INTELLIGENCE:
- Detect user's language from their input
- Respond in the same language
- Understand intent regardless of language:
  * "Add milk to list" (English)
  * "जोड़ें दूध सूची में" (Hindi)  
  * "Añadir leche a la lista" (Spanish)
  * "Ajouter du lait à la liste" (French)
  * "Milch zur Liste hinzufügen" (German)
  -> ALL should result in same add_to_list action

🧠 SMART CONTEXT AWARENESS:
- If user is in Lists mode and says "add milk" -> likely add to a list
- If user is in Schedule mode and says "meeting tomorrow" -> likely add event
- If user is in Chat mode but says "create shopping list" -> still create list!
- Use existing data names to determine targets (don't guess list names)

🎯 EXAMPLES:

User in Lists mode: "add milk and bread"
{
  "response": "Added milk and bread to your shopping list!",
  "actions": [{"type": "add_to_list", "data": {"listType": "shopping", "items": ["milk", "bread"]}}]
}

User in Chat mode: "create a list for books I want to read"
{
  "response": "I've created a reading list for you!",
  "actions": [{"type": "create_list", "data": {"listName": "Books to Read", "listType": "custom"}}]
}

User in any mode (Hindi): "जॉन से मिलने का समय तय करें कल 3 बजे"
{
  "response": "मैंने कल 3 बजे जॉन के साथ आपकी मीटिंग शेड्यूल कर दी है!",
  "actions": [{"type": "add_event", "data": {"title": "Meeting with John", "time": "tomorrow 3:00 PM", "duration": "1 hour"}}]
}

User: "remember John's phone is 555-1234"
{
  "response": "I'll remember John's phone number for you!",
  "actions": [{"type": "store_memory", "data": {"category": "contacts", "info": {"name": "John", "phone": "555-1234"}}}]
}

ALWAYS return valid JSON. Let intelligence guide actions, not rigid rules.`;

// Main chat endpoint - Pure AI intelligence
app.post('/chat', async (req, res) => {
  try {
    const { message, mode, context, language, userId = 'default' } = req.body;
    
    console.log(`📨 [${userId}] "${message}" (${mode} mode)`);

    // Ensure user exists in database
    await ensureUser(userId);

    // Build intelligent context
    const { context: smartContext, mergedData, dataSummary } = await buildSmartContext(
      userId, mode, context || {}, message
    );

    const contextSize = smartContext.length;
    console.log(`🧠 Smart context: ${contextSize} chars`);
    console.log(`💾 Persistent data: ${dataSummary.lists.count} lists, ${dataSummary.schedules.count} schedules, ${dataSummary.memory.count} memory`);

    // Create AI prompt with smart context
    const aiPrompt = `${SYSTEM_PROMPT}

CURRENT CONTEXT:
${smartContext}

USER MESSAGE: "${message}"

Understand the user's intent and respond appropriately with actions if needed.`;

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

    // Save conversation to database
    await saveConversation(userId, message, responseData.response, responseData.actions, mode, language);

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

// Health check with database status


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
  
  // **ENHANCED: Get data with better caching and compression**
  app.get('/data/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { compress = false } = req.query;
      
      console.log(`📖 Getting data for user ${userId} (compress: ${compress})`);
      
      const userData = await getUserData(userId);
      
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