import React from 'react';
import ChatSection from './sections/ChatSection';
import ListsSection from './sections/ListsSection';
import ScheduleSection from './sections/ScheduleSection';
import MemorySection from './sections/MemorySection';

const ContentArea = ({ 
  currentMode, 
  messages, 
  userLists, 
  userSchedules, 
  userMemory, 
  userChats 
}) => {
  const renderCurrentMode = () => {
    switch(currentMode) {
      case 'chat':
        return <ChatSection messages={messages} userChats={userChats} />;
      case 'lists':
        return <ListsSection userLists={userLists} />;
      case 'schedule':
        return <ScheduleSection userSchedules={userSchedules} />;
      case 'memory':
        return <MemorySection userMemory={userMemory} />;
      default:
        return <ChatSection messages={messages} userChats={userChats} />;
    }
  };

  return (
    <div className="message-container">
      {renderCurrentMode()}
    </div>
  );
};

export default ContentArea;