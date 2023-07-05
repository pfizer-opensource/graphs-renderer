import CFDGraph from "../src/graphs/cfd/CFDGraph";
import CFDRenderer from "../src/graphs/cfd/CFDRenderer";
import ScatterplotGraph from "../src/graphs/scatterplot/ScatterplotGraph";
import ScatterplotRenderer from "../src/graphs/scatterplot/ScatterplotRenderer";
import HistogramRenderer from "../src/graphs/histogram/HistogramRenderer";
import {processServiceData} from "../src";
import {serviceData} from "./serviceData.js";
import {EventBus} from "../src";

let removedTicketTypes = ["task"];
let removedRepos = ["tf-aws-electron-github-runner"];

let data = processServiceData(serviceData, removedRepos, removedTicketTypes);
if (!data || data.length === 0) {
    console.log("There is no data for this service!");
} else {
    renderGraphs(data);
}

function renderGraphs(data) {
    //Create an event bus for event driven communication between graphs
    const eventBus = new EventBus();
    //The Load and reset config input buttons css selectors
    const loadConfigInputSelector = "#load-config-input";
    const resetConfigInputSelector = "#reset-config-input";
    //The controls div css selector that contains the reporting range days input and the x axis labeling units dropdown
    const cfdUIControlsElementSelector = "#controls-div";

    //The cfd area chart and brush window elements css selectors
    const cfdGraphElementSelector = "#cfd-area-div";
    const cfdBrushElementSelector = "#cfd-brush-div";
    //Create a CFDGraph
    const cfdGraph = new CFDGraph(data);
    //Compute the dataset for a cfd graph
    const cfdGraphDataSet = cfdGraph.computeDataSet();
    //Create a CFDRenderer
    const cfdRenderer = new CFDRenderer(cfdGraphDataSet);
    //Pass the created event bus to teh cfd graph
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

    //The scatterplot area chart, histogram area chart and scatterplot brush window elements css selectors
    const scatterplotGraphElementSelector = "#scatterplot-area-div";
    const histogramGraphElementSelector = "#histogram-area-div";
    const scatterplotBrushElementSelector = "#scatterplot-brush-div";
    //Create a ScatterplotGraph
    const scatterplotGraph = new ScatterplotGraph(data);
    //Compute the dataset for the scatterplot and histogram graphs
    const leadTimeDataSet = scatterplotGraph.computeDataSet(data);
    //Create a ScatterplotRenderer
    const scatterplotRenderer = new ScatterplotRenderer(leadTimeDataSet);
    //Pass the created event bus to teh cfd graph
    scatterplotRenderer.useEventBus(eventBus);
    //Create a HistogramRenderer
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