import { calculateDaysBetweenDates } from '../../utils/utils.js';

/**
 * Class representing a Work Item Graph Data
 */
class WorkItemAgeGraph {
  constructor(data, states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered']) {
    this.data = data;
    this.states = states;
  }

  computeDataSet() {
    const dataSet = [];
    this.data.forEach((ticket) => {
      const ticketStates = this.#getTheFirstAndLastAvailableStates(ticket);
      const diff = calculateDaysBetweenDates(ticketStates.initialStateTimestamp, ticketStates.currentStateTimestamp);
      const workItemAge = {
        age: diff.roundedDays + 1,
        ticketId: ticket.work_id,
        ticket_type: ticket.indexes?.find((i) => i.name === 'ticket_type')?.value || '',
        ...ticketStates,
      };
      if (isNaN(workItemAge.age) || workItemAge.age <= 0) {
        console.warn('Invalid age:', workItemAge.age, 'Ticket has incorrect timestamps', ticket);
        return;
      }
      dataSet.push(workItemAge);
    });

    dataSet.sort((t1, t2) => this.states.indexOf(t1.currentState) - this.states.indexOf(t2.currentState));
    return dataSet;
  }

  #getTheFirstAndLastAvailableStates(ticket) {
    let ticketStates = {};
    this.states.forEach((s) => {
      if (ticket[s]) {
        ticketStates.currentState = s;
        ticketStates.currentStateTimestamp = Date.now() / 1000;
        if (!ticketStates.initialStateTimestamp) {
          ticketStates.initialState = s;
          ticketStates.initialStateTimestamp = ticket[s];
        }
      }
    });
    return ticketStates;
  }
}

export default WorkItemAgeGraph;
