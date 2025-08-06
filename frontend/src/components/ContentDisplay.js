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
      
      // Check if start time is valid
      if (isNaN(start.getTime())) {
        console.warn('Invalid start time:', startTime);
        return 'Invalid start time';
      }
      
      // Format options for better readability
      const dateOptions = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      };
      const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      };
      
      // Handle case with no end time
      if (!endTime) {
        const startDate = start.toLocaleDateString('en-US', dateOptions);
        const startTimeStr = start.toLocaleTimeString('en-US', timeOptions);
        return `${startDate} at ${startTimeStr}`;
      }
      
      // Handle case with end time
      const end = new Date(endTime);
      if (isNaN(end.getTime())) {
        console.warn('Invalid end time:', endTime);
        // Just show start time if end time is invalid
        const startDate = start.toLocaleDateString('en-US', dateOptions);
        const startTimeStr = start.toLocaleTimeString('en-US', timeOptions);
        return `${startDate} at ${startTimeStr}`;
      }
      
      const startDate = start.toLocaleDateString('en-US', dateOptions);
      const endDate = end.toLocaleDateString('en-US', dateOptions);
      const startTimeStr = start.toLocaleTimeString('en-US', timeOptions);
      const endTimeStr = end.toLocaleTimeString('en-US', timeOptions);
      
      // Same day event
      if (startDate === endDate) {
        return `${startDate}: ${startTimeStr} → ${endTimeStr}`;
      }
      
      // Multi-day event - show both dates
      return `${startDate} at ${startTimeStr} → ${endDate} at ${endTimeStr}`;
      
    } catch (error) {
      console.error('Error formatting event time:', { startTime, endTime, error });
      return 'Invalid time format';
    }
  };

  const getEventStartTime = (event) => {
    return event.startTime || event.start_time;
  };
  
  const getEventEndTime = (event) => {
    return event.endTime || event.end_time;
  };
  
  const getEventTitle = (event) => {
    return event.title || event.event_title || 'Untitled Event';
  };
  
  const getEventDescription = (event) => {
    return event.description || event.event_description;
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

  const convertLocalDateTimeToISO = (localDateTime) => {
    if (!localDateTime) return null;
    
    try {
      // Parse the datetime-local value manually to preserve local time
      const [datePart, timePart] = localDateTime.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      
      // Create the ISO string preserving the user's intended local time
      const isoYear = year;
      const isoMonth = String(month).padStart(2, '0');
      const isoDay = String(day).padStart(2, '0');
      const isoHours = String(hours).padStart(2, '0');
      const isoMinutes = String(minutes).padStart(2, '0');
      
      return `${isoYear}-${isoMonth}-${isoDay}T${isoHours}:${isoMinutes}:00.000Z`;
      
    } catch (error) {
      console.error('Error converting local datetime to ISO:', localDateTime, error);
      return null;
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
      
      const editData = {
        title: getEventTitle(event),
        description: getEventDescription(event),
        startTime: formatDateTimeForInput(getEventStartTime(event)),
        endTime: formatDateTimeForInput(getEventEndTime(event)),
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
        console.log(`📝 Raw edit data:`, editEventData);
        
        // Prepare updates with proper timezone handling
        const updates = {};
        
        // Always include title if it exists
        if (editEventData.title !== undefined) {
          updates.title = editEventData.title.trim();
        }
        
        // Include description (allow empty string to clear it)
        if (editEventData.description !== undefined) {
          updates.description = editEventData.description.trim();
        }
        
        // FIXED: Handle start time with proper timezone conversion
        if (editEventData.startTime) {
          const startTimeISO = convertLocalDateTimeToISO(editEventData.startTime);
          if (startTimeISO) {
            updates.startTime = startTimeISO;
            console.log(`📅 Converted start time: ${editEventData.startTime} → ${startTimeISO}`);
          }
        }
        
        // FIXED: Handle end time with proper timezone conversion
        if (editEventData.endTime !== undefined) {
          if (editEventData.endTime.trim() === '') {
            updates.endTime = null; // Clear the end time
            console.log(`📅 Clearing end time`);
          } else {
            const endTimeISO = convertLocalDateTimeToISO(editEventData.endTime);
            if (endTimeISO) {
              updates.endTime = endTimeISO;
              console.log(`📅 Converted end time: ${editEventData.endTime} → ${endTimeISO}`);
            }
          }
        }
        
        // Include location (allow empty string to clear it)
        if (editEventData.location !== undefined) {
          updates.location = editEventData.location.trim();
        }
        
        console.log(`📝 Final prepared updates:`, updates);
        
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
                            // Edit mode with proper event handlers
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
                                <button onClick={saveEditedEvent} className="save-btn">
                                  💾 Save
                                </button>
                                <button onClick={cancelEditingEvent} className="cancel-btn">
                                  ❌ Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            // IMPROVED: View mode with better field handling
                            <>
                              <div className="schedule-item-main">
                                <div className="schedule-item-title">
                                  {getEventTitle(event)}
                                </div>
                                
                                {/* FIXED: Always show time if available, using improved formatting */}
                                <div className="schedule-item-time">
                                  📅 {formatEventTime(getEventStartTime(event), getEventEndTime(event))}
                                </div>
                                
                                {/* FIXED: Show location if it exists */}
                                {event.location && (
                                  <div className="schedule-item-location">
                                    📍 {event.location}
                                  </div>
                                )}
                                
                                {/* FIXED: Show description if it exists */}
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
                    {category.items.map((item, index) => {
                      // STEP 1: Determine what content to show
                      let displayContent;
                      let displayLabel;
                      
                      if (typeof item === 'string') {
                        // CASE 1: Simple string item
                        displayContent = item;
                        displayLabel = null;
                      } else if (item && typeof item === 'object') {
                        // CASE 2: Object with structured data
                        
                        // Extract the label (what this memory is about)
                        displayLabel = item.key || item.memoryKey || item.label || item.name;
                        
                        // Extract the content (the actual information)
                        displayContent = item.value || 
                                       item.memoryValue || 
                                       item.content || 
                                       item.text || 
                                       item.information ||
                                       item.data ||
                                       'Stored information';
                        
                        // If content is an object, stringify it nicely
                        if (typeof displayContent === 'object') {
                          displayContent = JSON.stringify(displayContent, null, 2);
                        }
                      } else {
                        // CASE 3: Fallback for unexpected data
                        displayContent = 'Stored information';
                        displayLabel = null;
                      }
                      
                      return (
                        <div key={index} className="memory-item">
                          <div className="memory-item-icon">💭</div>
                          <div className="memory-item-content">
                            {/* STEP 2: Show label if it exists and is different from content */}
                            {displayLabel && displayLabel !== displayContent && (
                              <div className="memory-item-label">
                                <strong>{displayLabel}:</strong>
                              </div>
                            )}
                            {/* STEP 3: Always show the actual content */}
                            <div className="memory-item-value">
                              {displayContent}
                            </div>
                            {/* STEP 4: Show metadata if available */}
                            {item && typeof item === 'object' && item.created && (
                              <div className="memory-item-meta">
                                Stored {formatDate(item.created)}
                              </div>
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
      return renderChatContent();
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