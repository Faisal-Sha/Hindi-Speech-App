import React, { useState, useCallback, useRef } from 'react';
import CollapsibleSection from './CollapsibleSection';

const ContentDisplay = ({ 
  currentMode, 
  messages, 
  userLists, 
  userSchedules, 
  userMemory,
  isDataLoading, 
  // List handlers
  onUpdateListItem, 
  onDeleteListItem,
  onDeleteList,
  // Schedule handlers
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent, 
  onDeleteSchedule, 
  // Memory handlers
  onUpdateMemoryItem,
  onDeleteMemoryItem, 
  onDeleteMemory 
}) => {

  // ===== STATE MANAGEMENT =====
  const [editingItem, setEditingItem] = useState(null);
  const [editText, setEditText] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [editEventData, setEditEventData] = useState({});
  const [editingMemoryItem, setEditingMemoryItem] = useState(null);
  const [editMemoryData, setEditMemoryData] = useState({});

  const isEditingRef = useRef(false);

  // ===== DEBUG LOGGING =====
  console.log('🔍 ContentDisplay received props:', {
    currentMode,
    userListsKeys: userLists ? Object.keys(userLists) : 'null',
    userSchedulesKeys: userSchedules ? Object.keys(userSchedules) : 'null', 
    userMemoryKeys: userMemory ? Object.keys(userMemory) : 'null',
    isDataLoading,
    messagesCount: messages?.length || 0,
    hasHandlers: {
      onUpdateListItem: !!onUpdateListItem,
      onDeleteListItem: !!onDeleteListItem,
      onDeleteList: !!onDeleteList,
      onUpdateEvent: !!onUpdateEvent,
      onDeleteEvent: !!onDeleteEvent,
      onDeleteSchedule: !!onDeleteSchedule,
      onUpdateMemoryItem: !!onUpdateMemoryItem,
      onDeleteMemoryItem: !!onDeleteMemoryItem,
      onDeleteMemory: !!onDeleteMemory
    }
  });

  // ===== UTILITY FUNCTIONS =====
  const formatDate = (dateInput) => {
    if (!dateInput) return 'Just now';
    
    try {
      let date;
      
      if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        date = new Date(dateInput);
      } else if (dateInput?.toDate) {
        date = dateInput.toDate();
      } else {
        return 'Just now';
      }
      
      if (isNaN(date.getTime())) {
        return 'Just now';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffSeconds < 45) {
        return 'Just now';
      }
      
      if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
      }
      
      if (diffHours < 24) {
        return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      if (diffDays === 1) {
        return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      if (diffDays < 7) {
        return `${diffDays} days ago`;
      }
      
      const options = { month: 'short', day: 'numeric' };
      if (date.getFullYear() !== now.getFullYear()) {
        options.year = 'numeric';
      }
      
      return date.toLocaleDateString(undefined, options);
      
    } catch (error) {
      console.warn('Error formatting date:', error);
      return 'Just now';
    }
  };

  // ===== LIST ITEM FUNCTIONS =====
  const toggleItemCompletion = useCallback((listName, item, listId) => {
    if (isEditingRef.current) return; // Don't toggle if editing
    
    console.log(`🔄 Toggling completion for item in list: ${listName}`, item);
    
    if (onUpdateListItem) {
      // Send smart action format
      onUpdateListItem({
        type: 'smart_update',
        intent: `toggling completion for item in ${listName}`,
        data: {
          target: listName,
          operation: 'update_item',
          values: [],
            metadata: {
              itemId: item.id,
              updates: { completed: !item.completed },
              listName: listName,
              ...(listId ? { listId } : {}),
              confidence: 'high'
            }
        }
      });
    }
  }, [onUpdateListItem]);

  const startEditing = useCallback((listName, item) => {
    console.log(`📝 Starting edit for item in list: ${listName}`, item);
    isEditingRef.current = true;
    setEditingItem({ listName, itemId: item.id });
    setEditText(typeof item === 'string' ? item : item.text || item.name || '');
  }, []);

  const saveEdit = useCallback(async (listName, item, listId) => {
    if (!editText.trim()) {
      cancelEdit();
      return;
    }
    
    console.log(`💾 Saving edit for item in list: ${listName}`);
    
    if (onUpdateListItem) {
      // Send smart action format
      await onUpdateListItem({
        type: 'smart_update',
        intent: `updating text for item in ${listName}`,
        data: {
          target: listName,
          operation: 'update_item',
          values: [],
            metadata: {
              itemId: item.id,
              updates: { text: editText.trim() },
              listName: listName,
              ...(listId ? { listId } : {}),
              confidence: 'high'
            }
        }
      });
    }
    
    setEditingItem(null);
    setEditText('');
    isEditingRef.current = false;
  }, [onUpdateListItem, editText]);

  const cancelEdit = useCallback(() => {
    console.log('❌ Cancelling list item edit');
    setEditingItem(null);
    setEditText('');
    isEditingRef.current = false;
  }, []);

  const deleteItem = useCallback((listName, item, listId) => {
    const itemName = typeof item === 'string' ? item : item.text || item.name || 'this item';
    
    if (window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
      console.log(`🗑️ Deleting item from list: ${listName}`, item);
      
      if (onDeleteListItem) {
        // Send smart action format
        onDeleteListItem({
          type: 'smart_delete',
          intent: `deleting item from ${listName}`,
          data: {
            target: listName,
            operation: 'delete_item',
            values: [],
            metadata: {
              itemId: item.id,
              listName: listName,
              ...(listId ? { listId } : {}),
              confidence: 'high'
            }
          }
        });
      }
    }
  }, [onDeleteListItem]);

  const deleteList = useCallback((listName, listId) => {
    if (window.confirm(`Are you sure you want to delete the entire list "${listName}"? This will remove all items in this list.`)) {
      console.log(`🗑️ Deleting entire list: ${listName}`);
      
      if (onDeleteList) {
        // Send smart action format
        onDeleteList({
          type: 'smart_delete',
          intent: `deleting entire list ${listName}`,
          data: {
            target: listName,
            operation: 'delete_list',
            values: [],
            metadata: {
              ...(listId ? { listId } : {}),
              confidence: 'high'
            }
          }
        });
      }
    }
  }, [onDeleteList]);

  // ===== EVENT FUNCTIONS =====
  const getEventTitle = (event) => {
    return event.title || event.eventTitle || event.name || event.summary || 'Untitled Event';
  };

  const getEventTime = (event) => {
    if (event.startTime) {
      const time = new Date(event.startTime);
      if (!isNaN(time.getTime())) {
        return time.toLocaleString();
      }
    }
    return event.time || event.eventTime || 'Time not set';
  };

  const getEventDescription = (event) => {
    return event.description || event.eventDescription || event.details || '';
  };

  const startEditingEvent = useCallback((scheduleName, event) => {
    console.log(`📝 Starting edit for event in schedule: ${scheduleName}`, event);
    setEditingEvent({ scheduleName, eventId: event.id });
    setEditEventData({
      title: getEventTitle(event),
      time: getEventTime(event),
      description: getEventDescription(event),
      location: event.location || ''
    });
  }, []);

  const saveEditingEvent = useCallback(async () => {
    if (!editEventData.title?.trim()) {
      cancelEditingEvent();
      return;
    }
    
    try {
      console.log('💾 Saving event edit:', editEventData);
      
      const updates = {
        title: editEventData.title.trim(),
        time: editEventData.time,
        description: editEventData.description || '',
        location: editEventData.location || ''
      };
      
      if (onUpdateEvent) {
        // Send smart action format
        await onUpdateEvent({
          type: 'smart_update',
          intent: `updating event in ${editingEvent.scheduleName}`,
          data: {
            target: editingEvent.scheduleName,
            operation: 'update_event',
            values: [],
            metadata: {
              eventId: editingEvent.eventId,
              updates: updates,
              scheduleName: editingEvent.scheduleName,
              confidence: 'high'
            }
          }
        });
      }
      
      setEditingEvent(null);
      setEditEventData({});
      
    } catch (error) {
      console.error('❌ Error saving event:', error);
    }
  }, [onUpdateEvent, editingEvent, editEventData]);

  const cancelEditingEvent = useCallback(() => {
    console.log('❌ Cancelling event edit');
    setEditingEvent(null);
    setEditEventData({});
  }, []);

  const updateEventField = useCallback((field, value) => {
    setEditEventData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const deleteEvent = useCallback((scheduleName, event) => {
    const eventName = getEventTitle(event);
    
    if (window.confirm(`Are you sure you want to delete "${eventName}"?`)) {
      console.log(`🗑️ Deleting event from schedule: ${scheduleName}`, event);
      
      if (onDeleteEvent) {
        // Send smart action format
        onDeleteEvent({
          type: 'smart_delete',
          intent: `deleting event from ${scheduleName}`,
          data: {
            target: scheduleName,
            operation: 'delete_event',
            values: [],
            metadata: {
              eventId: event.id,
              scheduleName: scheduleName,
              confidence: 'high'
            }
          }
        });
      }
    }
  }, [onDeleteEvent]);

  const deleteSchedule = useCallback((scheduleName) => {
    if (window.confirm(`Are you sure you want to delete the entire schedule "${scheduleName}"? This will remove all events in this schedule.`)) {
      console.log(`🗑️ Deleting entire schedule: ${scheduleName}`);
      
      if (onDeleteSchedule) {
        // Send smart action format
        onDeleteSchedule({
          type: 'smart_delete',
          intent: `deleting entire schedule ${scheduleName}`,
          data: {
            target: scheduleName,
            operation: 'delete_schedule',
            values: [],
            metadata: {
              confidence: 'high'
            }
          }
        });
      }
    }
  }, [onDeleteSchedule]);
  

  // ===== MEMORY FUNCTIONS =====
  const startEditingMemoryItem = useCallback((categoryName, item) => {
    console.log(`📝 Starting edit for memory item in category: ${categoryName}`, item);
    setEditingMemoryItem({ categoryName, itemId: item.id });
    setEditMemoryData({
      key: item.key || item.memoryKey || '',
      value: item.value || item.memoryValue || ''
    });
  }, []);

  const saveEditingMemoryItem = useCallback(async () => {
    try {
      const updates = {};
      
      if (editMemoryData.key && editMemoryData.key.trim()) {
        updates.key = editMemoryData.key.trim();
        updates.memoryKey = editMemoryData.key.trim(); // For compatibility
      }
      
      if (editMemoryData.value && editMemoryData.value.trim()) {
        updates.value = editMemoryData.value.trim();
        updates.memoryValue = editMemoryData.value.trim(); // For compatibility
      }
      
      console.log('📝 Final memory updates:', updates);
      
      if (onUpdateMemoryItem) {
        // Send smart action format
        await onUpdateMemoryItem({
          type: 'smart_update',
          intent: `updating memory item in ${editingMemoryItem.categoryName}`,
          data: {
            target: editingMemoryItem.categoryName,
            operation: 'update_memory',
            values: [],
            metadata: {
              itemId: editingMemoryItem.itemId,
              updates: updates,
              categoryName: editingMemoryItem.categoryName,
              confidence: 'high'
            }
          }
        });
      }
      
      setEditingMemoryItem(null);
      setEditMemoryData({});
      
      console.log('✅ Memory item saved successfully');
      
    } catch (error) {
      console.error('❌ Error saving memory item:', error);
    }
  }, [onUpdateMemoryItem, editingMemoryItem, editMemoryData]);

  const updateMemoryField = useCallback((field, value) => {
    console.log(`📝 Updating memory field ${field} to:`, value);
    setEditMemoryData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const cancelEditingMemoryItem = useCallback(() => {
    console.log('❌ Cancelling memory item edit');
    setEditingMemoryItem(null);
    setEditMemoryData({});
  }, []);

  const deleteMemoryItem = useCallback((categoryName, item) => {
    const itemName = item.key || item.memoryKey || item.label || 'this memory';
    
    if (window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
      console.log(`🗑️ Deleting memory item: ${item.id} from ${categoryName}`);
      
      if (onDeleteMemoryItem) {
        // Send smart action format
        onDeleteMemoryItem({
          type: 'smart_delete',
          intent: `deleting memory item from ${categoryName}`,
          data: {
            target: categoryName,
            operation: 'delete_memory_item',
            values: [],
            metadata: {
              itemId: item.id,
              categoryName: categoryName,
              confidence: 'high'
            }
          }
        });
      }
    }
  }, [onDeleteMemoryItem]);

  const deleteMemory = useCallback((categoryName) => {
    if (window.confirm(`Are you sure you want to delete the entire memory category "${categoryName}"? This will remove all memories in this category.`)) {
      console.log(`🗑️ Deleting entire memory category: ${categoryName}`);
      
      if (onDeleteMemory) {
        // Send smart action format
        onDeleteMemory({
          type: 'smart_delete',
          intent: `deleting entire memory category ${categoryName}`,
          data: {
            target: categoryName,
            operation: 'delete_memory',
            values: [],
            metadata: {
              confidence: 'high'
            }
          }
        });
      }
    }
  }, [onDeleteMemory]);

  // ===== RENDER FUNCTIONS =====
  const renderChatContent = () => {
    console.log('🔍 Rendering chat content, messages:', messages?.length);
    
    if (!messages || messages.length === 0) {
      return (
        <div className="empty-state">
          <h3>👋 Start a conversation</h3>
          <p>Record your voice and I'll help you manage your tasks!</p>
          <div className="empty-state-hint">
            <small>💡 Try saying: 'Hello, how are you?' or 'Create a shopping list'</small>
          </div>
        </div>
      );
    }

    return (
      <div className="chat-content">
        <CollapsibleSection
          title="💬 Conversation"
          count={messages.length}
          subtitle="Recent messages"
          defaultExpanded={true}
        >
          <div className="messages-container">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.type}`}>
                <div className="message-sender">
                  {msg.type === "user" ? "👤 (You)" : "🤖 AI (Assistant)"}
                </div>
                <div className="message-text">{msg.text}</div>
                <div className="message-time">
                  {msg.timestamp ? formatDate(msg.timestamp) : ''}
                </div>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="message-actions">
                    <small>✅ {msg.actions.length} actions completed</small>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>
    );
  };

  const renderListsContent = () => {
    console.log('🔍 Rendering lists content, userLists:', userLists);
    
    const hasLists = userLists && Object.keys(userLists).length > 0;
    
    return (
      <div className="lists-content">
        {!hasLists ? (
          <div className="empty-state">
            <h3>📝 No lists yet</h3>
            <p>Create your first list by saying "Create a shopping list"</p>
          </div>
        ) : (
          <>
            <h3 className="content-title">📝 Your Lists</h3>
            {Object.entries(userLists).map(([listKey, list]) => {
              const resolvedListName = list.name || listKey;
              const resolvedListId = Number.isFinite(Number(list.id)) ? Number(list.id) : null;
              
              return (
              <CollapsibleSection
                key={listKey}
                title={`📝 ${resolvedListName}`}
                count={list.items?.length || 0}
                subtitle={`Created ${formatDate(list.created)}`}
                defaultExpanded={true}
                showDeleteButton={true}
                onDelete={() => deleteList(resolvedListName, resolvedListId)}
              >
                {!list.items || list.items.length === 0 ? (
                  <div className="empty-list-message">
                    No items yet. Add items by saying "Add milk to {resolvedListName}"
                  </div>
                ) : (
                  <div className="list-items">
                    {list.items.map((item, index) => {
                      const isEditing = editingItem?.listName === resolvedListName && editingItem?.itemId === item.id;
                      
                      return (
                        <div key={item.id || index} className={`list-item interactive ${item.completed ? 'completed' : ''}`}>
                          <div className="list-item-main" onClick={() => toggleItemCompletion(resolvedListName, item, resolvedListId)}>
                            <span className="list-item-icon">
                              {item.completed ? '✅' : '⭕'}
                            </span>
                            
                            {isEditing ? (
                              <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEdit(resolvedListName, item, resolvedListId);
                                  } else if (e.key === 'Escape') {
                                    cancelEdit();
                                  }
                                }}
                                onBlur={() => saveEdit(resolvedListName, item, resolvedListId)}
                                autoFocus
                                className="edit-input"
                              />
                            ) : (
                              <span className="list-item-text">
                                {typeof item === 'string' ? item : item.text || item.name || 'Untitled Item'}
                              </span>
                            )}
                          </div>
                          
                          <div className="list-item-actions">
                            {isEditing ? (
                              <>
                                <button onClick={() => saveEdit(resolvedListName, item, resolvedListId)} className="save-btn">✅</button>
                                <button onClick={cancelEdit} className="cancel-btn">❌</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditing(resolvedListName, item)} className="edit-btn">✏️</button>
                                <button onClick={() => deleteItem(resolvedListName, item, resolvedListId)} className="delete-btn">🗑️</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CollapsibleSection>
            );
            })}
          </>
        )}
      </div>
    );
  };

  const renderSchedulesContent = () => {
    console.log('🔍 Rendering schedules content, userSchedules:', userSchedules);
    
    const hasSchedules = userSchedules && Object.keys(userSchedules).length > 0;
    
    return (
      <div className="schedules-content">
        {!hasSchedules ? (
          <div className="empty-state">
            <h3>📅 No schedules yet</h3>
            <p>Create your first schedule by saying "I have a meeting tomorrow"</p>
          </div>
        ) : (
          <>
            <h3 className="content-title">📅 Your Schedules</h3>
            {Object.entries(userSchedules).map(([scheduleId, schedule]) => (
              <CollapsibleSection
                key={scheduleId}
                title={`📅 ${schedule.name || scheduleId}`}
                count={schedule.events?.length || 0}
                subtitle={`Created ${formatDate(schedule.created)}`}
                defaultExpanded={true}
                showDeleteButton={true}
                onDelete={() => deleteSchedule(schedule.name || scheduleId)}
              >
                {!schedule.events || schedule.events.length === 0 ? (
                  <div className="empty-schedule-message">
                    No events scheduled. Add events by saying "I have a meeting tomorrow at 3 PM"
                  </div>
                ) : (
                  <div className="schedule-items">
                    {schedule.events.map((event, index) => {
                      const isEditingThisEvent = editingEvent?.scheduleName === (schedule.name || scheduleId) && editingEvent?.eventId === event.id;
                      
                      return (
                        <div key={event.id || index} className="schedule-item">
                          {isEditingThisEvent ? (
                            <div className="event-edit-form">
                              <input
                                type="text"
                                value={editEventData.title || ''}
                                onChange={(e) => updateEventField('title', e.target.value)}
                                placeholder="Event title"
                                className="edit-input"
                              />
                              <input
                                type="text"
                                value={editEventData.time || ''}
                                onChange={(e) => updateEventField('time', e.target.value)}
                                placeholder="Event time"
                                className="edit-input"
                              />
                              <input
                                type="text"
                                value={editEventData.location || ''}
                                onChange={(e) => updateEventField('location', e.target.value)}
                                placeholder="Location (optional)"
                                className="edit-input"
                              />
                              <textarea
                                value={editEventData.description || ''}
                                onChange={(e) => updateEventField('description', e.target.value)}
                                placeholder="Description (optional)"
                                className="edit-textarea"
                                rows="2"
                              />
                              <div className="schedule-item-actions">
                                <button 
                                  onClick={saveEditingEvent} 
                                  className="save-btn"
                                  title="Save changes"
                                >
                                  ✅
                                </button>
                                <button 
                                  onClick={cancelEditingEvent} 
                                  className="cancel-btn"
                                  title="Cancel editing"
                                >
                                  ❌
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="schedule-item-content">
                                <div className="schedule-item-title">
                                  {getEventTitle(event)}
                                </div>
                                <div className="schedule-item-time">
                                  📅 {getEventTime(event)}
                                </div>
                                
                                {event.location && (
                                  <div className="schedule-item-location">
                                    📍 {event.location}
                                  </div>
                                )}
                                
                                {getEventDescription(event) && (
                                  <div className="schedule-item-description">
                                    {getEventDescription(event)}
                                  </div>
                                )}
                              </div>
                              
                              <div className="schedule-item-actions">
                                <button 
                                  onClick={() => startEditingEvent(schedule.name || scheduleId, event)} 
                                  className="edit-btn"
                                  title="Edit event"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => deleteEvent(schedule.name || scheduleId, event)} 
                                  className="delete-btn"
                                  title="Delete event"
                                >
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CollapsibleSection>
            ))}
          </>
        )}
      </div>
    );
  };

  const renderMemoryContent = () => {
    console.log('🔍 Rendering memory content, userMemory:', userMemory);
    
    const hasMemory = userMemory && Object.keys(userMemory).length > 0;
    
    return (
      <div className="memory-content">
        {!hasMemory ? (
          <div className="empty-state">
            <h3>🧠 No memories stored</h3>
            <p>Store information by saying "Remember that my birthday is June 15th"</p>
          </div>
        ) : (
          <>
            <h3 className="content-title">🧠 Your Memory</h3>
            {Object.entries(userMemory).map(([categoryId, category]) => (
              <CollapsibleSection
                key={categoryId}
                title={`🧠 ${category.name || categoryId}`}
                count={category.items?.length || 0}
                subtitle={`Created ${formatDate(category.created)}`}
                defaultExpanded={true}
                showDeleteButton={true}
                onDelete={() => deleteMemory(category.name || categoryId)}
              >
                {!category.items || category.items.length === 0 ? (
                  <div className="empty-memory-message">
                    No information stored. Add memories by saying "Remember that..."
                  </div>
                ) : (
                  <div className="memory-items">
                    {category.items.map((item, index) => {
                      const isEditingThisItem = editingMemoryItem?.categoryName === (category.name || categoryId) && editingMemoryItem?.itemId === item.id;
                      
                      return (
                        <div key={item.id || index} className="memory-item">
                          <div className="memory-item-icon">🧠</div>
                          
                          <div className="memory-item-content">
                            {isEditingThisItem ? (
                              <div className="memory-edit-form">
                                <input
                                  type="text"
                                  value={editMemoryData.key || ''}
                                  onChange={(e) => updateMemoryField('key', e.target.value)}
                                  placeholder="Memory key/label"
                                  className="edit-input"
                                />
                                <input
                                  type="text"
                                  value={editMemoryData.value || ''}
                                  onChange={(e) => updateMemoryField('value', e.target.value)}
                                  placeholder="Memory value/details"
                                  className="edit-input"
                                />
                              </div>
                            ) : (
                              <div className="memory-text">
                                <strong>{item.key || item.memoryKey || 'Memory'}:</strong> {item.value || item.memoryValue || 'No details'}
                              </div>
                            )}
                          </div>
                          
                          <div className="memory-item-actions">
                            {isEditingThisItem ? (
                              <>
                                <button 
                                  onClick={saveEditingMemoryItem} 
                                  className="save-btn"
                                  title="Save changes"
                                >
                                  ✅
                                </button>
                                <button 
                                  onClick={cancelEditingMemoryItem} 
                                  className="cancel-btn"
                                  title="Cancel editing"
                                >
                                  ❌
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => startEditingMemoryItem(category.name || categoryId, item)} 
                                  className="edit-btn"
                                  title="Edit this memory"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => deleteMemoryItem(category.name || categoryId, item)} 
                                  className="delete-btn"
                                  title="Delete this memory"
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CollapsibleSection>
            ))}
          </>
        )}
      </div>
    );
  };

  // ===== MAIN RENDER =====
  if (isDataLoading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner">⏳</div>
        <p>Loading your data...</p>
      </div>
    );
  }

  console.log(`🎨 Rendering ContentDisplay with mode: "${currentMode}"`);

  switch (currentMode) {
    case 'lists':
      return renderListsContent();
    case 'schedules':
    case 'schedule':
      return renderSchedulesContent();
    case 'memory':
      return renderMemoryContent();
    case 'chat':
      return renderChatContent();
    default:
      console.warn(`⚠️ Unknown mode: ${currentMode}, falling back to chat`);
      return renderChatContent();
  }
};

export default ContentDisplay;
