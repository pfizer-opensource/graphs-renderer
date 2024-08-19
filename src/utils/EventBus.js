class EventBus {
  constructor() {
    this.eventTopics = {};
  }

  addEventListener(eventName, listener) {
    if (!this.eventTopics[eventName] || this.eventTopics[eventName].length < 1) {
      this.eventTopics[eventName] = [];
    }
    this.eventTopics[eventName].push(listener);
  }

  emitEvents(eventName, params) {
    if (!this.eventTopics[eventName] || this.eventTopics[eventName].length < 1) return;
    this.eventTopics[eventName].forEach((listener) => {
      try {
        listener(params ? params : {});
      } catch (error) {
        console.error('Error in listener for event', eventName, ':', error);
      }
    });
  }

  removeAllListeners(eventName) {
    if (this.eventTopics[eventName]) {
      this.eventTopics[eventName] = [];
    }
  }
}
export const eventBus = new EventBus();
