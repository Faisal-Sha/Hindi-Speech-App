/**
 * Smart Date Parser - Converts natural language to actual dates
 */
class SmartDateParser {
    parseToActualDate(naturalDate) {
      const today = new Date();
      const dayMap = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6, 'sunday': 0
      };
      
      const natural = naturalDate.toLowerCase();
      
      if (natural === 'today') {
        return this.formatDate(today);
      }
      
      if (natural === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return this.formatDate(tomorrow);
      }
      
      // Handle day names
      for (const [dayName, dayNum] of Object.entries(dayMap)) {
        if (natural.includes(dayName)) {
          const targetDate = this.getNextWeekday(today, dayNum);
          return this.formatDate(targetDate);
        }
      }
      
      // Return original if we can't parse
      return naturalDate;
    }
    
    getNextWeekday(fromDate, targetDayNum) {
      const result = new Date(fromDate);
      const currentDay = fromDate.getDay();
      const daysUntilTarget = (targetDayNum - currentDay + 7) % 7;
      
      if (daysUntilTarget === 0) {
        result.setDate(fromDate.getDate() + 7); // Next week if same day
      } else {
        result.setDate(fromDate.getDate() + daysUntilTarget);
      }
      
      return result;
    }
    
    formatDate(date) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
}
  