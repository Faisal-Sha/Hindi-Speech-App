const { pool } = require('./config/db');
// const { Pool } = require('pg');

// const pool = new Pool({
//     user: process.env.DB_USER || 'postgres',
//     host: process.env.DB_HOST || 'localhost',
//     database: process.env.DB_NAME || 'personal_assistant',
//     password: process.env.DB_PASSWORD || 'password',
//     port: process.env.DB_PORT || 5432,
//   });

const {
    generateProfileId
  } = require('./utils/familyAuth');
  

// =============================================
// FAMILY ACCOUNT FUNCTIONS
// =============================================

/**
 * Create a new family account (Supabase handles authentication)
 * This is like creating a "family login" that can have multiple profiles
 * @param {string} email - Account email (from Supabase)
 * @param {string} accountName - Family/household name (e.g., "Smith Family")
 * @returns {object} - Created account info
 */
async function createFamilyAccount(email, accountName) {
  try {
    console.log(`👨‍👩‍👧‍👦 Creating family account: ${accountName} (${email})`);
    
    // Create the account (password is handled by Supabase)
    const result = await pool.query(`
      INSERT INTO accounts (email, account_name, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      RETURNING id, email, account_name, created_at, max_profiles
    `, [email, accountName]);
    
    const account = result.rows[0];
    console.log(`✅ Family account created successfully: ${accountName} (ID: ${account.id})`);
    
    return account;
    
  } catch (error) {
    console.error('❌ Error creating family account:', error);
    
    // Handle specific database errors
    if (error.code === '23505') { // Unique violation
      throw new Error('An account with this email already exists');
    }
    
    throw new Error('Failed to create family account');
  }
}

/**
 * DEPRECATED: Authentication is now handled by Supabase
 * This function is kept for backward compatibility but should not be used
 */
async function authenticateFamilyAccount(email, password) {
  console.warn('⚠️ authenticateFamilyAccount is deprecated - use Supabase auth instead');
  throw new Error('Authentication is handled by Supabase. Use Supabase auth endpoints.');
}

/**
 * Get family account with all its profiles
 * This is what we call after successful login to show the profile selector
 * @param {string} email - Account email
 * @returns {object} - Account with profiles array
 */
async function getFamilyAccountWithProfiles(email) {
  try {
    console.log(`👨‍👩‍👧‍👦 Getting family account with profiles: ${email}`);
    
    // Use our view to get account with profiles
    const result = await pool.query(`
      SELECT * FROM account_with_profiles WHERE email = $1
    `, [email]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Family account not found: ${email}`);
      return null;
    }
    
    const account = result.rows[0];
    console.log(`✅ Found family account: ${account.account_name} with ${account.profile_count} profiles`);
    
    return {
      id: account.id,
      email: account.email,
      accountName: account.account_name,
      profileCount: account.profile_count,
      maxProfiles: account.max_profiles,
      profiles: account.profiles || [],
      createdAt: account.created_at,
      lastLogin: account.last_login
    };
    
  } catch (error) {
    console.error('❌ Error getting family account with profiles:', error);
    return null;
  }
}

/**
 * Create a new profile within a family account
 * This is what happens when someone clicks "Add New Profile"
 * @param {string} accountEmail - Account email (to link the profile)
 * @param {string} displayName - Profile display name (e.g., "Dad", "Mom", "Kids")
 * @param {object} profileData - Additional profile data
 * @returns {object} - Created profile
 */
async function createProfileInAccount(accountEmail, displayName, profileData = {}) {
  try {
    console.log(`👤 Creating profile "${displayName}" in account: ${accountEmail}`);
    
    // Check if account can add more profiles
    const canAdd = await pool.query(`
      SELECT can_add_profile($1) as can_add
    `, [accountEmail]);
    
    if (!canAdd.rows[0].can_add) {
      throw new Error('Maximum number of profiles reached for this account');
    }
    
    // Generate a unique profile ID
    const profileId = generateProfileId(displayName, accountEmail);
    
    // Start transaction to create both user and profile records
    await pool.query('BEGIN');
    
    try {
      // Create user record linked to account
      await pool.query(`
        INSERT INTO users (user_id, account_email, created_at, last_active)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [profileId, accountEmail]);
      
      // Create user profile record with display data
      const { 
        preferredLanguage = 'en-US',
        avatarEmoji = '👤',
        themePreference = 'default'
      } = profileData;
      
      await pool.query(`
        INSERT INTO user_profiles (user_id, display_name, preferred_language, avatar_emoji, theme_preference)
        VALUES ($1, $2, $3, $4, $5)
      `, [profileId, displayName, preferredLanguage, avatarEmoji, themePreference]);
      
      // Commit transaction
      await pool.query('COMMIT');
      
      console.log(`✅ Profile created successfully: ${displayName} (${profileId})`);
      
      // Return the full profile
      return await getUserProfile(profileId);
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error creating profile in account:', error);
    
    if (error.code === '23505') { // Unique violation
      throw new Error('A profile with this name already exists');
    }
    
    throw error;
  }
}

/**
 * DEPRECATED: Session management is now handled by Supabase
 * These functions are kept for backward compatibility but should not be used
 */
async function createAccountSession(accountEmail, token, sessionData = {}) {
  console.warn('⚠️ createAccountSession is deprecated - Supabase handles sessions');
  throw new Error('Session management is handled by Supabase');
}

async function verifyAccountSession(token) {
  console.warn('⚠️ verifyAccountSession is deprecated - Supabase handles sessions');
  throw new Error('Session management is handled by Supabase');
}

