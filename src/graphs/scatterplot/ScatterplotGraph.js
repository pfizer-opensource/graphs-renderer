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
   *     "github_repo": "github_repo_name",
   *     "in_progress": "timestamp",
   *     "indexes": [],
   *     "tags": [],
   *     "verification_start": "timestamp",
   *     "work_id": "TRON-number"
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
   *     "ticketId": "TRON-12349"
   *   }
   * ];
   */
  computeDataSet() {
    const dataSet = [];
    this.data.forEach((ticket) => {
      if (ticket.delivered) {
        const scatterplotTicket = {
          delivered: new Date(ticket.delivered * 1000),
          noOfDays: 0,
          ticketId: ticket.work_id,
        };
        if (ticket.analysis_active || ticket.analysis_done) {
          scatterplotTicket.noOfDays = this.#getNoOfDeliveryDays(ticket.analysis_active || ticket.analysis_done, ticket.delivered);
        }
        dataSet.push(scatterplotTicket);
      }
    });
    dataSet.sort((t1, t2) => t1.delivered - t2.delivered);
    return dataSet;
  }

  #getNoOfDeliveryDays(startTimestamp, deliveredTimestamp) {
    const oneDayInSeconds = 60 * 60 * 24;
    const diffTimeInSeconds = deliveredTimestamp - startTimestamp;
    const noOfDays = Math.floor(diffTimeInSeconds / oneDayInSeconds);
    return noOfDays;
  }
}

export default ScatterplotGraph;
