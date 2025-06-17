import React from 'react';
import EmptyState from '../shared/EmptyState';
import CollapsibleSection from '../shared/CollapsibleSection';
import './ScheduleSection.css';

const ScheduleSection = ({ userSchedules }) => {
  if (!userSchedules || Object.keys(userSchedules).length === 0) {
    return <EmptyState mode="schedule" />;
  }

  return (
    <div className="schedule-section">
      <h3 className="schedule-section-title">📅 Your Schedules</h3>
      
      {Object.entries(userSchedules).map(([scheduleId, schedule]) => (
        <CollapsibleSection
          key={scheduleId}
          title={`📅 ${schedule.title}`}
          count={schedule.events.length}
          subtitle={`Created ${schedule.createdAt?.toLocaleDateString()}`}
          defaultExpanded={schedule.events.length > 0}
        >
          {schedule.events.length === 0 ? (
            <div className="empty-schedule-message">
              No events scheduled. Add events by saying "Schedule [event] at [time]"
            </div>
          ) : (
            schedule.events.map((event) => (
              <div key={event.id} className="schedule-event">
                <div className="schedule-event-title">
                  <span className="schedule-event-icon">📌</span>
                  {event.title}
                </div>
                <div className="schedule-event-time">
                  <span>🕐</span>
                  {event.time}
                  <span>•</span>
                  <span>⏱️</span>
                  {event.duration}
                </div>
                <div className="schedule-event-location">
                  <span>📍</span>
                  {event.location}
                </div>
              </div>
            ))
          )}
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default ScheduleSection;