async function deleteAccountSession(accountEmail, token) {
  console.warn('⚠️ deleteAccountSession is deprecated - Supabase handles sessions');
  throw new Error('Session management is handled by Supabase');
}

/**
 * Check if a profile belongs to an account (authorization)
 * This ensures users can only access their own family's profiles
 * @param {string} accountEmail - Account email
 * @param {string} profileId - Profile/user ID
 * @returns {boolean} - True if profile belongs to account
 */
async function profileBelongsToAccount(accountEmail, profileId) {
  try {
    const result = await pool.query(`
      SELECT 1 FROM users 
      WHERE user_id = $1 AND account_email = $2
    `, [profileId, accountEmail]);
    
    const belongs = result.rows.length > 0;
    console.log(`🔍 Profile ${profileId} belongs to ${accountEmail}: ${belongs}`);
    return belongs;
    
  } catch (error) {
    console.error('❌ Error checking profile ownership:', error);
    return false;
  }
}

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

async function updateListItemStatus(userId, listName, itemId, completed) {
  try {
    console.log(`🔄 DEBUGGING updateListItemStatus:`);
    console.log(`   - userId: ${userId}`);
    console.log(`   - listName: "${listName}"`);
    console.log(`   - itemId: ${itemId}`);
    console.log(`   - completed: ${completed}`);
    
    // STEP 1: Check if the list exists for this user
    const listCheck = await pool.query(`
      SELECT id, list_name FROM user_lists 
      WHERE user_id = $1 AND list_name = $2
    `, [userId, listName]);
    
    console.log(`   - List check result: ${listCheck.rows.length} rows found`);
    if (listCheck.rows.length > 0) {
      console.log(`   - Found list: ID ${listCheck.rows[0].id}, Name "${listCheck.rows[0].list_name}"`);
    } else {
      console.error(`   ❌ No list found with name "${listName}" for user ${userId}`);
      
      // Let's see what lists DO exist for this user
      const allLists = await pool.query(`
        SELECT id, list_name FROM user_lists WHERE user_id = $1
      `, [userId]);
      console.log(`   - Available lists for user ${userId}:`, allLists.rows);
      
      throw new Error(`List "${listName}" not found for user ${userId}`);
    }
    
    // STEP 2: Check if the item exists in this list
    const itemCheck = await pool.query(`
      SELECT li.id, li.item_text, li.is_completed, ul.list_name
      FROM list_items li
      JOIN user_lists ul ON li.list_id = ul.id
      WHERE li.id = $1 AND ul.user_id = $2 AND ul.list_name = $3
    `, [itemId, userId, listName]);
    
    console.log(`   - Item check result: ${itemCheck.rows.length} rows found`);
    if (itemCheck.rows.length > 0) {
      const item = itemCheck.rows[0];
      console.log(`   - Found item: ID ${item.id}, Text "${item.item_text}", Currently completed: ${item.is_completed}`);
    } else {
      console.error(`   ❌ No item found with ID ${itemId} in list "${listName}" for user ${userId}`);
      
      // Let's see what items DO exist in this list
      const allItems = await pool.query(`
        SELECT li.id, li.item_text, li.is_completed
        FROM list_items li
        JOIN user_lists ul ON li.list_id = ul.id
        WHERE ul.user_id = $1 AND ul.list_name = $2
      `, [userId, listName]);
      console.log(`   - Available items in list "${listName}":`, allItems.rows);
      
      throw new Error(`Item with ID ${itemId} not found in list "${listName}" for user ${userId}`);
    }
    
    // STEP 3: Perform the update
    console.log(`   - Attempting to update item ${itemId} to completed: ${completed}`);
    
    const result = await pool.query(`
      UPDATE list_items 
      SET is_completed = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 
      AND list_id = (
        SELECT id FROM user_lists 
        WHERE user_id = $3 AND list_name = $4
      )
      RETURNING *
    `, [completed, itemId, userId, listName]);
    
    console.log(`   - Update result: ${result.rows.length} rows affected`);
    
    if (result.rows.length === 0) {
      throw new Error(`Update failed - no rows affected for item ${itemId}`);
    }
    
    const updatedItem = result.rows[0];
    console.log(`   ✅ Successfully updated item:`, {
      id: updatedItem.id,
      text: updatedItem.item_text,
      completed: updatedItem.is_completed,
      updated_at: updatedItem.updated_at
    });
    
    return updatedItem;
    
  } catch (error) {
    console.error('❌ Error in updateListItemStatus:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}

async function updateListItemText(userId, listName, itemId, newText) {
  try {
    console.log(`📝 DEBUGGING updateListItemText:`);
    console.log(`   - userId: ${userId}`);
    console.log(`   - listName: "${listName}"`);
    console.log(`   - itemId: ${itemId}`);
    console.log(`   - newText: "${newText}"`);
    
    // STEP 1: Check if the item exists before updating
    const itemCheck = await pool.query(`
      SELECT li.id, li.item_text, ul.list_name
      FROM list_items li
      JOIN user_lists ul ON li.list_id = ul.id
      WHERE li.id = $1 AND ul.user_id = $2 AND ul.list_name = $3
    `, [itemId, userId, listName]);
    
    console.log(`   - Item check result: ${itemCheck.rows.length} rows found`);
    if (itemCheck.rows.length > 0) {
      const item = itemCheck.rows[0];
      console.log(`   - Found item to edit: ID ${item.id}, Current text: "${item.item_text}"`);
    } else {
      console.error(`   ❌ No item found with ID ${itemId} in list "${listName}" for user ${userId}`);
      throw new Error(`Item with ID ${itemId} not found in list "${listName}" for user ${userId}`);
    }
    
    // STEP 2: Perform the update
    console.log(`   - Attempting to update item ${itemId} text to: "${newText}"`);
    
    const result = await pool.query(`
      UPDATE list_items 
      SET item_text = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 
      AND list_id = (
        SELECT id FROM user_lists 
        WHERE user_id = $3 AND list_name = $4
      )
      RETURNING *
    `, [newText, itemId, userId, listName]);
    
    console.log(`   - Update result: ${result.rows.length} rows affected`);
    
    if (result.rows.length === 0) {
      throw new Error(`Update failed - no rows affected for item ${itemId}`);
    }
    
    const updatedItem = result.rows[0];
    console.log(`   ✅ Successfully updated item text:`, {
      id: updatedItem.id,
      old_text: itemCheck.rows[0].item_text,
      new_text: updatedItem.item_text,
      updated_at: updatedItem.updated_at
    });
    
    return updatedItem;
    
  } catch (error) {
    console.error('❌ Error in updateListItemText:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}


async function deleteListItem(userId, listName, itemId, options = {}) {
  try {
    console.log(`🗑️ DEBUGGING deleteListItem:`);
    console.log(`   - userId: ${userId}`);
    console.log(`   - listName: "${listName}"`);
    console.log(`   - itemId: ${itemId}`);
    console.log(`   - options:`, options);
    
    const { listId: providedListId } = options;
    
    let resolvedListId = providedListId || null;
    let resolvedListName = listName;
    
    // STEP 1: Resolve list ID and validate ownership
    if (resolvedListId) {
      const listCheck = await pool.query(`
        SELECT id, list_name 
        FROM user_lists 
        WHERE user_id = $1 AND id = $2
      `, [userId, resolvedListId]);
      
      if (listCheck.rows.length === 0) {
        throw new Error(`List with ID ${resolvedListId} not found for user ${userId}`);
      }
      
      resolvedListName = listCheck.rows[0].list_name;
    } else {
      const listLookup = await pool.query(`
        SELECT id, list_name 
        FROM user_lists 
        WHERE user_id = $1 AND list_name = $2
      `, [userId, listName]);
      
      if (listLookup.rows.length === 0) {
        throw new Error(`List "${listName}" not found for user ${userId}`);
      }
      
      resolvedListId = listLookup.rows[0].id;
      resolvedListName = listLookup.rows[0].list_name;
    }
    
    console.log(`   - Resolved list: ID ${resolvedListId}, Name "${resolvedListName}"`);
    
    // STEP 2: Check if the item exists before deleting
    const itemCheck = await pool.query(`
      SELECT li.id, li.item_text
      FROM list_items li
      WHERE li.id = $1 AND li.list_id = $2
    `, [itemId, resolvedListId]);
    
    console.log(`   - Item check result: ${itemCheck.rows.length} rows found`);
    if (itemCheck.rows.length === 0) {
      throw new Error(`Item with ID ${itemId} not found in list "${resolvedListName}" for user ${userId}`);
    }
    
    const item = itemCheck.rows[0];
    console.log(`   - Found item to delete: ID ${item.id}, Text "${item.item_text}"`);
    
    // STEP 3: Perform the deletion
    console.log(`   - Attempting to delete item ${itemId} from list ID ${resolvedListId}`);
    
    const result = await pool.query(`
      DELETE FROM list_items 
      WHERE id = $1 AND list_id = $2
      RETURNING *
    `, [itemId, resolvedListId]);
    
    console.log(`   - Delete result: ${result.rows.length} rows affected`);
    
    if (result.rows.length === 0) {
      throw new Error(`Delete failed - no rows affected for item ${itemId}`);
    }
    
    const deletedItem = result.rows[0];
    console.log(`   ✅ Successfully deleted item:`, {
      id: deletedItem.id,
      text: deletedItem.item_text,
      listId: resolvedListId
    });
    
    return deletedItem;
    
  } catch (error) {
    console.error('❌ Error in deleteListItem:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}

async function deleteUserList(userId, listName, options = {}) {
  try {
    const { listId: providedListId } = options;
    
    console.log(`🗑️ Deleting entire list "${listName}" for user ${userId}`, {
      providedListId
    });
    
    // Step 1: Find the list and get its ID
    let listId = providedListId || null;
    let resolvedListName = listName;
    
    if (listId) {
      const listCheck = await pool.query(
        'SELECT id, list_name FROM user_lists WHERE user_id = $1 AND id = $2',
        [userId, listId]
      );
      
      if (listCheck.rows.length === 0) {
        throw new Error(`List with ID ${listId} not found for user ${userId}`);
      }
      
      resolvedListName = listCheck.rows[0].list_name;
      listId = listCheck.rows[0].id;
    } else {
      const listQuery = await pool.query(
        'SELECT id, list_name FROM user_lists WHERE user_id = $1 AND list_name = $2',
        [userId, listName]
      );
    
      if (listQuery.rows.length === 0) {
        throw new Error(`List "${listName}" not found for user ${userId}`);
      }
      
      listId = listQuery.rows[0].id;
      resolvedListName = listQuery.rows[0].list_name;
    }
    
    console.log(`📋 Found list "${resolvedListName}" with ID: ${listId}`);
    
    // Step 2: Delete all items in the list first (foreign key constraint)
    const deleteItemsResult = await pool.query(
      'DELETE FROM list_items WHERE list_id = $1',
      [listId]
    );
    
    console.log(`🗑️ Deleted ${deleteItemsResult.rowCount} items from list`);
    
    // Step 3: Delete the list itself
    const deleteListResult = await pool.query(
      'DELETE FROM user_lists WHERE id = $1 RETURNING *',
      [listId]
    );
    
    const deletedList = deleteListResult.rows[0];
    console.log(`✅ Successfully deleted list:`, {
      id: deletedList.id,
      name: deletedList.list_name,
      deletedItems: deleteItemsResult.rowCount
    });
    
    return {
      ...deletedList,
      deletedItemsCount: deleteItemsResult.rowCount
    };
    
  } catch (error) {
    console.error('❌ Error in deleteUserList:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
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



async function addEventToSchedule(userId, scheduleName, eventTitle, startTime, options = {}) {
  try {
    console.log(`📅 Adding event "${eventTitle}" to schedule "${scheduleName}" for user ${userId}`);
    
    // Step 1: Extract all optional parameters with proper defaults
    const { 
      end_time = null,           // Can be null for events without end time
      location = null,           // Optional location
      event_description = null,  // Optional description  
      event_type = 'appointment', // Default to 'appointment'
      is_all_day = false,        // Default to false
      reminder_minutes = null,   // Optional reminder
      recurrence_rule = null     // Optional recurrence
    } = options;

    // Step 2: SMART SCHEDULE SELECTION LOGIC (like your addItemToList)
    let scheduleResult = await pool.query(`
      SELECT id, schedule_name FROM user_schedules 
      WHERE user_id = $1 AND schedule_name = $2
    `, [userId, scheduleName]);

    let scheduleId;
    let actualScheduleName = scheduleName;

    if (scheduleResult.rows.length === 0) {
      // Requested schedule doesn't exist - check how many schedules the user has
      const allSchedulesResult = await pool.query(`
        SELECT id, schedule_name FROM user_schedules 
        WHERE user_id = $1 AND is_default = false
        ORDER BY updated_at DESC
      `, [userId]);

      if (allSchedulesResult.rows.length === 1) {
        // Only one schedule exists - use it instead of creating a new one
        scheduleId = allSchedulesResult.rows[0].id;
        actualScheduleName = allSchedulesResult.rows[0].schedule_name;
        console.log(`🎯 Only one schedule exists ("${actualScheduleName}") - adding event there instead of creating "${scheduleName}"`);
        
      } else if (allSchedulesResult.rows.length === 0) {
        // No schedules exist - create the requested one
        console.log(`📅 No schedules exist - creating new schedule "${scheduleName}" for user ${userId}`);
        
        const createScheduleResult = await pool.query(`
          INSERT INTO user_schedules (user_id, schedule_name, schedule_type, created_at, updated_at)
          VALUES ($1, $2, 'personal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `, [userId, scheduleName]);
        
        scheduleId = createScheduleResult.rows[0].id;
        console.log(`✅ Created new schedule with ID: ${scheduleId}`);
        
      } else {
        // Multiple schedules exist - try fuzzy matching first
        const fuzzyMatch = allSchedulesResult.rows.find(schedule => 
          schedule.schedule_name.toLowerCase().includes(scheduleName.toLowerCase()) ||
          scheduleName.toLowerCase().includes(schedule.schedule_name.toLowerCase())
        );
        
        if (fuzzyMatch) {
          // Found a fuzzy match - use it
          scheduleId = fuzzyMatch.id;
          actualScheduleName = fuzzyMatch.schedule_name;
          console.log(`🎯 Found fuzzy match: "${actualScheduleName}" for requested "${scheduleName}"`);
          
        } else {
          // No fuzzy match - create new schedule
          console.log(`📅 No fuzzy match found for "${scheduleName}" - creating new schedule`);
          
          const createScheduleResult = await pool.query(`
            INSERT INTO user_schedules (user_id, schedule_name, schedule_type, created_at, updated_at)
            VALUES ($1, $2, 'personal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `, [userId, scheduleName]);
          
          scheduleId = createScheduleResult.rows[0].id;
          console.log(`✅ Created new schedule with ID: ${scheduleId}`);
        }
      }
    } else {
      // Exact match found - use it
      scheduleId = scheduleResult.rows[0].id;
      console.log(`✅ Found exact schedule match: "${actualScheduleName}"`);
    }

    console.log(`📅 Using schedule: "${actualScheduleName}" (ID: ${scheduleId})`);

    // Step 3: Insert event with CORRECT parameter order matching your database schema
    const result = await pool.query(`
      INSERT INTO schedule_events (
        schedule_id, 
        event_title, 
        event_description, 
        start_time, 
        end_time, 
        location, 
        event_type, 
        is_all_day, 
        reminder_minutes,
        recurrence_rule
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      scheduleId,           // $1 - schedule_id (integer)
      eventTitle,           // $2 - event_title (character varying)
      event_description,    // $3 - event_description (text) 
      startTime,            // $4 - start_time (timestamp without time zone)
      end_time,             // $5 - end_time (timestamp without time zone)
      location,             // $6 - location (character varying)
      event_type,           // $7 - event_type (character varying)
      is_all_day,           // $8 - is_all_day (boolean)
      reminder_minutes,     // $9 - reminder_minutes (integer)
      recurrence_rule       // $10 - recurrence_rule (text)
    ]);

    console.log(`✅ Event successfully added to schedule "${actualScheduleName}":`, result.rows[0]);
    return result.rows[0];

  } catch (error) {
    console.error('❌ Error adding event to schedule:', error);
    console.error('❌ Error details:', error.message);
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

async function updateEvent(userId, scheduleName, eventId, updates) {
  try {
    console.log(`📝 Updating event ${eventId} in schedule "${scheduleName}" for user ${userId}`);
    console.log(`📝 Updates:`, updates);
    
    // Step 1: Verify the event exists and belongs to the user's schedule
    const eventCheck = await pool.query(`
      SELECT se.*, us.schedule_name
      FROM schedule_events se
      JOIN user_schedules us ON se.schedule_id = us.id
      WHERE se.id = $1 AND us.user_id = $2 AND us.schedule_name = $3
    `, [eventId, userId, scheduleName]);
    
    if (eventCheck.rows.length === 0) {
      throw new Error(`Event ${eventId} not found in schedule "${scheduleName}" for user ${userId}`);
    }
    
    const originalEvent = eventCheck.rows[0];
    console.log(`📅 Found event to update:`, {
      id: originalEvent.id,
      title: originalEvent.event_title,
      startTime: originalEvent.start_time
    });
    
    // Step 2: Build the update query dynamically based on provided updates
    const allowedFields = {
      'title': 'event_title',
      'description': 'event_description', 
      'startTime': 'start_time',
      'endTime': 'end_time',
      'location': 'location',
      'type': 'event_type',
      'isAllDay': 'is_all_day',
      'reminderMinutes': 'reminder_minutes',
      'recurrenceRule': 'recurrence_rule'
    };
    
    const updateFields = [];
    const updateValues = [];
    let paramCounter = 1;
    
    // Process each update field
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields[key]) {
        updateFields.push(`${allowedFields[key]} = $${paramCounter}`);
        updateValues.push(value);
        paramCounter++;
      } else {
        console.warn(`⚠️ Ignoring unknown field: ${key}`);
      }
    }
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields provided for update');
    }
    
    // Add updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add the eventId as the last parameter for WHERE clause
    updateValues.push(eventId);
    
    // Step 3: Execute the update
    const updateQuery = `
      UPDATE schedule_events 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *
    `;
    
    console.log(`📝 Update query:`, updateQuery);
    console.log(`📝 Update values:`, updateValues);
    
    const updateResult = await pool.query(updateQuery, updateValues);
    
    if (updateResult.rows.length === 0) {
      throw new Error(`Update failed - no rows affected for event ${eventId}`);
    }
    
    const updatedEvent = updateResult.rows[0];
    console.log(`✅ Successfully updated event:`, {
      id: updatedEvent.id,
      title: updatedEvent.event_title,
      updatedFields: Object.keys(updates)
    });
    
    return updatedEvent;
    
  } catch (error) {
    console.error('❌ Error in updateEvent:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}

async function deleteEvent(userId, scheduleName, eventId) {
  try {
    console.log(`🗑️ Deleting event ${eventId} from schedule "${scheduleName}" for user ${userId}`);
    
    // Step 1: Verify the event exists and belongs to the user's schedule
    const eventCheck = await pool.query(`
      SELECT se.*, us.schedule_name
      FROM schedule_events se
      JOIN user_schedules us ON se.schedule_id = us.id
      WHERE se.id = $1 AND us.user_id = $2 AND us.schedule_name = $3
    `, [eventId, userId, scheduleName]);
    
    if (eventCheck.rows.length === 0) {
      throw new Error(`Event ${eventId} not found in schedule "${scheduleName}" for user ${userId}`);
    }
    
    const eventToDelete = eventCheck.rows[0];
    console.log(`📅 Found event to delete:`, {
      id: eventToDelete.id,
      title: eventToDelete.event_title,
      startTime: eventToDelete.start_time
    });
    
    // Step 2: Delete the event
    const deleteResult = await pool.query(
      'DELETE FROM schedule_events WHERE id = $1 RETURNING *',
      [eventId]
    );
    
    const deletedEvent = deleteResult.rows[0];
    console.log(`✅ Successfully deleted event:`, {
      id: deletedEvent.id,
      title: deletedEvent.event_title
    });
    
    return deletedEvent;
    
  } catch (error) {
    console.error('❌ Error in deleteEvent:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}

async function deleteUserSchedule(userId, scheduleName) {
  try {
    console.log(`🗑️ Deleting entire schedule "${scheduleName}" for user ${userId}`);
    
    // Step 1: Find the schedule and get its ID
    const scheduleQuery = await pool.query(
      'SELECT id, schedule_name FROM user_schedules WHERE user_id = $1 AND schedule_name = $2',
      [userId, scheduleName]
    );
    
    if (scheduleQuery.rows.length === 0) {
      throw new Error(`Schedule "${scheduleName}" not found for user ${userId}`);
    }
    
    const scheduleId = scheduleQuery.rows[0].id;
    console.log(`📅 Found schedule "${scheduleName}" with ID: ${scheduleId}`);
    
    // Step 2: Delete all events in the schedule first (foreign key constraint)
    const deleteEventsResult = await pool.query(
      'DELETE FROM schedule_events WHERE schedule_id = $1',
      [scheduleId]
    );
    
    console.log(`🗑️ Deleted ${deleteEventsResult.rowCount} events from schedule`);
    
    // Step 3: Delete the schedule itself
    const deleteScheduleResult = await pool.query(
      'DELETE FROM user_schedules WHERE id = $1 RETURNING *',
      [scheduleId]
    );
    
    const deletedSchedule = deleteScheduleResult.rows[0];
    console.log(`✅ Successfully deleted schedule:`, {
      id: deletedSchedule.id,
      name: deletedSchedule.schedule_name,
      deletedEvents: deleteEventsResult.rowCount
    });
    
    return {
      ...deletedSchedule,
      deletedEventsCount: deleteEventsResult.rowCount
    };
    
  } catch (error) {
    console.error('❌ Error in deleteUserSchedule:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}

//MEMORY
async function createMemoryCategory(userId, categoryName, categoryType = 'general', options = {}) {
  try {
    const { description, color, icon } = options;
    
    console.log(`🧠 Creating memory category "${categoryName}" for user ${userId}`);
    
    // Use direct SQL to create category
    const result = await pool.query(`
        INSERT INTO memory_categories (user_id, category_name, category_type, description, color, icon)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, category_name)
        DO UPDATE SET 
            category_type = EXCLUDED.category_type,
            description = EXCLUDED.description,
            color = EXCLUDED.color,
            icon = EXCLUDED.icon,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `, [userId, categoryName, categoryType, description, color, icon]);
    
    console.log(`✅ Created/updated memory category:`, result.rows[0]);
    return result.rows[0];
    
  } catch (error) {
      console.error('❌ Error creating memory category:', error);
      throw error;
  }
}

async function addMemoryItem(userId, categoryName, memoryKey, memoryValue, options = {}) {
  console.log('🔍 [DEEP DEBUG] === ADD MEMORY ITEM START ===');
  console.log('🔍 [DEEP DEBUG] Input parameters:', {
    userId: userId,
    categoryName: categoryName,
    memoryKey: memoryKey,
    memoryValue: memoryValue,
    options: options
  });
  
  try {
      const {
        type = 'fact',
        importance = 0,
        tags = [],
        expiresAt = null,
        isPrivate = false
      } = options || {};

      // Normalize key/value inputs
      let preparedKey = typeof memoryKey === 'string' ? memoryKey.trim() : '';
      if (!preparedKey && memoryKey !== undefined && memoryKey !== null) {
        preparedKey = String(memoryKey).trim();
      }
      const preparedValue = (memoryValue === undefined || memoryValue === null)
        ? ''
        : (typeof memoryValue === 'string'
            ? memoryValue.trim()
            : String(memoryValue).trim());
      
      if (!preparedKey) {
        preparedKey = preparedValue
          ? preparedValue.slice(0, 64)
          : `Memory ${new Date().toISOString()}`;
      }

      // Normalize option values for database storage
      const memory_type = type || 'fact';
      const normalizedImportance = Number.isFinite(importance) ? importance : 0;
      const tagsArray = Array.isArray(tags)
        ? tags.filter(Boolean)
        : (tags ? [tags] : []);
      const expires_at = expiresAt || null;
      const is_private = Boolean(isPrivate);
      
      console.log('🔍 [DEEP DEBUG] Using normalized values:', {
        memory_type,
        importance: normalizedImportance,
        expires_at,
        is_private,
        tagsArray,
        tagsArrayType: Array.isArray(tagsArray) ? 'array' : typeof tagsArray,
        preparedKey,
        preparedValue
      });

      console.log(`🔍 [DEEP DEBUG] Step 1: Finding category "${categoryName}"...`);
      
      // Get existing categories
      const categoriesResult = await pool.query(
          'SELECT id, category_name FROM memory_categories WHERE user_id = $1',
          [userId]
      );
      
      console.log('🔍 [DEEP DEBUG] Found categories:', categoriesResult.rows);

      let targetCategoryId = null;
      let targetCategoryName = null;

      if (categoriesResult.rows.length === 0) {
          // NO CATEGORIES EXIST - CREATE THE REQUESTED ONE AUTOMATICALLY
          console.log(`🔍 [DEEP DEBUG] No categories exist - auto-creating "${categoryName}"`);
          
          const createResult = await pool.query(`
              INSERT INTO memory_categories (user_id, category_name, category_type, created_at, updated_at)
              VALUES ($1, $2, 'general', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              RETURNING id, category_name
          `, [userId, categoryName]);
          
          targetCategoryId = createResult.rows[0].id;
          targetCategoryName = createResult.rows[0].category_name;
          console.log(`✅ Auto-created category: "${targetCategoryName}" with ID: ${targetCategoryId}`);
          
      } else {
          // CATEGORIES EXIST - TRY TO FIND A MATCH
          console.log('🔍 [DEEP DEBUG] Categories exist - looking for match...');
          
          // Try exact match first
          const exactMatch = categoriesResult.rows.find(cat => 
              cat.category_name.toLowerCase() === categoryName.toLowerCase()
          );

          if (exactMatch) {
              targetCategoryId = exactMatch.id;
              targetCategoryName = exactMatch.category_name;
              console.log('🔍 [DEEP DEBUG] Found exact match:', { targetCategoryId, targetCategoryName });
          } else {
              // Try partial match
              console.log('🔍 [DEEP DEBUG] No exact match, trying partial...');
              const partialMatch = categoriesResult.rows.find(cat => 
                  cat.category_name.toLowerCase().includes(categoryName.toLowerCase()) ||
                  categoryName.toLowerCase().includes(cat.category_name.toLowerCase())
              );

              if (partialMatch) {
                  targetCategoryId = partialMatch.id;
                  targetCategoryName = partialMatch.category_name;
                  console.log('🔍 [DEEP DEBUG] Found partial match:', { targetCategoryId, targetCategoryName });
              } else {
                  // NO MATCH FOUND - CREATE NEW CATEGORY AUTOMATICALLY (LIKE LISTS DO!)
                  console.log(`🔍 [DEEP DEBUG] No matches found - auto-creating "${categoryName}"`);
                  
                  const createResult = await pool.query(`
                      INSERT INTO memory_categories (user_id, category_name, category_type, created_at, updated_at)
                      VALUES ($1, $2, 'general', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                      RETURNING id, category_name
                  `, [userId, categoryName]);
                  
                  targetCategoryId = createResult.rows[0].id;
                  targetCategoryName = createResult.rows[0].category_name;
                  console.log(`✅ Auto-created new category: "${targetCategoryName}" with ID: ${targetCategoryId}`);
              }
          }
      }

      console.log('🔍 [DEEP DEBUG] Step 2: Preparing SQL query...');
      
      // FIXED: Use array format for PostgreSQL tags column
      const queryParams = [
        targetCategoryId,
        preparedKey,
        preparedValue,
        memory_type,
        normalizedImportance,
        tagsArray,
        expires_at,
        is_private
      ];
      console.log('🔍 [DEEP DEBUG] Query parameters:', queryParams);
      
      const sqlQuery = `
          INSERT INTO memory_items (category_id, memory_key, memory_value, memory_type, importance, tags, expires_at, is_private)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (category_id, memory_key)
          DO UPDATE SET 
              memory_value = EXCLUDED.memory_value,
              updated_at = CURRENT_TIMESTAMP
          RETURNING *
      `;
      
      console.log('🔍 [DEEP DEBUG] Step 3: Executing query...');
      const result = await pool.query(sqlQuery, queryParams);
      
      console.log('🔍 [DEEP DEBUG] Query executed successfully');
      console.log('🔍 [DEEP DEBUG] Result:', result.rows[0]);
      console.log('🔍 [DEEP DEBUG] === ADD MEMORY ITEM SUCCESS ===');
      
      return result.rows[0];

  } catch (error) {
      console.error('🔍 [DEEP DEBUG] === ADD MEMORY ITEM FAILED ===');
      console.error('🔍 [DEEP DEBUG] Error message:', error.message);
      console.error('🔍 [DEEP DEBUG] Error code:', error.code);
      console.error('🔍 [DEEP DEBUG] Error detail:', error.detail);
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
        ORDER BY mc.category_name, mi.created_at DESC
    `, [userId]);

    console.log(`🧠 Raw memory data from your tables:`, result.rows);

    // Group by category
    const memoriesObject = {};
    
    result.rows.forEach(row => {
        const categoryName = row.category_name;
        
        if (!memoriesObject[categoryName]) {
            memoriesObject[categoryName] = {
                name: categoryName,
                items: [],
                created: row.category_created,
                lastUpdated: row.category_updated
            };
        }
        
        // Only add memory item if it exists (LEFT JOIN might return null)
        if (row.memory_id) {
            // FIXED: Handle tags properly - check if it's array or string
            let processedTags;
            if (Array.isArray(row.tags)) {
                processedTags = row.tags; // Already an array
            } else if (typeof row.tags === 'string' && row.tags.includes(',')) {
                processedTags = row.tags.split(',').map(tag => tag.trim());
            } else if (typeof row.tags === 'string' && row.tags.length > 0) {
                processedTags = [row.tags]; // Single tag as array
            } else {
                processedTags = []; // Empty array for null/undefined/empty
            }
            
            memoriesObject[categoryName].items.push({
                id: row.memory_id,
                key: row.memory_key,
                value: row.memory_value,
                type: row.memory_type,
                importance: row.importance,
                tags: processedTags, // Use processed tags
                expiresAt: row.expires_at,
                isPrivate: row.is_private,
                created: row.memory_created,
                lastUpdated: row.memory_updated
            });
        }
    });
    
    console.log(`✅ Processed memories for user ${userId}:`, memoriesObject);
    return memoriesObject;
    
  } catch (error) {
    console.error('❌ Error getting user memories:', error);
    console.error('❌ Error details:', error.message);
    return {};
  }
}

/**
 * Update a memory item
 * @param {string} userId - The user ID
 * @param {string} categoryName - The category name
 * @param {number} itemId - The memory item ID
 * @param {object} updates - The updates to apply
 * @returns {object} The updated memory item
 */
async function updateMemoryItem(userId, categoryName, itemId, updates) {
  try {
    console.log(`📝 Updating memory item ${itemId} in category "${categoryName}" for user ${userId}`);
    console.log('📝 Updates to apply:', updates);
    
    // Step 1: Find the memory item to make sure it exists
    const itemCheck = await pool.query(`
      SELECT mi.id, mi.memory_key, mi.memory_value, mc.category_name
      FROM memory_items mi
      JOIN memory_categories mc ON mi.category_id = mc.id
      WHERE mi.id = $1 AND mc.user_id = $2 AND mc.category_name = $3
    `, [itemId, userId, categoryName]);
    
    if (itemCheck.rows.length === 0) {
      throw new Error(`Memory item ${itemId} not found in category "${categoryName}" for user ${userId}`);
    }
    
    const originalItem = itemCheck.rows[0];
    console.log(`📝 Found item to update: ${originalItem.memory_key} = ${originalItem.memory_value}`);
    
    // Step 2: Prepare the update fields
    const updateFields = [];
    const updateValues = [];
    let parameterIndex = 1;
    
    // Handle memory key update
    if (updates.key || updates.memoryKey) {
      updateFields.push(`memory_key = $${parameterIndex}`);
      updateValues.push(updates.key || updates.memoryKey);
      parameterIndex++;
    }
    
    // Handle memory value update
    if (updates.value || updates.memoryValue) {
      updateFields.push(`memory_value = $${parameterIndex}`);
      updateValues.push(updates.value || updates.memoryValue);
      parameterIndex++;
    }
    
    // Always update the timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updateFields.length === 1) { // Only timestamp update
      throw new Error('No valid updates provided');
    }
    
    // Add WHERE clause parameters
    updateValues.push(itemId, userId, categoryName);
    const whereClause = `WHERE mi.id = $${parameterIndex} 
                        AND mc.user_id = $${parameterIndex + 1} 
                        AND mc.category_name = $${parameterIndex + 2}`;
    
    // Step 3: Execute the update
    const updateQuery = `
      UPDATE memory_items mi 
      SET ${updateFields.join(', ')}
      FROM memory_categories mc
      WHERE mi.category_id = mc.id 
      AND mi.id = $${parameterIndex} 
      AND mc.user_id = $${parameterIndex + 1} 
      AND mc.category_name = $${parameterIndex + 2}
      RETURNING mi.*, mc.category_name
    `;
    
    console.log('📝 Executing update query:', updateQuery);
    console.log('📝 Update values:', updateValues);
    
    const result = await pool.query(updateQuery, updateValues);
    
    if (result.rows.length === 0) {
      throw new Error('Update failed - no rows affected');
    }
    
    const updatedItem = result.rows[0];
    console.log(`✅ Successfully updated memory item:`, {
      id: updatedItem.id,
      key: updatedItem.memory_key,
      value: updatedItem.memory_value,
      updated_at: updatedItem.updated_at
    });
    
    return updatedItem;
    
  } catch (error) {
    console.error('❌ Error in updateMemoryItem:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Delete a memory item
 * @param {string} userId - The user ID
 * @param {string} categoryName - The category name
 * @param {number} itemId - The memory item ID to delete
 * @returns {object} The deleted memory item
 */
async function deleteMemoryItem(userId, categoryName, itemId) {
  try {
    console.log(`🗑️ Deleting memory item ${itemId} from category "${categoryName}" for user ${userId}`);
    
    // Step 1: Get the item before deleting for confirmation
    const itemCheck = await pool.query(`
      SELECT mi.id, mi.memory_key, mi.memory_value, mc.category_name
      FROM memory_items mi
      JOIN memory_categories mc ON mi.category_id = mc.id
      WHERE mi.id = $1 AND mc.user_id = $2 AND mc.category_name = $3
    `, [itemId, userId, categoryName]);
    
    if (itemCheck.rows.length === 0) {
      throw new Error(`Memory item ${itemId} not found in category "${categoryName}" for user ${userId}`);
    }
    
    const itemToDelete = itemCheck.rows[0];
    console.log(`🗑️ Found item to delete: ${itemToDelete.memory_key} = ${itemToDelete.memory_value}`);
    
    // Step 2: Delete the item
    const deleteQuery = `
      DELETE FROM memory_items mi
      USING memory_categories mc
      WHERE mi.category_id = mc.id 
      AND mi.id = $1 
      AND mc.user_id = $2 
      AND mc.category_name = $3
      RETURNING mi.*, mc.category_name
    `;
    
    const result = await pool.query(deleteQuery, [itemId, userId, categoryName]);
    
    if (result.rows.length === 0) {
      throw new Error('Delete failed - no rows affected');
    }
    
    const deletedItem = result.rows[0];
    console.log(`✅ Successfully deleted memory item:`, {
      id: deletedItem.id,
      key: deletedItem.memory_key,
      value: deletedItem.memory_value,
      from_category: deletedItem.category_name
    });
    
    return deletedItem;
    
  } catch (error) {
    console.error('❌ Error in deleteMemoryItem:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Delete an entire memory category
 * @param {string} userId - The user ID
 * @param {string} categoryName - The category name to delete
 * @returns {object} Summary of what was deleted
 */
async function deleteMemoryCategory(userId, categoryName) {
  try {
    console.log(`🗑️ Deleting entire memory category "${categoryName}" for user ${userId}`);
    
    // Step 1: Get category info and count items
    const categoryCheck = await pool.query(`
      SELECT mc.id, mc.category_name, COUNT(mi.id) as item_count
      FROM memory_categories mc
      LEFT JOIN memory_items mi ON mc.id = mi.category_id
      WHERE mc.user_id = $1 AND mc.category_name = $2
      GROUP BY mc.id, mc.category_name
    `, [userId, categoryName]);
    
    if (categoryCheck.rows.length === 0) {
      throw new Error(`Memory category "${categoryName}" not found for user ${userId}`);
    }
    
    const category = categoryCheck.rows[0];
    const categoryId = category.id;
    const itemCount = parseInt(category.item_count) || 0;
    
    console.log(`🗑️ Found category to delete: "${category.category_name}" with ${itemCount} items`);
    
    // Step 2: Delete all memory items in the category first (foreign key constraint)
    const deleteItemsResult = await pool.query(
      'DELETE FROM memory_items WHERE category_id = $1',
      [categoryId]
    );
    
    console.log(`🗑️ Deleted ${deleteItemsResult.rowCount} memory items from category`);
    
    // Step 3: Delete the category itself
    const deleteCategoryResult = await pool.query(
      'DELETE FROM memory_categories WHERE id = $1 RETURNING *',
      [categoryId]
    );
    
    const deletedCategory = deleteCategoryResult.rows[0];
    console.log(`✅ Successfully deleted memory category:`, {
      id: deletedCategory.id,
      name: deletedCategory.category_name,
      deletedItems: deleteItemsResult.rowCount
    });
    
    return {
      ...deletedCategory,
      deletedItemsCount: deleteItemsResult.rowCount
    };
    
  } catch (error) {
    console.error('❌ Error in deleteMemoryCategory:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
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
  buildSmartContext,
  createFamilyAccount,
  authenticateFamilyAccount,
  getFamilyAccountWithProfiles,
  createProfileInAccount,
  createAccountSession,
  verifyAccountSession,
  deleteAccountSession,
  profileBelongsToAccount
};
