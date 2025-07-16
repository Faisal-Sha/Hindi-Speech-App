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
        INSERT INTO user_lists (user_id, list_name, list_type, description, color, icon)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, list_name)
        DO UPDATE SET 
            list_type = EXCLUDED.list_type,
            description = EXCLUDED.description,
            color = EXCLUDED.color,
            icon = EXCLUDED.icon,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `, [userId, listName, listType, description, color, icon]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating list:', error);
      throw error;
    }
}

async function addItemToList(userId, listName, itemText, options = {}) {
  try {
    console.log(`➕ Adding item "${itemText}" to list "${listName}" for user ${userId}`);
    
    const { priority = 0, due_date, notes, quantity = 1 } = options;
    
    // STEP 1: Smart list selection logic
    let listResult = await pool.query(`
      SELECT id, list_name FROM user_lists 
      WHERE user_id = $1 AND list_name = $2
    `, [userId, listName]);
    
    let listId;
    let actualListName = listName;
    
    if (listResult.rows.length === 0) {
      // Requested list doesn't exist - check how many lists the user has
      const allListsResult = await pool.query(`
        SELECT id, list_name FROM user_lists 
        WHERE user_id = $1 AND is_archived = false
        ORDER BY updated_at DESC
      `, [userId]);
      
      if (allListsResult.rows.length === 1) {
        // Only one list exists - use it instead of creating a new one
        listId = allListsResult.rows[0].id;
        actualListName = allListsResult.rows[0].list_name;
        console.log(`🎯 Only one list exists ("${actualListName}") - adding item there instead of creating "${listName}"`);
      } else if (allListsResult.rows.length === 0) {
        // No lists exist - create the requested one
        console.log(`📝 No lists exist - creating new list "${listName}" for user ${userId}`);
        
        const createListResult = await pool.query(`
          INSERT INTO user_lists (user_id, list_name, list_type, created_at, updated_at)
          VALUES ($1, $2, 'general', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `, [userId, listName]);
        
        listId = createListResult.rows[0].id;
        console.log(`✅ Created new list with ID: ${listId}`);
      } else {
        // Multiple lists exist - try fuzzy matching first
        const fuzzyMatch = allListsResult.rows.find(list => 
          list.list_name.toLowerCase().includes(listName.toLowerCase()) ||
          listName.toLowerCase().includes(list.list_name.toLowerCase())
        );
        
        if (fuzzyMatch) {
          // Found a fuzzy match - use it
          listId = fuzzyMatch.id;
          actualListName = fuzzyMatch.list_name;
          console.log(`🔍 Found fuzzy match: "${listName}" → "${actualListName}"`);
        } else {
          // No fuzzy match - create new list as requested
          console.log(`📝 Multiple lists exist but no match found - creating new list "${listName}"`);
          
          const createListResult = await pool.query(`
            INSERT INTO user_lists (user_id, list_name, list_type, created_at, updated_at)
            VALUES ($1, $2, 'general', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `, [userId, listName]);
          
          listId = createListResult.rows[0].id;
          console.log(`✅ Created new list with ID: ${listId}`);
        }
      }
    } else {
      // Exact list match found - use it
      listId = listResult.rows[0].id;
      console.log(`✅ Found exact list match with ID: ${listId}`);
    }
    
    // STEP 2: Add the item to the list
    const addItemResult = await pool.query(`
      INSERT INTO list_items (
        list_id, 
        item_text, 
        is_completed, 
        priority, 
        due_date, 
        notes, 
        quantity, 
        created_at
      )
      VALUES ($1, $2, false, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *
    `, [listId, itemText, priority, due_date, notes, quantity]);
    
    // STEP 3: Update the list's updated_at timestamp
    await pool.query(`
      UPDATE user_lists 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [listId]);
    
    const newItem = addItemResult.rows[0];
    console.log(`✅ Added item with ID: ${newItem.id}`);
    
    // Return the new item in a format consistent with your app
    return {
      id: newItem.id,
      text: newItem.item_text,
      completed: newItem.is_completed,
      priority: newItem.priority,
      dueDate: newItem.due_date,
      notes: newItem.notes,
      quantity: newItem.quantity,
      createdAt: newItem.created_at,
      listId: listId,
      listName: actualListName, // Return the actual list name used
      wasRedirected: actualListName !== listName // Flag to indicate if we used a different list
    };
    
  } catch (error) {
    console.error('❌ Error adding item to list:', error);
    console.error('❌ Error details:', error.message);
    
    // Provide more specific error messages
    if (error.code === '23505') { // Unique violation
      throw new Error(`Item "${itemText}" already exists in list "${listName}"`);
    } else if (error.code === '23503') { // Foreign key violation
      throw new Error(`List "${listName}" not found for user ${userId}`);
    } else {
      throw new Error(`Failed to add item to list: ${error.message}`);
    }
  }
}
  
