import CFDRenderer from "./cfd/CFDRenderer.js";
import CFDGraph from "./cfd/CFDGraph.js";
import ScatterplotGraph from "./scatterplot/ScatterplotGraph.js";
import ScatterplotRenderer from "./scatterplot/ScatterplotRenderer.js";
import HistogramRenderer from "./histogram/HistogramRenderer.js";
import EventBus from "../utils/EventBus.js";
import { processServiceData } from "./data-processor.js";

/**
 *  Renders the 3 graphs: CFD, Scatterplot, Histogram
 * @param {Array.<{
 *   date: string,
 *   delivered: number,
 *   verif_start: number,
 *   dev_complete: number,
 *   in_progress: number,
 *   analysis_done: number,
 *   analysis_active: number
 * }>} data - array of objects containing the ticket information.
 *
 *  @example
 *
 *  data=
 *  [
 *    {
 *      "analysis_active": "timestamp",
 *      "analysis_done": "timestamp",
 *      "delivered": "timestamp",
 *      "dev_complete": "timestamp",
 *      "github_repo": "pfizer/github_repo",
 *      "in_progress": "timestamp",
 *      "indexes": [],
 *      "tags": [],
 *      "verification_start": "timestamp",
 *      "work_id": "TRON-number"
 *    }
 *  ]
 */
export function renderGraphs(data) {
  const eventBus = new EventBus();
  const loadConfigInputSelector = "#load-config-input";
  const resetConfigInputSelector = "#reset-config-input";
  //Cumulative Flow Diagram
  const cfdGraph = new CFDGraph(data);
  const cfdGraphDataSet = cfdGraph.computeDataSet();
  // console.table(cfdGraphDataSet);
  const cfdGraphElementSelector = "#cfd-area-div";
  const cfdBrushElementSelector = "#cfd-brush-div";
  const cfdUIControlsElementSelector = "#controls-div";
  const cfdRenderer = new CFDRenderer(cfdGraphDataSet);
  cfdRenderer.useEventBus(eventBus);

  if (document.querySelector(cfdGraphElementSelector)) {
    if (cfdGraphDataSet.length > 0) {
      cfdRenderer.drawGraph(cfdGraphElementSelector);
      document.querySelector(cfdBrushElementSelector) && cfdRenderer.useBrush(cfdBrushElementSelector);
      document.querySelector(cfdUIControlsElementSelector) && cfdRenderer.useControls("#reporting-range-input", "#range-increments-select");
      document.querySelector(loadConfigInputSelector) && cfdRenderer.useConfigLoading(loadConfigInputSelector, resetConfigInputSelector);
    } else {
      cfdRenderer.clearGraph(cfdGraphElementSelector, cfdBrushElementSelector);
    }
  }

  //Scatter plot
  const scatterplotGraph = new ScatterplotGraph(data);
  const leadTimeDataSet = scatterplotGraph.computeDataSet(data);
  // console.table(leadTimeDataSet);
  const scatterplotGraphElementSelector = "#scatterplot-area-div";
  const histogramGraphElementSelector = "#histogram-area-div";
  const scatterplotBrushElementSelector = "#scatterplot-brush-div";
  const scatterplotUIControlsElementSelector = "#controls-div";
  const scatterplotRenderer = new ScatterplotRenderer(leadTimeDataSet);
  scatterplotRenderer.useEventBus(eventBus);
  const histogramRenderer = new HistogramRenderer(leadTimeDataSet, eventBus);

  if (document.querySelector(scatterplotGraphElementSelector)) {
    if (leadTimeDataSet.length > 0) {
      scatterplotRenderer.drawGraph(scatterplotGraphElementSelector);
      document.querySelector(histogramGraphElementSelector) && histogramRenderer.drawGraph(histogramGraphElementSelector);
      document.querySelector(scatterplotBrushElementSelector) && scatterplotRenderer.useBrush(scatterplotBrushElementSelector);
      document.querySelector(scatterplotUIControlsElementSelector) &&
        scatterplotRenderer.useControls("#reporting-range-input", "#range-increments-select");
      document.querySelector(loadConfigInputSelector) &&
        scatterplotRenderer.useConfigLoading(loadConfigInputSelector, resetConfigInputSelector);
    } else {
      scatterplotRenderer.clearGraph(scatterplotGraphElementSelector, scatterplotBrushElementSelector);
      histogramRenderer.clearGraph(histogramGraphElementSelector);
    }
  }
}

/**
 *  Renders the CFDs for all the services
 * @param {Object.<{
 *   serviceGroup: Object.<{
 *     service: Object.<{
 *       github_repo: Array.<{
 *         analysis_active: string,
 *         analysis_done: string,
 *         delivered: string,
 *         dev_complete: string,
 *         github_repo: string,
 *         in_progress: string,
 *         indexes: Array,
 *         tags: Array,
 *         verification_start: string,
 *         work_id: string
 *         }>
 *       }>
 *      }>
 *     }>
 *   } serviceData - object containing all the service groups with all its tickets
 *
 *  @example
 *
 *  serviceData=
 *  {
 *    "serviceGroup":
 *    {
 *        "service":
 *        {
 *            "github_repo":
 *            [
 *                 {
 *                    "analysis_active": "timestamp",
 *                    "analysis_done": "timestamp",
 *                    "delivered": "timestamp",
 *                    "dev_complete": "timestamp",
 *                    "github_repo": "pfizer/github_repo",
 *                    "in_progress": "timestamp",
 *                    "indexes": [],
 *                    "tags": [],
 *                    "verification_start": "timestamp",
 *                    "work_id": "TRON-number"
 *                }
 *            ]
 *        }
 *    }
 *  }
 *   @param {String} serviceGroupName - the name of the service group
 *   Example: serviceGroupName: "electron"
 */
export function renderCFDs(serviceData, serviceGroupName) {
  for (const [key, value] of Object.entries(serviceData[serviceGroupName])) {
    const dataSet = processServiceData(value);
    const cfdGraph = new CFDGraph(dataSet);
    const cfdGraphDataSet = cfdGraph.computeDataSet();
    const cfdGraphElementSelector = `#${serviceGroupName}-cfd-${key.replace(/[()]/g, "")}`;
    const cfdRenderer = new CFDRenderer(cfdGraphDataSet);
    cfdRenderer.drawGraph(cfdGraphElementSelector);
  }
}
