/**
 * Analytics and metrics tracking system
 */

interface AnalyticsEvent {
  name: string;
  category: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

class AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private maxEvents = 1000;

  track(
    name: string,
    category: string,
    value?: number,
    metadata?: Record<string, any>
  ): void {
    const event: AnalyticsEvent = {
      name,
      category,
      value,
      metadata,
      timestamp: Date.now(),
    };

    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Store in localStorage
    this.persist();
  }

  getEvents(
    category?: string,
    limit: number = 100
  ): AnalyticsEvent[] {
    let filtered = [...this.events];

    if (category) {
      filtered = filtered.filter(e => e.category === category);
    }

    return filtered.slice(-limit).reverse();
  }

  getMetrics(category?: string) {
    const events = category 
      ? this.events.filter(e => e.category === category)
      : this.events;

    const byCategory = events.reduce((acc, event) => {
      if (!acc[event.category]) {
        acc[event.category] = {
          count: 0,
          totalValue: 0,
          avgValue: 0,
        };
      }
      acc[event.category].count++;
      if (event.value !== undefined) {
        acc[event.category].totalValue += event.value;
      }
      return acc;
    }, {} as Record<string, { count: number; totalValue: number; avgValue: number }>);

    // Calculate averages
    Object.keys(byCategory).forEach(cat => {
      if (byCategory[cat].count > 0) {
        byCategory[cat].avgValue = byCategory[cat].totalValue / byCategory[cat].count;
      }
    });

    return {
      total: events.length,
      byCategory,
      recent: events.slice(-10),
    };
  }

  clear(): void {
    this.events = [];
    localStorage.removeItem('analytics_events');
  }

  private persist(): void {
    try {
      localStorage.setItem('analytics_events', JSON.stringify(this.events));
    } catch (error) {
      console.warn('Failed to persist analytics:', error);
    }
  }

  load(): void {
    try {
      const saved = localStorage.getItem('analytics_events');
      if (saved) {
        this.events = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load analytics:', error);
    }
  }

  exportData() {
    return {
      events: this.events,
      metrics: this.getMetrics(),
      exportedAt: new Date().toISOString(),
    };
  }
}

export const analyticsTracker = new AnalyticsTracker();
analyticsTracker.load();
