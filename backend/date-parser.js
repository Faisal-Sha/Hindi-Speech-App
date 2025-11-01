/**
 * Smart Date Parser - Converts natural language to actual dates
 * Supports a few common multilingual phrases and falls back safely.
 */
class SmartDateParser {
  constructor() {
    // Common relative keywords (diacritics will be stripped before matching)
    this.relativeKeywords = {
      today: ['today', 'hoy', 'aujourdhui', 'oggi', 'heute', 'आज', 'aaj'],
      tomorrow: ['tomorrow', 'manana', 'mañana', 'morgen', 'कल', 'kal'],
      dayAfterTomorrow: ['day after tomorrow', 'pasado manana', 'pasadomanana', 'uber morgen', 'uber-morgen', 'übermorgen', 'परसों', 'parso', 'parson']
    };

    // Weekday keywords across a few languages (diacritics removed before matching)
    this.weekdayKeywords = [
      { day: 0, keywords: ['sunday', 'domingo', 'dom', 'dimanche', 'sonntag', 'रविवार', 'ravivar'] },
      { day: 1, keywords: ['monday', 'lunes', 'lun', 'lundi', 'montag', 'सोमवार', 'somvar'] },
      { day: 2, keywords: ['tuesday', 'martes', 'mar', 'mardi', 'dienstag', 'मंगलवार', 'mangalwar'] },
      { day: 3, keywords: ['wednesday', 'miercoles', 'miércoles', 'mercredi', 'mittwoch', 'बुधवार', 'budhwar'] },
      { day: 4, keywords: ['thursday', 'jueves', 'jue', 'jeudi', 'donnerstag', 'गुरुवार', 'guruwar', 'guruvaar'] },
      { day: 5, keywords: ['friday', 'viernes', 'vie', 'vendredi', 'freitag', 'शुक्रवार', 'shukrawar'] },
      { day: 6, keywords: ['saturday', 'sabado', 'sábado', 'sab', 'samedi', 'samstag', 'शनिवार', 'shanivar'] }
    ];
  }

  /**
   * Parse a natural date string and return an ISO timestamp string.
   * Returns null if parsing fails and no fallback is available.
   */
  parseToActualDate(naturalDate, options = {}) {
    if (!naturalDate) {
      return this.ensureIso(options.fallbackDate);
    }

    const fallbackDate = this.ensureDate(options.fallbackDate);
    const referenceDate = this.ensureDate(options.referenceDate) || new Date();

    // 1. Handle Date instances or ISO strings directly
    const direct = this.ensureDate(naturalDate);
    if (direct) {
      return direct.toISOString();
    }

    const normalized = this.normalizeText(naturalDate);
    if (!normalized) {
      return fallbackDate ? fallbackDate.toISOString() : null;
    }

    // 2. Relative keywords like today/tomorrow
    const matchedRelative = this.matchRelativeKeyword(normalized);
    if (matchedRelative) {
      const target = this.applyRelativeOffset(referenceDate, matchedRelative);
      return this.applyFallbackTime(target, fallbackDate, normalized).toISOString();
    }

    // 3. "in X days" style phrases
    const daysOffset = this.extractDaysOffset(normalized);
    if (daysOffset !== null) {
      const target = new Date(referenceDate);
      target.setDate(referenceDate.getDate() + daysOffset);
      return this.applyFallbackTime(target, fallbackDate, normalized).toISOString();
    }

    // 4. Weekday names (next occurrence)
    const weekday = this.matchWeekday(normalized);
    if (weekday !== null) {
      const target = this.getNextWeekday(referenceDate, weekday);
      return this.applyFallbackTime(target, fallbackDate, normalized).toISOString();
    }

    // 5. Nothing matched – return fallback if available
    return fallbackDate ? fallbackDate.toISOString() : null;
  }

  ensureIso(value) {
    const asDate = this.ensureDate(value);
    return asDate ? asDate.toISOString() : null;
  }

