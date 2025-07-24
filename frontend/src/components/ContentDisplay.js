import React, { useState } from 'react';

const ContentDisplay = ({ 
  currentMode, 
  messages, 
  userLists, 
  userSchedules, 
  userMemory,
  isDataLoading, 
  onUpdateListItem
}) => {

  const [editingItem, setEditingItem] = useState(null);
  const [editText, setEditText] = useState('');

  // Helper function to safely format dates
  const formatDate = (dateInput) => {
    if (!dateInput) return 'recently';
    
    try {
      if (dateInput instanceof Date) {
        return dateInput.toLocaleDateString();
      }
      
      if (typeof dateInput === 'string') {
        const date = new Date(dateInput);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      }
      
      return 'recently';
    } catch (error) {
      console.warn('Error formatting date:', dateInput, error);
      return 'recently';
    }
  };
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


  
  // Toggle completion status
  const toggleItemCompletion = (listName, item) => {
    const operation = item.completed ? 'uncomplete' : 'complete';
    handleItemUpdate(listName, item, operation);
  };

  // Delete an item
  const deleteItem = (listName, item) => {
    if (window.confirm(`Are you sure you want to delete "${item.text || item.name}"?`)) {
      handleItemUpdate(listName, item, 'delete');
    }
  };

  const startEditing = (listName, item) => {
    setEditingItem({ listName, itemId: item.id });
    setEditText(item.text || item.name || '');
  };

  // Save edited item
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

  // Simple collapsible section component - no need for separate file
  const CollapsibleSection = ({ title, count, subtitle, children, defaultExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
      <div className="collapsible-section">
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className={`collapsible-header ${isExpanded ? 'expanded' : 'collapsed'}`}
        >
          <div className="collapsible-header-content">
            <h4>{title}</h4>
            <div className="collapsible-header-meta">
              {count !== undefined && `${count} items`}
              {subtitle && ` • ${subtitle}`}
            </div>
          </div>
          <div className={`collapsible-arrow ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </div>
        </div>
        
        {isExpanded && (
          <div className="collapsible-content">
            {children}
          </div>
        )}
      </div>
    );
  };

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
                  {msg.type === "user" ? "👤 आप (You)" : "🤖 AI सहायक (Assistant)"}
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
          <EmptyState mode="lists" />
        ) : (
          <>
            <h3 className="content-title">📝 Your Lists</h3>
            {Object.entries(userLists).map(([listId, list]) => (
              <CollapsibleSection
                key={listId}
                title={`📝 ${list.name || list.title || listId}`}
                count={list.items?.length || 0}
                subtitle={`Created ${formatDate(list.created)}`}
                defaultExpanded={true}
              >
                {!list.items || list.items.length === 0 ? (
                  <div className="empty-list-message">
                    This list is empty. Add items by saying "Add [item] to {list.name}"
                  </div>
                ) : (
                  <div className="list-items">
                    {list.items.map((item, index) => {
                      // Ensure item has an ID for operations
                      const itemWithId = {
                        id: item.id || `${listId}-${index}`,
                        text: typeof item === 'string' ? item : item.text || item.name || JSON.stringify(item),
                        completed: item.completed || false,
                        ...item
                      };

                      const isEditing = editingItem && 
                                      editingItem.listName === listId && 
                                      editingItem.itemId === itemWithId.id;

                      return (
                        <div 
                          key={itemWithId.id} 
                          className={`list-item ${itemWithId.completed ? 'completed' : 'pending'} interactive`}
                        >
                          {/* Main clickable area to toggle completion */}
                          <div 
                            className="list-item-main"
                            onClick={() => !isEditing && toggleItemCompletion(listId, itemWithId)}
                            title={itemWithId.completed ? 'Click to mark as incomplete' : 'Click to mark as complete'}
                          >
                            <span className="list-item-icon">
                              {itemWithId.completed ? '✅' : '⭕'}
                            </span>
                            
                            {/* Editable text area */}
                            {isEditing ? (
                              <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEdit(listId, itemWithId);
                                  } else if (e.key === 'Escape') {
                                    cancelEdit();
                                  }
                                }}
                                onBlur={() => saveEdit(listId, itemWithId)}
                                className="edit-input"
                                autoFocus
                              />
                            ) : (
                              <span className={`list-item-text ${itemWithId.completed ? 'completed' : ''}`}>
                                {itemWithId.text}
                              </span>
                            )}
                          </div>
                          
                          {/* Action buttons */}
                          <div className="list-item-actions">
                            {!isEditing && (
                              <>
                                <button
                                  className="edit-item-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(listId, itemWithId);
                                  }}
                                  title="Edit this item"
                                >
                                  ✏️
                                </button>
                                
                                {itemWithId.completed && (
                                  <button
                                    className="delete-item-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteItem(listId, itemWithId);
                                    }}
                                    title="Delete this item"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </>
                            )}
                            
                            {isEditing && (
                              <>
                                <button
                                  className="save-item-btn"
                                  onClick={() => saveEdit(listId, itemWithId)}
                                  title="Save changes"
                                >
                                  ✅
                                </button>
                                <button
                                  className="cancel-item-btn"
                                  onClick={cancelEdit}
                                  title="Cancel editing"
                                >
                                  ❌
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


  // Schedule display
  const renderScheduleContent = () => {
    const hasSchedules = userSchedules && Object.keys(userSchedules).length > 0;
    
    return (
      <div className="schedule-content">
        {!hasSchedules ? (
          <EmptyState mode="schedule" />
        ) : (
          <>
            <h3 className="content-title">📅 Your Schedule</h3>
            {Object.entries(userSchedules).map(([scheduleId, schedule]) => (
              <CollapsibleSection
                key={scheduleId}
                title={`📅 ${schedule.name || scheduleId}`}
                count={schedule.events?.length || 0}
                subtitle={`Created ${formatDate(schedule.created)}`}
                defaultExpanded={true}
              >
                {!schedule.events || schedule.events.length === 0 ? (
                  <div className="empty-schedule-message">
                    No events scheduled. Add events by saying "I have a meeting tomorrow at 3 PM"
                  </div>
                ) : (
                  <div className="schedule-items">
                    {schedule.events.map((event, index) => (
                      <div key={index} className="schedule-item">
                        <div className="schedule-item-title">
                          {typeof event === 'string' ? event : event.title || event.name || 'Untitled Event'}
                        </div>
                        {event.time && (
                          <div className="schedule-item-time">
                            📅 {typeof event.time === 'string' ? event.time : formatDate(event.time)}
                          </div>
                        )}
                        {event.description && (
                          <div className="schedule-item-description">
                            {event.description}
                          </div>
                        )}
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

  // Memory display
  const renderMemoryContent = () => {
    const hasMemory = userMemory && Object.keys(userMemory).length > 0;
    
    return (
      <div className="memory-content">
        {!hasMemory ? (
          <EmptyState mode="memory" />
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
                    No information stored. Add items by saying "Remember that..."
                  </div>
                ) : (
                  <div className="memory-items">
                    {category.items.map((item, index) => (
                      <div key={index} className="memory-item">
                        <span className="memory-item-icon">💭</span>
                        <span className="memory-item-content">
                          {typeof item === 'string' ? item : item.content || item.info || JSON.stringify(item)}
                        </span>
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
  const renderContent = () => {
    if (isDataLoading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner">⏳</div>
          <p>Loading your data...</p>
        </div>
      );
    }

    switch(currentMode) {
      case 'chat':
        return renderChatContent();
      case 'lists':
        return renderListsContent();
      case 'schedule':
        return renderScheduleContent();
      case 'memory':
        return renderMemoryContent();
      default:
        return renderChatContent();
    }
  };

  return (
    <div className="content-container">
      {renderContent()}
    </div>
  );
};

export default ContentDisplay;