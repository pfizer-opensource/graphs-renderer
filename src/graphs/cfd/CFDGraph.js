import * as d3 from 'd3';

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
   *     "github_repo": "github_repo_name",
   *     "in_progress": "timestamp",
   *     "indexes": [],
   *     "tags": [],
   *     "verification_start": "timestamp",
   *     "work_id": "TRON-number"
   *   }
   * ];
   */
  constructor(data, states) {
    this.data = data;
    this.states = states;
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
    const minDate = new Date(d3.min(this.data, (d) => d.delivered) * 1000);
    const maxDate = new Date(d3.max(this.data, (d) => d.delivered) * 1000);
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);
    for (let date = minDate; date <= maxDate; date.setDate(date.getDate() + 1)) {
      const currentDate = new Date(date);
      currentDate.setHours(0, 0, 0, 0);
      const currentTimestamp = currentDate.getTime() / 1000;
      dataSet.push({
        date: currentDate,
        delivered: this.#getNoOfTicketsInState(this.states[5], currentTimestamp),
        verif_start: this.#getNoOfTicketsInState(this.states[4], currentTimestamp),
        dev_complete: this.#getNoOfTicketsInState(this.states[3], currentTimestamp),
        in_progress: this.#getNoOfTicketsInState(this.states[2], currentTimestamp),
        analysis_done: this.#getNoOfTicketsInState(this.states[1], currentTimestamp),
        analysis_active: this.#getNoOfTicketsInState(this.states[0], currentTimestamp),
      });
    }
    return dataSet;
  }

  /**
   * Calculates the number of tickets in a specific state at a given timestamp.
   * A ticket counts as being in the state if its timestamp for that state is before the given timestamp.
   * If the state is the last in the sequence or the next state is undefined, only this condition needs to be met.
   * Otherwise, the ticket's timestamp for the next state must be after the given timestamp.
   *
   * @param {string} state - The current state to check in the ticket.
   * @param {number} timestamp - The timestamp at which to check the ticket state.
   * @returns {number} noOfTickets - The count of tickets in the specified state for the given timestamp.
   */
  #getNoOfTicketsInState(state, timestamp) {
    return this.data.filter((d) => {
      if (!d[state]) {
        return false;
      }
      const nextState = this.#getNextState(state);
      if (!nextState) {
        return d[state] <= timestamp;
      }
      return d[state] <= timestamp && d[nextState] > timestamp;
    }).length;
  }

  /**
   * Gets the next state in the ticket lifecycle based on the current state.
   * Returns null if the current state is the last one in the lifecycle.
   *
   * @param {string} state - The current state of the ticket.
   * @returns {string|null} nextState - The next state in the ticket lifecycle, or null if there is no next state.
   */
  #getNextState(state) {
    const index = this.states.indexOf(state);
    return index >= 0 && index < this.states.length - 1 ? this.states[index + 1] : null;
  }
}

export default CFDGraph;
