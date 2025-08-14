/**
 * AI-Powered Matching System
 * Handles all intelligent matching decisions using OpenAI
 */
class AISmartMatcher {
    constructor(openaiInstance) {
      this.openai = openaiInstance;
    }
  
    /**
     * AI-powered list matching
     */
    async findBestListMatch(userRequest, availableLists, itemsToAdd = []) {
      const listNames = Object.keys(availableLists);
      
      // If only one list, no need for AI
      if (listNames.length <= 1) {
        return listNames[0] || null;
      }
      
      console.log(`🤖 Using AI to match "${userRequest}" to best list`);
      
      const matchingPrompt = `You are a smart assistant helping match user requests to the best list.
  
        USER REQUEST: "${userRequest}"
        ITEMS TO ADD: ${JSON.stringify(itemsToAdd)}
        
        AVAILABLE LISTS:
        ${listNames.map((name, index) => {
            const list = availableLists[name];
            const itemCount = list.items?.length || 0;
            const recentItems = list.items?.slice(-3).map(item => item.text).join(', ') || 'empty';
            return `${index + 1}. "${name}" (${itemCount} items, recent: ${recentItems})`;
        }).join('\n')}
        
        RULES:
        1. If user mentions a specific list name, match to that list (even partial matches)
        2. If no specific list mentioned, use content of items to determine best match
        3. Consider the existing items in each list for context
        4. Food/grocery items usually go to shopping lists
        5. Tasks/work items usually go to todo/work lists
        6. If uncertain, pick the most recently used or most relevant list
        
        Respond with ONLY the exact list name from the available options, nothing else.
        If you think a new list should be created instead, respond with "CREATE_NEW".`;
  
      try {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: matchingPrompt },
            { role: "user", content: `Match this request: "${userRequest}"` }
          ],
          max_tokens: 50,
          temperature: 0.1,
        });
  
        const aiChoice = completion.choices[0].message.content.trim();
        
        console.log(`🎯 AI chose: "${aiChoice}"`);
        
        if (aiChoice === "CREATE_NEW") {
          return null;
        }
        
        const validChoice = listNames.find(name => 
          name.toLowerCase() === aiChoice.toLowerCase() ||
          aiChoice.toLowerCase().includes(name.toLowerCase())
        );
        
        return validChoice || listNames[0];
        
      } catch (error) {
        console.error('❌ AI matching failed, using fallback:', error);
        return this.fallbackListMatch(userRequest, availableLists, itemsToAdd);
      }
    }
  
    /**
     * AI-powered schedule matching
     */
    async findBestScheduleMatch(userRequest, availableSchedules) {
      const scheduleNames = Object.keys(availableSchedules);
      
      if (scheduleNames.length <= 1) {
        return scheduleNames[0] || null;
      }
      
      console.log(`🤖 Using AI to match "${userRequest}" to best schedule`);
      
      const matchingPrompt = `You are a smart assistant helping match scheduling requests to the best calendar/schedule.
  
        USER REQUEST: "${userRequest}"
        
        AVAILABLE SCHEDULES:
        ${scheduleNames.map((name, index) => {
            const schedule = availableSchedules[name];
            const eventCount = schedule.events?.length || 0;
            return `${index + 1}. "${name}" (${eventCount} events)`;
        }).join('\n')}
        
        RULES:
        1. If user mentions a specific schedule name, match to that
        2. Work-related events usually go to work/business schedules
        3. Personal events go to personal schedules
        4. If uncertain, pick the most commonly used schedule
        
        Respond with ONLY the exact schedule name from the available options.
        If you think a new schedule should be created, respond with "CREATE_NEW".`;
        
      try {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: matchingPrompt },
            { role: "user", content: `Match this request: "${userRequest}"` }
          ],
          max_tokens: 50,
          temperature: 0.1,
        });
  
        const aiChoice = completion.choices[0].message.content.trim();
        
        if (aiChoice === "CREATE_NEW") {
          return null;
        }
        
        const validChoice = scheduleNames.find(name => 
          name.toLowerCase() === aiChoice.toLowerCase()
        );
        
        return validChoice || scheduleNames[0];
        
      } catch (error) {
        console.error('❌ AI schedule matching failed:', error);
        return scheduleNames[0] || null;
      }
    }
  
    /**
     * AI-powered memory category matching
     */
    async findBestMemoryMatch(userRequest, availableMemory, itemsToStore = []) {
      const categoryNames = Object.keys(availableMemory);
      
      if (categoryNames.length <= 1) {
        return categoryNames[0] || null;
      }
      
      console.log(`🤖 Using AI to match "${userRequest}" to best memory category`);
      
      const matchingPrompt = `You are a smart assistant helping match memory storage requests to the best category.
  
        USER REQUEST: "${userRequest}"
        ITEMS TO STORE: ${JSON.stringify(itemsToStore)}
        
        AVAILABLE MEMORY CATEGORIES:
        ${categoryNames.map((name, index) => {
            const category = availableMemory[name];
            const itemCount = category.items?.length || 0;
            return `${index + 1}. "${name}" (${itemCount} items)`;
        }).join('\n')}
        
        RULES:
        1. If user mentions a specific category name, match to that
        2. Contact info (phones, emails, addresses) goes to contact categories
        3. Passwords/logins go to password/credential categories
        4. General notes/reminders go to notes/general categories
        5. If uncertain, pick the most relevant category
        
        Respond with ONLY the exact category name from the available options.
        If you think a new category should be created, respond with "CREATE_NEW".`;
  
      try {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: matchingPrompt },
            { role: "user", content: `Match this request: "${userRequest}"` }
          ],
          max_tokens: 50,
          temperature: 0.1,
        });
  
        const aiChoice = completion.choices[0].message.content.trim();
        
        if (aiChoice === "CREATE_NEW") {
          return null;
        }
        
        const validChoice = categoryNames.find(name => 
          name.toLowerCase() === aiChoice.toLowerCase()
        );
        
        return validChoice || categoryNames[0];
        
      } catch (error) {
        console.error('❌ AI memory matching failed:', error);
        return categoryNames[0] || null;
      }
    }
  
    /**
     * AI-powered smart naming
     */
    async generateSmartName(userRequest, existingNames = [], context = {}) {
      console.log(`🤖 AI generating smart name for: "${userRequest}"`);
      
      const namingPrompt = `You are a smart assistant that creates good names for lists and schedules.
  
        USER REQUEST: "${userRequest}"
        EXISTING NAMES: ${JSON.stringify(existingNames)}
        CONTEXT: ${JSON.stringify(context)}
        
        RULES:
        1. Create a clear, descriptive name
        2. Make it different from existing names
        3. Use proper capitalization (Title Case)
        4. Keep it concise but descriptive
        5. For dates like "tomorrow", convert to actual day names
        6. For generic requests, create meaningful names
        
        EXAMPLES:
        - "list for tomorrow" (Wednesday) → "Thursday List"
        - "shopping stuff" → "Shopping List"
        - "work things" → "Work Tasks"
        - "meeting next week" → "Weekly Meetings"
        
        Respond with ONLY the name, nothing else.`;
  
      try {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: namingPrompt },
            { role: "user", content: userRequest }
          ],
          max_tokens: 30,
          temperature: 0.3,
        });
  
        const aiName = completion.choices[0].message.content.trim();
        console.log(`🎯 AI generated name: "${aiName}"`);
        
        return aiName;
        
      } catch (error) {
        console.error('❌ AI naming failed:', error);
        return this.fallbackNaming(userRequest);
      }
    }
  
    /**
     * Fallback matching logic (simple rules)
     */
    fallbackListMatch(userRequest, availableLists, itemsToAdd) {
      const listNames = Object.keys(availableLists);
      const request = userRequest.toLowerCase();
      
      // Try exact name match
      const exactMatch = listNames.find(name => 
        request.includes(name.toLowerCase())
      );
      if (exactMatch) return exactMatch;
      
      // Content-based matching
      if (itemsToAdd.length > 0) {
        const item = itemsToAdd[0].toLowerCase();
        
        // Food items
        if (['milk', 'bread', 'eggs', 'cheese', 'meat', 'fruit', 'vegetable', 'grocery'].some(food => item.includes(food))) {
          const shoppingList = listNames.find(name => name.toLowerCase().includes('shop'));
          if (shoppingList) return shoppingList;
        }
        
        // Task items
        if (['meeting', 'call', 'email', 'work', 'task', 'finish'].some(task => item.includes(task))) {
          const todoList = listNames.find(name => name.toLowerCase().includes('todo') || name.toLowerCase().includes('task'));
          if (todoList) return todoList;
        }
      }
      
      return listNames[0] || null;
    }
  
    /**
     * Fallback naming
     */
    fallbackNaming(userRequest) {
      const request = userRequest.toLowerCase();
      
      if (request.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toLocaleDateString('en-US', { weekday: 'long' }) + ' List';
      }
      
      if (request.includes('shop')) return 'Shopping List';
      if (request.includes('todo') || request.includes('task')) return 'Todo List';
      if (request.includes('work')) return 'Work List';
      
      return 'New List';
    }
}

module.exports = { AISmartMatcher };