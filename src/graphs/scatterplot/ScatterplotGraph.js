import { calculateDaysBetweenDates } from '../../utils/utils.js';

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
      if (ticket.delivered) {
        const deliveredDate = new Date(ticket.delivered * 1000);
        deliveredDate.setHours(0, 0, 0, 0);
        const scatterplotTicket = {
          deliveredDate: deliveredDate,
          leadTime: 0,
          ticketId: ticket.work_id,
        };
        for (const state of this.states) {
          if (ticket[state]) {
            scatterplotTicket.leadTime = calculateDaysBetweenDates(ticket[state], ticket.delivered);
            break;
          }
        }
        if (scatterplotTicket.leadTime <= 0) {
          console.warn('Invalid lead time:', scatterplotTicket.leadTime, 'Ticket has incorrect timestamps', ticket);
          return;
        }
        dataSet.push(scatterplotTicket);
      }
    });
    dataSet.sort((t1, t2) => t1.deliveredDate - t2.deliveredDate);
    console.log(dataSet);
    return dataSet;
  }
}

export default ScatterplotGraph;
