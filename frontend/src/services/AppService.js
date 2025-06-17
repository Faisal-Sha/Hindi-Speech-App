
class AppService {
    constructor() {
      this.baseUrl = 'http://localhost:3001';
    }
  
    async sendMessageToAI(message, mode, context, language, userId = 'default') {
      try {
        console.log(`🚀 Sending to AI: "${message}" in ${mode} mode (${language})`);
  
        const response = await fetch(`${this.baseUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            mode,
            context,
            language,
            userId
          })
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        console.log(`📥 AI Response:`, {
          response: data.response?.substring(0, 100) + '...',
          actionsCount: data.actions?.length || 0
        });
  
        return data;
      } catch (error) {
        console.error('❌ AI Service Error:', error);
        throw error;
      }
    }
  
    // FIXED: Efficient incremental data updates
    async saveItem(userId, dataType, itemId, itemData) {
      try {
        const response = await fetch(`${this.baseUrl}/save-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId, 
            dataType, 
            itemId, 
            itemData 
          })
        });
  
        if (!response.ok) {
          throw new Error('Failed to save item');
        }
  
        console.log(`💾 Saved ${dataType}/${itemId} (${JSON.stringify(itemData).length} chars)`);
        return true;
      } catch (error) {
        console.error('❌ Save Item Error:', error);
        return false;
      }
    }
  
    // FIXED: Add single sub-item efficiently
    async addSubItem(userId, dataType, itemId, subItem, arrayField = 'items') {
      try {
        const response = await fetch(`${this.baseUrl}/add-sub-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId, 
            dataType, 
            itemId, 
            subItem,
            arrayField 
          })
        });
  
        if (!response.ok) {
          throw new Error('Failed to add sub-item');
        }
  
        console.log(`➕ Added sub-item to ${dataType}/${itemId} (${JSON.stringify(subItem).length} chars)`);
        return true;
      } catch (error) {
        console.error('❌ Add Sub-Item Error:', error);
        return false;
      }
    }
  
    // FIXED: Update only metadata (last updated, counts, etc.)
    async updateItemMetadata(userId, dataType, itemId, metadata) {
      try {
        const response = await fetch(`${this.baseUrl}/update-metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId, 
            dataType, 
            itemId, 
            metadata 
          })
        });
  
        if (!response.ok) {
          throw new Error('Failed to update metadata');
        }
  
        console.log(`🔄 Updated metadata for ${dataType}/${itemId}`);
        return true;
      } catch (error) {
        console.error('❌ Update Metadata Error:', error);
        return false;
      }
    }
  
    // Batch operations for efficiency
    async saveMultipleItems(userId, operations) {
      try {
        const response = await fetch(`${this.baseUrl}/batch-save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, operations })
        });
  
        if (!response.ok) {
          throw new Error('Failed to batch save');
        }
  
        console.log(`📦 Batch saved ${operations.length} operations`);
        return true;
      } catch (error) {
        console.error('❌ Batch Save Error:', error);
        return false;
      }
    }
  
    // Load user's persistent data
    async loadUserData(userId) {
      try {
        const response = await fetch(`${this.baseUrl}/data/${userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to load data');
        }
  
        const data = await response.json();
        console.log(`📖 Loaded data for ${userId}:`, {
          lists: Object.keys(data.lists || {}).length,
          schedules: Object.keys(data.schedules || {}).length,
          memory: Object.keys(data.memory || {}).length,
          chats: Object.keys(data.chats || {}).length
        });
  
        return data;
      } catch (error) {
        console.error('❌ Load Error:', error);
        return { lists: {}, schedules: {}, memory: {}, chats: {} };
      }
    }
  
    // Text-to-speech
    speakText(text, language) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('❌ Speech Error:', error);
      }
    }
  
    // Health check
    async checkHealth() {
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        return await response.json();
      } catch (error) {
        return { status: 'ERROR', message: 'Backend unreachable' };
      }
    }
  }
  
  // Create singleton instance
  const appService = new AppService();
  export default appService;