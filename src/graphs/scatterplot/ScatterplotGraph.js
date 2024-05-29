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
  constructor(data) {
    this.data = data;
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
    return this.data
      .filter((ticket) => ticket.delivered)
      .map((ticket) => {
        const deliveredDate = new Date(ticket.delivered * 1000);
        const startDate = ticket.analysis_active || ticket.analysis_done;
        const noOfDays = startDate ? calculateDaysBetweenDates(startDate, ticket.delivered) : 0;
        deliveredDate.setHours(0, 0, 0, 0);
        return {
          delivered: deliveredDate,
          noOfDays: noOfDays,
          ticketId: ticket.work_id,
        };
      })
      .sort((t1, t2) => t1.delivered - t2.delivered);
  }
}

export default ScatterplotGraph;
