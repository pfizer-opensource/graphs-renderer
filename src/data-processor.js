/**
 *  Process the serviceData into a single array of data.
 *  It filters out the tickets that belong to removedRepos or removedTicketTypes from the serviceData, and it merges all the tickets array in a single array of tickets
 *  @param {Object.<{
 *     github_repo: Array.<{
 *        analysis_active: string,
 *        analysis_done: string,
 *        delivered: string,
 *        dev_complete: string,
 *        github_repo: string,
 *        in_progress: string,
 *        indexes: Array,
 *        tags: Array,
 *        verification_start: string,
 *        work_id: string
 *     }>
 *   }>
 *  } serviceData - object where each property is a GitHub repo name and its value is an array of ticket objects
 *
 *  @example
 *
 *  serviceData =
 *  {
 *      "github_repo":
 *      [
 *          {
 *            "analysis_active": "timestamp",
 *            "analysis_done": "timestamp",
 *            "delivered": "timestamp",
 *            "dev_complete": "timestamp",
 *            "github_repo": "pfizer/github_repo",
 *            "in_progress": "timestamp",
 *            "indexes": [],
 *            "tags": [],
 *            "verification_start": "timestamp",
 *            "work_id": "TRON-number"
 *         }
 *      ]
 *  }
 *  @param {Array} removedRepos - array containing the repositories names that need to be filtered out from the service data
 *  @param {Array} removedTicketTypes - array containing the ticket type names that need to be filtered out from the service data
 *  @returns {Array} dataSet - array containing all the tickets after filtering and merging operation
 */
export function processServiceData(serviceData, removedRepos = [], removedTicketTypes = []) {
  let dataSet = [];
  if (serviceData) {
    const serviceDataCopy = Object.assign({}, serviceData);
    Object.keys(serviceDataCopy).forEach((key) => {
      const keyToRemove = removedRepos.find((r) => key.endsWith(r));
      if (keyToRemove) {
        delete serviceDataCopy[key];
      }
    });
    for (const [, value] of Object.entries(serviceDataCopy)) {
      dataSet = dataSet.concat(value);
    }
    dataSet = dataSet.filter((t) => t.indexes && !t.indexes.some((i) => i.name === "ticket_type" && removedTicketTypes.includes(i.value)));
  }
  // console.log(dataSet);
  return dataSet;
}