  ensureDate(value) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? new Date(value) : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (this.looksLikeStructuredDate(trimmed)) {
        const parsed = Date.parse(trimmed);
        if (!Number.isNaN(parsed)) {
          return new Date(parsed);
        }
      }
    }

    return null;
  }

  normalizeText(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  }

  matchRelativeKeyword(normalized) {
    if (!normalized) {
      return null;
    }

    if (this.relativeKeywords.today.some(keyword => normalized.includes(keyword))) {
      return { days: 0 };
    }

    if (this.relativeKeywords.tomorrow.some(keyword => normalized.includes(keyword))) {
      return { days: 1 };
    }

    if (this.relativeKeywords.dayAfterTomorrow.some(keyword => normalized.includes(keyword))) {
      return { days: 2 };
    }

    return null;
  }

  extractDaysOffset(normalized) {
    if (!normalized) {
      return null;
    }

    // Examples matched: "in 3 days", "dentro de 2 dias", "after 1 day", "en 5 dias"
    const patterns = [
      /(?:in|en|dentro de|after)\s+(\d+)\s+(?:day|days|dia|dias|día|días|din|दिन)/,
      /(\d+)\s+(?:day|days|dia|dias|día|días|din|दिन)\s+(?:from now|later|despues|después)/
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const value = parseInt(match[1], 10);
        if (!Number.isNaN(value)) {
          return value;
        }
      }
    }

    return null;
  }

  matchWeekday(normalized) {
    if (!normalized) {
      return null;
    }

    for (const entry of this.weekdayKeywords) {
      if (entry.keywords.some(keyword => normalized.includes(keyword))) {
        return entry.day;
      }
    }

    return null;
  }

  extractTimeComponentsFromString(normalized) {
    if (!normalized) {
      return null;
    }

    const hindiTimeMatch = normalized.match(/(सुबह|दोपहर|शाम|रात)\s*(\d{1,2})\s*(?:बजे)?/);
    if (hindiTimeMatch) {
      let hours = parseInt(hindiTimeMatch[2], 10);
      if (!Number.isFinite(hours)) {
        hours = 0;
      }

      const meridiem = hindiTimeMatch[1];

      if (meridiem === 'सुबह') {
        hours = hours % 12; // morning stays in 0-11
      } else if (meridiem === 'दोपहर') {
        // afternoon should be 12-17, shift values below 12 by +12, but keep 12 as-is
        if (hours < 12) {
          hours = (hours % 12) + 12;
        }
      } else if (meridiem === 'शाम') {
        // evening always PM; convert e.g., 4 -> 16, 12 -> 18 (fallback to 18 if unspecified)
        if (hours === 12) {
          hours = 18;
        } else if (hours < 12) {
          hours += 12;
        }
      } else if (meridiem === 'रात') {
        // night: 8pm onwards should be 20+, but early-night phrases like 1am/2am should remain
        if (hours >= 6 && hours < 12) {
          hours += 12;
        } else if (hours === 12) {
          hours = 0; // midnight
        }
      }

      return { hours, minutes: 0 };
    }

    const timePatterns = [
      /(?:at|a las|a la|a)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
      /(\d{1,2})(?::(\d{2}))\s*(am|pm)?/,
      /(\d{1,2})\s*(?:hours|horas|hrs|hr)/
    ];

    for (const pattern of timePatterns) {
      const match = normalized.match(pattern);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const meridiem = match[3];

        if (!Number.isFinite(hours) || hours > 23) {
          continue;
        }

        if (meridiem === 'pm' && hours < 12) {
          hours += 12;
        }

        if (meridiem === 'am' && hours === 12) {
          hours = 0;
        }

        return { hours, minutes };
      }
    }

    return null;
  }

  applyRelativeOffset(referenceDate, relative) {
    const target = new Date(referenceDate);
    target.setDate(referenceDate.getDate() + relative.days);
    return target;
  }

  applyFallbackTime(targetDate, fallbackDate, normalizedInput = '') {
    const result = new Date(targetDate);
    const timeComponents = this.extractTimeComponentsFromString(normalizedInput);

    if (timeComponents) {
      result.setHours(timeComponents.hours, timeComponents.minutes, 0, 0);
      return result;
    }

    if (fallbackDate) {
      result.setHours(
        fallbackDate.getHours(),
        fallbackDate.getMinutes(),
        fallbackDate.getSeconds(),
        fallbackDate.getMilliseconds()
      );
    }

    return result;
  }

  getNextWeekday(fromDate, targetDayNum) {
    const result = new Date(fromDate);
    const currentDay = fromDate.getDay();
    const daysUntilTarget = (targetDayNum - currentDay + 7) % 7;

    result.setDate(fromDate.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    return result;
  }

  looksLikeStructuredDate(value) {
    if (!value) {
      return false;
    }

    // Allow ISO strings, numeric timestamps, or common structured formats
    const structuredPattern = /^[0-9TtZz:\-+\/\.,\s]+$/;
    return structuredPattern.test(value);
  }
}

module.exports = { SmartDateParser };
  
