import React, { useState, useCallback, useRef } from 'react';
import CollapsibleSection from './CollapsibleSection';

const ContentDisplay = ({ 
  currentMode, 
  messages, 
  userLists, 
  userSchedules, 
  userMemory,
  isDataLoading, 
  onUpdateListItem, 
  onDeleteList,
  onEditEvent, 
  onDeleteEvent, 
  onDeleteSchedule   
}) => {

  // ===== STATE MANAGEMENT =====
  const [editingItem, setEditingItem] = useState(null);
  const [editText, setEditText] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [editEventData, setEditEventData] = useState({});

  const isEditingRef = useRef(false);

  // ===== UTILITY FUNCTIONS =====
  const formatDate = (dateInput) => {
    if (!dateInput) return 'recently';
    
    try {
      let date;
      
      if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else {
        return 'recently';
      }
      
      if (isNaN(date.getTime())) {
        return 'recently';
      }
      
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays <= 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      console.warn('Error formatting date:', dateInput, error);
      return 'recently';
    }
  };

  const formatEventTime = (startTime, endTime) => {
    if (!startTime) return 'No time set';
    
    try {
      const start = new Date(startTime);
      const end = endTime ? new Date(endTime) : null;
      
      if (isNaN(start.getTime())) return 'Invalid time';
      
      const dateStr = start.toLocaleDateString();
      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (end && !isNaN(end.getTime())) {
        const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} ${timeStr} - ${endTimeStr}`;
      }
      
      return `${dateStr} ${timeStr}`;
    } catch (error) {
      console.warn('Error formatting event time:', startTime, error);
      return 'Invalid time';
    }
  };

  const formatDateTimeForInput = (dateTime) => {
    if (!dateTime) return '';
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) return '';
      
      // Format for datetime-local input: YYYY-MM-DDTHH:mm
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.warn('Error formatting datetime for input:', dateTime, error);
      return '';
    }
  };


  // ===== LIST ITEM HANDLERS =====
  const handleItemUpdate = async (listName, item, operation, newText = null) => {
    if (!onUpdateListItem) {
      console.warn('onUpdateListItem prop not provided');
      return;
    }

    try {
      console.log(`🔄 ${operation} item in list "${listName}":`, item);
      
      const actionData = {
        type: 'update_list',
        data: {
          listName: listName,
          itemId: item.id,
          operation: operation
        }
      };

      if (newText) {
        actionData.data.newText = newText;
      }
      
      await onUpdateListItem(actionData);
      
      console.log(`✅ Successfully ${operation}d item`);
    } catch (error) {
      console.error(`❌ Error ${operation}ing item:`, error);
    }
  };

  const toggleItemCompletion = (listName, item) => {
    const operation = item.completed ? 'uncomplete' : 'complete';
    handleItemUpdate(listName, item, operation);
  };

  
  const deleteItem = (listName, item) => {
    if (window.confirm(`Are you sure you want to delete "${item.text || item.name}"?`)) {
      handleItemUpdate(listName, item, 'delete');
    }
  };

  const startEditing = (listName, item) => {
    setEditingItem({ listName, itemId: item.id });
    setEditText(item.text || item.name || '');
  };

  
  const saveEdit = async (listName, item) => {
    if (editText.trim() !== item.text) {
      await handleItemUpdate(listName, item, 'edit', editText.trim());
    }
    setEditingItem(null);
    setEditText('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingItem(null);
    setEditText('');
  };

  const deleteList = (listName) => {
    if (window.confirm(`Are you sure you want to delete the entire list "${listName}"? This will remove all items in the list.`)) {
      if (onDeleteList) {
        console.log(`🗑️ Deleting list: ${listName}`);
        onDeleteList({
          type: 'delete_list',
          data: { name: listName }
        });
      } else {
        console.warn('onDeleteList handler not provided');
      }
    }
  };


  //Schedule
  const deleteSchedule = (scheduleName) => {
    if (window.confirm(`Are you sure you want to delete the entire schedule "${scheduleName}"? This will remove all events in the schedule.`)) {
      if (onDeleteSchedule) {
        console.log(`🗑️ Deleting schedule: ${scheduleName}`);
        onDeleteSchedule({
          type: 'delete_schedule',
          data: { name: scheduleName }
        });
      } else {
        console.warn('onDeleteSchedule handler not provided');
      }
    }
  };

    // NEW: Delete individual event
    const deleteEvent = (scheduleName, event) => {
      const eventTitle = event.title || event.event_title || 'this event';
      if (window.confirm(`Are you sure you want to delete "${eventTitle}"?`)) {
        if (onDeleteEvent) {
          console.log(`🗑️ Deleting event: ${event.id} from ${scheduleName}`);
          onDeleteEvent({
            type: 'delete_event',
            data: { 
              scheduleName: scheduleName,
              eventId: event.id 
            }
          });
        } else {
          console.warn('onDeleteEvent handler not provided');
        }
      }
    };
  
    // NEW: Start editing an event
    const startEditingEvent = useCallback((scheduleName, event) => {
      console.log('📝 Starting to edit event:', event);
      
      // Set the editing state
      isEditingRef.current = true;
      setEditingEvent({ scheduleName, eventId: event.id });
      
      // Prepare the edit data with all current event properties
      const editData = {
        title: event.title || event.event_title || '',
        description: event.description || event.event_description || '',
        startTime: formatDateTimeForInput(event.startTime || event.start_time),
        endTime: formatDateTimeForInput(event.endTime || event.end_time),
        location: event.location || ''
      };
      
      console.log('📝 Edit data prepared:', editData);
      setEditEventData(editData);
    }, []);
  
    //
    const saveEditedEvent = useCallback(async () => {
      if (!onEditEvent || !editingEvent) {
        console.warn('onEditEvent handler not provided or no event being edited');
        return;
      }
  
      try {
        console.log(`📝 Saving edited event: ${editingEvent.eventId}`);
        console.log(`📝 Event updates:`, editEventData);
        
        // Prepare updates - only include fields that have values
        const updates = {};
        
        if (editEventData.title.trim()) {
          updates.title = editEventData.title.trim();
        }
        
        if (editEventData.description.trim()) {
          updates.description = editEventData.description.trim();
        }
        
        if (editEventData.startTime) {
          updates.startTime = new Date(editEventData.startTime).toISOString();
        }
        
        if (editEventData.endTime) {
          updates.endTime = new Date(editEventData.endTime).toISOString();
        }
        
        if (editEventData.location.trim()) {
          updates.location = editEventData.location.trim();
        }
        
        console.log(`📝 Prepared updates:`, updates);
        
        // Call the edit handler
        await onEditEvent({
          type: 'edit_event',
          data: {
            scheduleName: editingEvent.scheduleName,
            eventId: editingEvent.eventId,
            updates: updates
          }
        });
        
        // Reset editing state
        setEditingEvent(null);
        setEditEventData({});
        isEditingRef.current = false;
        
        console.log('✅ Event saved successfully');
        
      } catch (error) {
        console.error('❌ Error saving event:', error);
        // Don't reset the editing state if there's an error, so user can try again
      }
    }, [onEditEvent, editingEvent, editEventData]);

    const updateEventField = useCallback((field, value) => {
      console.log(`📝 Updating field ${field} to:`, value);
      setEditEventData(prev => ({
        ...prev,
        [field]: value
      }));
    }, []);
  
    const cancelEditingEvent = useCallback(() => {
      console.log('❌ Cancelling event edit');
      setEditingEvent(null);
      setEditEventData({});
      isEditingRef.current = false;
    }, []);

  

  // Empty state component - no need for separate file
  const EmptyState = ({ mode }) => {
    const emptyMessages = {
      chat: {
        title: "👋 नमस्ते! Start a conversation",
        subtitle: "Record your voice and I'll help you manage your tasks!",
        hint: "Try saying: 'Hello, how are you?' or 'Create a shopping list'"
      },
      lists: {
        title: "📝 No lists created yet",
        subtitle: "Create your first list by speaking!",
        hint: "Try saying: 'Create a shopping list' or 'Make a todo list'"
      },
      schedule: {
        title: "📅 No events scheduled",
        subtitle: "Add your first appointment!",
        hint: "Try saying: 'I have a meeting tomorrow at 3 PM'"
      },
      memory: {
        title: "🧠 Memory bank is empty",
        subtitle: "Store important information!",
        hint: "Try saying: 'Remember that John's phone is 555-1234'"
      }
    };

    const msg = emptyMessages[mode] || emptyMessages.chat;
    
    return (
      <div className="empty-state">
        <h3>{msg.title}</h3>
        <p>{msg.subtitle}</p>
        <div className="empty-state-hint">
          <small>💡 {msg.hint}</small>
        </div>
      </div>
    );
  };

  // Chat display
  const renderChatContent = () => {
    if (!messages || messages.length === 0) {
      return <EmptyState mode="chat" />;
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
            {Object.entries(userLists).map(([listId, list]) => (
              <CollapsibleSection
                key={listId}
                title={`📝 ${list.name || listId}`}
                count={list.items?.length || 0}
                subtitle={`Created ${formatDate(list.created)}`}
                defaultExpanded={true}
                showDeleteButton={true}
                onDelete={() => deleteList(list.name || listId)}
              >
                {!list.items || list.items.length === 0 ? (
                  <div className="empty-list-message">
                    No items yet. Add items by saying "Add milk to {list.name || listId}"
                  </div>
                ) : (
                  <div className="list-items">
                    {list.items.map((item, index) => {
                      const isEditing = editingItem?.listName === (list.name || listId) && editingItem?.itemId === item.id;
                      
                      return (
                        <div key={item.id || index} className={`list-item interactive ${item.completed ? 'completed' : ''}`}>
                          <div className="list-item-main" onClick={() => toggleItemCompletion(list.name || listId, item)}>
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
                                    saveEdit(list.name || listId, item);
                                  } else if (e.key === 'Escape') {
                                    cancelEdit();
                                  }
                                }}
                                onBlur={() => saveEdit(list.name || listId, item)}
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
                                <button onClick={() => saveEdit(list.name || listId, item)} className="save-btn">✅</button>
                                <button onClick={cancelEdit} className="cancel-btn">❌</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditing(list.name || listId, item)} className="edit-btn">✏️</button>
                                <button onClick={() => deleteItem(list.name || listId, item)} className="delete-btn">🗑️</button>
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


  // Schedule display
  const renderSchedulesContent = () => {
    const hasSchedules = userSchedules && Object.keys(userSchedules).length > 0;
    
    return (
      <div className="schedules-content">
        {!hasSchedules ? (
          <div className="empty-state">
            <h3>📅 No schedules yet</h3>
            <p>Create your first schedule by saying "I have a meeting tomorrow at 3 PM"</p>
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
                            // FIXED: Edit mode with proper event handlers
                            <div className="edit-event-form">
                              <input
                                type="text"
                                placeholder="Event title"
                                value={editEventData.title || ''}
                                onChange={(e) => updateEventField('title', e.target.value)}
                                className="edit-event-title"
                              />
                              
                              <label>Start Time:</label>
                              <input
                                type="datetime-local"
                                value={editEventData.startTime || ''}
                                onChange={(e) => updateEventField('startTime', e.target.value)}
                                className="edit-event-time"
                              />
                              
                              <label>End Time (optional):</label>
                              <input
                                type="datetime-local"
                                value={editEventData.endTime || ''}
                                onChange={(e) => updateEventField('endTime', e.target.value)}
                                className="edit-event-time"
                              />
                              
                              <input
                                type="text"
                                placeholder="Location (optional)"
                                value={editEventData.location || ''}
                                onChange={(e) => updateEventField('location', e.target.value)}
                                className="edit-event-location"
                              />
                              
                              <textarea
                                placeholder="Description (optional)"
                                value={editEventData.description || ''}
                                onChange={(e) => updateEventField('description', e.target.value)}
                                className="edit-event-description"
                                rows="3"
                              />
                              
                              <div className="edit-event-actions">
                                <button onClick={saveEditedEvent} className="save-btn">✅ Save</button>
                                <button onClick={cancelEditingEvent} className="cancel-btn">❌ Cancel</button>
                              </div>
                            </div>
                          ) : (
                            // Display mode for events
                            <>
                              <div className="schedule-item-main">
                                <div className="schedule-item-title">
                                  {event.title || event.event_title || 'Untitled Event'}
                                </div>
                                
                                <div className="schedule-item-time">
                                  📅 {formatEventTime(event.startTime || event.start_time, event.endTime || event.end_time)}
                                </div>
                                
                                {(event.location) && (
                                  <div className="schedule-item-location">
                                    📍 {event.location}
                                  </div>
                                )}
                                
                                {(event.description || event.event_description) && (
                                  <div className="schedule-item-description">
                                    {event.description || event.event_description}
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

  // Memory display
  const renderMemoryContent = () => {
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
              >
                {!category.items || category.items.length === 0 ? (
                  <div className="empty-memory-message">
                    No information stored.
                  </div>
                ) : (
                  <div className="memory-items">
                    {category.items.map((item, index) => (
                      <div key={index} className="memory-item">
                        {typeof item === 'string' ? item : item.text || item.information || 'Stored information'}
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            ))}
          </>
        )}
      </div>
    );
  };

  // Main render method
  if (isDataLoading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner">⏳</div>
        <p>Loading your data...</p>
      </div>
    );
  }

  switch (currentMode) {
    case 'lists':
      return renderListsContent();
    case 'schedule':
      return renderSchedulesContent();
    case 'memory':
      return renderMemoryContent();
    case 'chat':
    default:
      return (
        <div className="chat-content">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h3>💬 Start a conversation</h3>
              <p>Ask me to create lists, schedule events, or store memories!</p>
            </div>
          ) : (
            <div className="messages-display">
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.type}-message`}>
                  <strong>{message.type === 'user' ? 'You' : 'AI'}:</strong>
                  <span>{message.text}</span>
                  <small>{formatDate(message.timestamp)}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      );
  }
};

export default ContentDisplay;