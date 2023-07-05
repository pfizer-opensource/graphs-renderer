import * as d3 from 'd3'
/**
 * Class representing a Cumulative Flow Diagram (CFD) Graph Data
 */
class CFDGraph {
  /**
   * Creates a new CFDGraph instance.
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
   *     "github_repo": "pfizer/github_repo",
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
   * Computes the dataSet for the CFD graph.
   *
   * @returns {Array.<{
   *   date: string,
   *   delivered: number,
   *   verif_start: number,
   *   dev_complete: number,
   *   in_progress: number,
   *   analysis_done: number,
   *   analysis_active: number
   * }>} dataSet - array of ticket objects workflow representing the number of tickets in each state for every day date computed from the data tickets array received in the constructor
   *
   * @example
   *
   * dataSet = [
   *   {
   *     "date": "2023-01-09T15:12:03.000Z",
   *     "delivered": 1,
   *     "verif_start": 101,
   *     "dev_complete": 35,
   *     "in_progress": 19,
   *     "analysis_done": 0,
   *     "analysis_active": 0
   *   }
   * ];
   */
  computeDataSet() {
    const dataSet = [];
    //Get the min and max dates from the dataSet set
    const minDate = d3.min(this.data, (d) => d.delivered);
    const maxDate = d3.max(this.data, (d) => d.delivered);
    for (let i = new Date(minDate * 1000); i < new Date(maxDate * 1000); i.setDate(i.getDate() + 1)) {
      const currentDate = new Date(i);
      dataSet.push({
        date: currentDate,
        delivered: this.#getNoOfTicketsInDeliveredState(currentDate.getTime() / 1000),
        verif_start: this.#getNoOfTicketsInVerificationStartState(currentDate.getTime() / 1000),
        dev_complete: this.#getNoOfTicketsInDevCompleteState(currentDate.getTime() / 1000),
        in_progress: this.#getNoOfTicketsInProgressState(currentDate.getTime() / 1000),
        analysis_done: this.#getNoOfTicketsInAnalysisDoneState(currentDate.getTime() / 1000),
        analysis_active: this.#getNoOfTicketsInAnalysisActiveState(currentDate.getTime() / 1000),
      });
    }
    if (dataSet.length > 0) {
      dataSet[dataSet.length - 1].date = new Date(maxDate * 1000);
    }
    return dataSet;
  }

  #getNoOfTicketsInAnalysisActiveState(ticketTimestamp) {
    return this.data.filter((d) => {
      if (!d.analysis_active) {
        return false;
      }
      if (!d.analysis_done && ticketTimestamp >= d.analysis_active) {
        return true;
      }
      return ticketTimestamp >= d.analysis_active && ticketTimestamp < d.analysis_done;
    }).length;
  }

  #getNoOfTicketsInAnalysisDoneState(ticketTimestamp) {
    return this.data.filter((d) => {
      if (!d.analysis_done) {
        return false;
      }
      if (!d.in_progress && ticketTimestamp >= d.analysis_done) {
        return true;
      }
      return ticketTimestamp >= d.analysis_done && ticketTimestamp < d.in_progress;
    }).length;
  }

  #getNoOfTicketsInProgressState(ticketTimestamp) {
    return this.data.filter((d) => {
      if (!d.in_progress) {
        return false;
      }
      if (!d.dev_complete && ticketTimestamp >= d.in_progress) {
        return true;
      }
      return ticketTimestamp >= d.in_progress && ticketTimestamp < d.dev_complete;
    }).length;
  }

  #getNoOfTicketsInDevCompleteState(ticketTimestamp) {
    return this.data.filter((d) => {
      if (!d.dev_complete) {
        return false;
      }
      if (!d.verification_start && ticketTimestamp >= d.dev_complete) {
        return true;
      }
      return ticketTimestamp >= d.dev_complete && ticketTimestamp < d.verification_start;
    }).length;
  }

  #getNoOfTicketsInVerificationStartState(ticketTimestamp) {
    return this.data.filter((d) => {
      if (!d.verification_start) {
        return false;
      }
      if (!d.delivered && ticketTimestamp >= d.verification_start) {
        return true;
      }
      return ticketTimestamp >= d.verification_start && ticketTimestamp < d.delivered;
    }).length;
  }

  #getNoOfTicketsInDeliveredState(ticketTimestamp) {
    return this.data.filter((d) => {
      if (!d.delivered) {
        return false;
      }
      return ticketTimestamp >= d.delivered;
    }).length;
  }
}

export default CFDGraph;
