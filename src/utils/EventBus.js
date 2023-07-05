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
    this.eventTopics[eventName].forEach((listener) => listener(params ? params : {}));
  }
}
export const eventBus = new EventBus();