async function getUserLists(userId, includeArchived = false) {
  try {
    const result = await pool.query(`
        SELECT 
            ul.id as list_id,
            ul.list_name,
            ul.list_type,
            ul.description,
            ul.color,
            ul.icon,
            ul.created_at as list_created,
            ul.updated_at as list_updated,
            COALESCE(
                json_agg(
                    CASE WHEN li.id IS NOT NULL THEN
                        json_build_object(
                            'id', li.id,
                            'text', li.item_text,
                            'completed', li.is_completed,
                            'priority', li.priority,
                            'dueDate', li.due_date,
                            'notes', li.notes,
                            'quantity', li.quantity,
                            'createdAt', li.created_at
                        )
                    END
                ) FILTER (WHERE li.id IS NOT NULL),
                '[]'::json
            ) as items
        FROM user_lists ul
        LEFT JOIN list_items li ON ul.id = li.list_id
        WHERE ul.user_id = $1
        AND ($2 OR NOT ul.is_archived)
        GROUP BY ul.id, ul.list_name, ul.list_type, ul.description, ul.color, ul.icon, ul.created_at, ul.updated_at
        ORDER BY ul.updated_at DESC
    `, [userId, includeArchived]);

    const listsObject = {};
    result.rows.forEach(row => {
        listsObject[row.list_name] = {
            id: row.list_id,
            name: row.list_name,
            type: row.list_type,
            description: row.description,
            color: row.color,
            icon: row.icon,
            items: row.items,
            lastUpdated: row.list_updated,
            created: row.list_created
        };
    });
    return listsObject;
    
} catch (error) {
    console.error('❌ Error getting user lists:', error);
    console.error('❌ Error details:', error.message);
    return {};
}
}
  
//SCHEDULE 

async function createUserSchedule(userId, scheduleName, scheduleType = 'personal', options = {}) {
  try {
    const { description, color, timezone = 'UTC' } = options;
    
    // Use direct SQL instead of stored procedure
    const result = await pool.query(`
        INSERT INTO user_schedules (user_id, schedule_name, schedule_type, description, color, timezone)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, schedule_name)
        DO UPDATE SET 
            schedule_type = EXCLUDED.schedule_type,
            description = EXCLUDED.description,
            color = EXCLUDED.color,
            timezone = EXCLUDED.timezone,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `, [userId, scheduleName, scheduleType, description, color, timezone]);
    
    return result.rows[0];
  } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
  }
}

