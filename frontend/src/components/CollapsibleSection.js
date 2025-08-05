import React, { useState } from 'react';

const CollapsibleSection = ({ 
  title, 
  count, 
  subtitle, 
  children, 
  defaultExpanded = false,
  showDeleteButton = false,
  onDelete = null,
  deleteConfirmText = "Are you sure you want to delete this?"
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible-section">
      <div 
        className={`collapsible-header ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="collapsible-header-content"
        >
          <h4>{title}</h4>
          <div className="collapsible-header-meta">
            <span className="count-badge">{count} {count === 1 ? 'item' : 'items'}</span>
            <span className="date-text"> {subtitle}</span>
            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>
        
        {/* Delete button for entire list/schedule */}
        {showDeleteButton && onDelete && (
          <button 
            className="delete-section-btn"
            onClick={(e) => {
              e.stopPropagation(); // Prevent collapsing when clicking delete
              onDelete();
            }}
            title="Delete entire list/schedule"
          >
            🗑️
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;