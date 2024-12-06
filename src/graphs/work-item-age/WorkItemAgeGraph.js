import { calculateDaysBetweenDates } from '../../utils/utils.js';
import * as d3 from 'd3';

/**
 * Class representing a Scatterplot Graph Data
 */
class ScatterplotGraph {
  /**
   * Creates a new ScatterplotGraph instance.
   * @constructor
   * @param {Array.<{
   *   analysis_active: string,
   *   analysis_done: string,
   *   delivered: string,
   *   dev_complete: string,
   *   github_repo: string,
   *   in_progress: string,
   *   indexes: Array,
   *   tags: Array,
   *   verification_start: string,
   *   work_id: string
   * }>} data - array of ticket objects
   *
   * @example
   *
   * data = [
   *   {
   *     "analysis_active": "timestamp",
   *     "analysis_done": "timestamp",
   *     "delivered": "timestamp",
   *     "dev_complete": "timestamp",
   *     "github_repo": "github_repo",
   *     "in_progress": "timestamp",
   *     "indexes": [],
   *     "tags": [],
   *     "verification_start": "timestamp",
   *     "work_id": "T-number"
   *   }
   * ];
   */
  constructor(data, states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered']) {
    this.data = data;
    this.states = states;
  }

  /**
   * Computes the dataSet for the Scatterplot and Histogram graphs.
   *
   * @returns {Array.<{
   *   delivered: string,
   *   noOfDays: number,
   *   ticketId: string
   * }>} dataSet - array of ticket objects containing the ticket number, the number of days it took to be delivered and the delivered date, computed from the data tickets array received in the constructor
   *
   * @example
   *
   * dataSet = [
   *   {
   *     "delivered": "2023-01-09T15:12:03.000Z",
   *     "noOfDays": 3,
   *     "ticketId": "T-9172349"
   *   }
   * ];
   */
  computeDataSet() {
    const dataSet = [];
    this.data.forEach((ticket) => {
      const ticketStates = this.#getTheFirstAndLastAvailableStates(ticket);
      const diff = calculateDaysBetweenDates(ticketStates.firstStateTimestamp, ticketStates.lastStateTimestamp);
      const workItemAge = {
        age: diff.roundedDays,
        ticketId: ticket.work_id,
        ...ticketStates,
      };
      if (isNaN(workItemAge.age) || workItemAge.age <= 0) {
        console.warn('Invalid age:', workItemAge.age, 'Ticket has incorrect timestamps', ticket);
        return;
      }
      dataSet.push(workItemAge);
    });
    dataSet.sort((t1, t2) => this.states.indexOf(t1.lastState) - this.states.indexOf(t2.lastState));
    return dataSet;
  }

  #getTheFirstAndLastAvailableStates(ticket) {
    let ticketStates = {};
    this.states.forEach((s) => {
      if (ticket[s]) {
        ticketStates.lastStateTimestamp = ticket[s];
        ticketStates.lastState = s;
        if (!ticketStates.firstStateTimestamp) {
          ticketStates.firstStateTimestamp = ticket[s];
          ticketStates.firstState = s;
        }
      }
    });
    return ticketStates;
  }
}

export default ScatterplotGraph;
