const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'personal_assistant',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });

/* User Authetication */
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

/* Data Persistence Specific functions */

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

/* Persistent List, Schedules, Memory */


//LIST

async function createUserList(userId, listName, listType = 'general', options = {}) {
    try {
      const { description, color, icon } = options;
      
      const result = await pool.query(`
        SELECT * FROM create_user_list($1, $2, $3, $4, $5, $6)
      `, [userId, listName, listType, description, color, icon]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating list:', error);
      throw error;
    }
}

async function addItemToList(userId, listName, itemText, options = {}) {
    try {
      const { priority = 0, due_date, notes, quantity = 1 } = options;
      
      const result = await pool.query(`
        SELECT * FROM add_item_to_list($1, $2, $3, $4, $5, $6, $7)
      `, [userId, listName, itemText, priority, due_date, notes, quantity]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error adding item to list:', error);
      throw error;
    }
}
  
async function getUserLists(userId, includeArchived = false) {
    try {
      const result = await pool.query(`
        SELECT * FROM get_user_lists($1, $2)
      `, [userId, includeArchived]);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting user lists:', error);
      return [];
    }
}
  
//SCHEDULE 

async function createUserSchedule(userId, scheduleName, scheduleType = 'personal', options = {}) {
    try {
        const { description, color, timezone = 'UTC' } = options;
        
        const result = await pool.query(`
        SELECT * FROM create_user_schedule($1, $2, $3, $4, $5, $6)
        `, [userId, scheduleName, scheduleType, description, color, timezone]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error creating schedule:', error);
        throw error;
    }
}

async function addEventToSchedule(userId, scheduleName, eventTitle, startTime, options = {}) {
    try {
      const { 
        end_time, 
        location, 
        event_description, 
        event_type = 'appointment',
        is_all_day = false,
        reminder_minutes 
      } = options;
      
      const result = await pool.query(`
        SELECT * FROM add_event_to_schedule($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [userId, scheduleName, eventTitle, startTime, end_time, location, event_description, event_type, is_all_day, reminder_minutes]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error adding event to schedule:', error);
      throw error;
    }
}
  
async function getUserSchedules(userId) {
    try {
      const result = await pool.query(`
        SELECT * FROM get_user_schedules($1)
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting user schedules:', error);
      return [];
    }
}

//MEMORY

async function addMemoryItem(userId, categoryName, memoryKey, memoryValue, options = {}) {
    try {
      const { 
        memory_type = 'fact', 
        importance = 0, 
        tags = [], 
        expires_at,
        is_private = false 
      } = options;
      
      const result = await pool.query(`
        SELECT * FROM add_memory_item($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [userId, categoryName, memoryKey, memoryValue, memory_type, importance, tags, expires_at, is_private]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error adding memory item:', error);
      throw error;
    }
}
  
async function getUserMemories(userId) {
    try {
      const result = await pool.query(`
        SELECT * FROM get_user_memories($1)
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting user memories:', error);
      return [];
    }
}

/* Get all User Data */

async function getAllUserData(userId) {
    try {
      const result = await pool.query(`
        SELECT * FROM get_all_user_data($1)
      `, [userId]);
      
      return result.rows[0] || { lists: {}, schedules: {}, memory: {}, chats: {} };
    } catch (error) {
      console.error('Error getting all user data:', error);
      return { lists: {}, schedules: {}, memory: {}, chats: {} };
    }
}

/* Bulid Smart Context */
async function buildSmartContext(userId, mode, currentData, message) {
    try {
        // Get user's persistent data using the new system
        const persistentData = await getAllUserData(userId);
        
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
            }
        };
        
        // Include exact names with context for better AI matching
        if (mode === 'lists' || dataSummary.lists.count > 0) {
            contextInfo += `EXISTING LISTS (${dataSummary.lists.count}) - USE THESE EXACT NAMES:\n`;
            if (dataSummary.lists.count > 0) {
            dataSummary.lists.names.forEach(listName => {
                const list = mergedData.lists[listName];
                const itemCount = list.items?.length || 0;
                const listType = list.type || 'custom';
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
            dataSummary: { lists: { count: 0, names: [] }, schedules: { count: 0, names: [] }, memory: { count: 0, categories: [] } }
        };
    }
}

module.exports = {
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
};