async function addEventToSchedule(userId, scheduleId, eventTitle, startTime, options = {}) {
  try {
    const { 
      end_time, 
      location, 
      event_description, 
      event_type = 'appointment',
      is_all_day = false,
      reminder_minutes 
    } = options;
    
    // Use direct SQL instead of stored procedure
    const result = await pool.query(`
      INSERT INTO schedule_events (schedule_id, event_title, event_description, start_time, end_time, location, event_type, is_all_day, reminder_minutes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [scheduleId, eventTitle, event_description, startTime, end_time, location, event_type, is_all_day, reminder_minutes]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error adding event to schedule:', error);
    throw error;
  }
}
  
async function getUserSchedules(userId) {
  try {
    console.log(`📅 Getting schedules for user: ${userId}`);
    
    // Use direct SQL like getUserLists - this will work!
    const result = await pool.query(`
      SELECT 
          us.id as schedule_id,
          us.schedule_name,
          us.schedule_type,
          us.description,
          us.color,
          us.timezone,
          us.is_default,
          us.created_at as schedule_created,
          us.updated_at as schedule_updated,
          COALESCE(
              json_agg(
                  CASE WHEN se.id IS NOT NULL THEN
                      json_build_object(
                          'id', se.id,
                          'title', se.event_title,
                          'description', se.event_description,
                          'startTime', se.start_time,
                          'endTime', se.end_time,
                          'location', se.location,
                          'type', se.event_type,
                          'isAllDay', se.is_all_day,
                          'reminderMinutes', se.reminder_minutes,
                          'recurrenceRule', se.recurrence_rule,
                          'isCancelled', se.is_cancelled,
                          'createdAt', se.created_at,
                          'updatedAt', se.updated_at
                      )
                  END
              ) FILTER (WHERE se.id IS NOT NULL),
              '[]'::json
          ) as events
      FROM user_schedules us
      LEFT JOIN schedule_events se ON us.id = se.schedule_id
      WHERE us.user_id = $1
      GROUP BY us.id, us.schedule_name, us.schedule_type, us.description, us.color, us.timezone, us.is_default, us.created_at, us.updated_at
      ORDER BY us.updated_at DESC
  `, [userId]);
    
    console.log(`📅 Raw schedule data:`, result.rows);
    
    // Transform to object format (same as getUserLists)
    const schedulesObject = {};
    result.rows.forEach(row => {
        schedulesObject[row.schedule_name] = {
            id: row.schedule_id,
            name: row.schedule_name,
            type: row.schedule_type,
            description: row.description,
            color: row.color,
            timezone: row.timezone,
            events: row.events || [],
            lastUpdated: row.schedule_updated,
            created: row.schedule_created
        };
    });
    
    console.log(`✅ Transformed schedules object:`, schedulesObject);
    return schedulesObject;
    
  } catch (error) {
    console.error('❌ Error getting user schedules:', error);
    console.error('❌ Error details:', error.message);
    return {};
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

      console.log(`🧠 Adding memory item: ${memoryKey} to category: ${categoryName}`);

      // Get existing categories (like getUserLists does)
      const categoriesResult = await pool.query(
          'SELECT id, category_name FROM memory_categories WHERE user_id = $1',
          [userId]
      );

      if (categoriesResult.rows.length === 0) {
          throw new Error(`No memory categories exist. Please create a category first.`);
      }

      // Smart matching logic (same as lists)
      let targetCategoryId = null;
      let targetCategoryName = null;

      // Try exact match first
      const exactMatch = categoriesResult.rows.find(cat => 
          cat.category_name.toLowerCase() === categoryName.toLowerCase()
      );

      if (exactMatch) {
          targetCategoryId = exactMatch.id;
          targetCategoryName = exactMatch.category_name;
      } else {
          // Try partial matching (like list smart matching)
          const partialMatch = categoriesResult.rows.find(cat => 
              cat.category_name.toLowerCase().includes(categoryName.toLowerCase()) ||
              categoryName.toLowerCase().includes(cat.category_name.toLowerCase())
          );

          if (partialMatch) {
              targetCategoryId = partialMatch.id;
              targetCategoryName = partialMatch.category_name;
          }
      }

      if (!targetCategoryId) {
          const availableCategories = categoriesResult.rows.map(cat => cat.category_name).join(', ');
          throw new Error(`Category "${categoryName}" not found. Available categories: ${availableCategories}`);
      }

      console.log(`✅ Found matching category: "${targetCategoryName}" (ID: ${targetCategoryId})`);

      // Insert into memory_items using the found category
      const result = await pool.query(`
          INSERT INTO memory_items (category_id, memory_key, memory_value, memory_type, importance, tags, expires_at, is_private)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (category_id, memory_key)
          DO UPDATE SET 
              memory_value = EXCLUDED.memory_value,
              memory_type = EXCLUDED.memory_type,
              importance = EXCLUDED.importance,
              tags = EXCLUDED.tags,
              expires_at = EXCLUDED.expires_at,
              is_private = EXCLUDED.is_private,
              updated_at = CURRENT_TIMESTAMP
          RETURNING *
      `, [targetCategoryId, memoryKey, memoryValue, memory_type, importance, JSON.stringify(tags), expires_at, is_private]);

      console.log(`✅ Added memory item to existing category "${targetCategoryName}"`);
      return result.rows[0];

  } catch (error) {
      console.error('❌ Error adding memory item:', error);
      throw error;
  }
}
  
async function getUserMemories(userId) {
  try {
    console.log(`🧠 Getting memories for user: ${userId}`);

    // Query using your existing table structure
    const result = await pool.query(`
        SELECT 
            mc.category_name,
            mc.created_at as category_created,
            mc.updated_at as category_updated,
            mi.id as memory_id,
            mi.memory_key,
            mi.memory_value,
            mi.memory_type,
            mi.importance,
            mi.tags,
            mi.expires_at,
            mi.is_private,
            mi.created_at as memory_created,
            mi.updated_at as memory_updated
        FROM memory_categories mc
        LEFT JOIN memory_items mi ON mc.id = mi.category_id
        WHERE mc.user_id = $1
        AND (mi.expires_at IS NULL OR mi.expires_at > CURRENT_TIMESTAMP)
        ORDER BY mc.category_name, mi.importance DESC, mi.created_at DESC
    `, [userId]);

    console.log(`🧠 Raw memory data from your tables:`, result.rows);

    // Transform to object format grouped by category
    const memoriesObject = {};
    result.rows.forEach(row => {
        const categoryName = row.category_name;

        // Initialize category if it doesn't exist
        if (!memoriesObject[categoryName]) {
            memoriesObject[categoryName] = {
                category: categoryName,
                items: [],
                created: row.category_created,
                lastUpdated: row.category_updated
            };
        }

        // Add memory item to category (only if it exists)
        if (row.memory_id) {
            memoriesObject[categoryName].items.push({
                id: row.memory_id,
                key: row.memory_key,
                value: row.memory_value,
                type: row.memory_type,
                importance: row.importance,
                tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
                expires_at: row.expires_at,
                is_private: row.is_private,
                created: row.memory_created,
                updated: row.memory_updated
            });

            // Update category's lastUpdated to the most recent item
            if (new Date(row.memory_updated) > new Date(memoriesObject[categoryName].lastUpdated)) {
                memoriesObject[categoryName].lastUpdated = row.memory_updated;
            }
        }
    });

    console.log(`✅ Transformed memories object:`, memoriesObject);
    return memoriesObject;

  } catch (error) {
      console.error('❌ Error getting user memories:', error);
      console.error('❌ Error details:', error.message);
      return {};
  }
}

/* Get all User Data */

async function getAllUserData(userId) {
  try {
    console.log(`📖 Getting all user data for: ${userId}`);
    
    // Use our working functions instead of stored procedure
    const [lists, schedules, memories] = await Promise.all([
        getUserLists(userId),
        getUserSchedules(userId),
        getUserMemories(userId)
    ]);
    
    const userData = {
        lists: lists || {},
        schedules: schedules || {},
        memory: memories || {},
        chats: {}
    };
    
    console.log(`✅ Got all user data:`, {
        lists: Object.keys(userData.lists).length,
        schedules: Object.keys(userData.schedules).length,
        memory: Object.keys(userData.memory).length
    });
    
    return userData;
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