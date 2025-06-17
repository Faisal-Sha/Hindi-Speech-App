import { useState } from 'react';

const useExpandedSections = () => {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionId) => {
    console.log(`🔄 Toggling section: ${sectionId}`);
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const expandSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: true
    }));
  };

  const collapseSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: false
    }));
  };

  const isExpanded = (sectionId) => {
    return expandedSections[sectionId] || false;
  };

  return {
    expandedSections,
    toggleSection,
    expandSection,
    collapseSection,
    isExpanded
  };
};

export default useExpandedSections;