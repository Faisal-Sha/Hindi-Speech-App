import React from 'react';
import EmptyState from '../shared/EmptyState';
import CollapsibleSection from '../shared/CollapsibleSection';
import './ListsSection.css';

const ListsSection = ({ userLists }) => {
  if (!userLists || Object.keys(userLists).length === 0) {
    return <EmptyState mode="lists" />;
  }

  return (
    <div className="lists-section">
      <h3 className="lists-section-title">📝 Your Lists</h3>
      
      {Object.entries(userLists).map(([listId, list]) => (
        <CollapsibleSection
          key={listId}
          title={`📝 ${list.title}`}
          count={list.items.length}
          subtitle={`Created ${list.createdAt?.toLocaleDateString()}`}
          defaultExpanded={list.items.length > 0}
        >
          {list.items.length === 0 ? (
            <div className="empty-list-message">
              This list is empty. Add items by saying "Add [item] to {list.title}"
            </div>
          ) : (
            list.items.map((item) => (
              <div key={item.id} className={`list-item ${item.completed ? 'completed' : 'pending'}`}>
                <div className="list-item-content">
                  <div className={`list-item-text ${item.completed ? 'completed' : ''}`}>
                    <span className="list-item-icon">
                      {item.completed ? '✅' : '⭕'}
                    </span>
                    {item.text}
                  </div>
                  <div className="list-item-meta">
                    Added: {item.addedAt?.toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default ListsSection;