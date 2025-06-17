import React from 'react';
import EmptyState from '../shared/EmptyState';
import CollapsibleSection from '../shared/CollapsibleSection';
import './MemorySection.css';

const MemorySection = ({ userMemory }) => {
  if (!userMemory || Object.keys(userMemory).length === 0) {
    return <EmptyState mode="memory" />;
  }

  return (
    <div className="memory-section">
      <h3 className="memory-section-title">🧠 Memory Bank</h3>
      
      {Object.entries(userMemory).map(([categoryId, category]) => (
        <CollapsibleSection
          key={categoryId}
          title={`🧠 ${category.title}`}
          count={category.items.length}
          subtitle={`Updated ${category.lastUpdated?.toLocaleDateString()}`}
          defaultExpanded={category.items.length > 0}
        >
          {category.items.length === 0 ? (
            <div className="empty-memory-message">
              No information stored. Add items by saying "Remember that..."
            </div>
          ) : (
            category.items.map((item) => (
              <div key={item.id} className="memory-item">
                <div className="memory-item-content">
                  <span className="memory-item-icon">💭</span>
                  {item.content || item.name || JSON.stringify(item)}
                </div>
                <div className="memory-item-meta">
                  <span>Added: {item.addedAt?.toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default MemorySection;
