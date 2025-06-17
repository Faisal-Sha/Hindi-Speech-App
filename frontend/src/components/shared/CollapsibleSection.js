import React, { useState } from 'react';
import './CollapsibleSection.css';

const CollapsibleSection = ({ 
  id, 
  title, 
  count, 
  subtitle, 
  children, 
  defaultExpanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible-section">
      {/* Header - Always visible */}
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
      
      {/* Content - Expandable */}
      {isExpanded && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
