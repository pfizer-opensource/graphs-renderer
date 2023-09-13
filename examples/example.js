import {exampleData} from "./exampleData.js";
import {
    CFDGraph,
    CFDRenderer,
    ScatterplotGraph,
    ScatterplotRenderer,
    HistogramRenderer,
    ObservationLoggingService,
    processServiceData,
    eventBus
} from "../dist/graphs-renderer.js";
import {initializeForm,toggleRightSidebar} from "./sidebars.js"

let removedTicketTypes = ["task"];
let removedRepos = ["wizard-lambda"];
let serviceData = exampleData
let serviceId = "0a95c-9151-448e"
let data = processServiceData(serviceData, removedRepos, removedTicketTypes);
if (!data || data.length === 0) {
    console.log("There is no data for this service!");
} else {
    renderGraphs(data, serviceId);
}

async function renderGraphs(data, serviceId) {
    //The Load and reset config input buttons css selectors
    const loadConfigInputSelector = "#load-config-input";
    const resetConfigInputSelector = "#reset-config-input";
    //The controls div css selector that contains the reporting range days input and the x axis labeling units dropdown
    const controlsElementSelector = "#controls-div";

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
            document.querySelector(controlsElementSelector) && cfdRenderer.useControls("#reporting-range-input", "#range-increments-select");
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
            document.querySelector(controlsElementSelector) &&
            scatterplotRenderer.useControls("#reporting-range-input", "#range-increments-select");
            document.querySelector(loadConfigInputSelector) &&
            scatterplotRenderer.useConfigLoading(loadConfigInputSelector, resetConfigInputSelector);
        } else {
            scatterplotRenderer.clearGraph(scatterplotGraphElementSelector, scatterplotBrushElementSelector);
            histogramRenderer.clearGraph(histogramGraphElementSelector);
        }
    }
    await useObservationLogging(scatterplotRenderer, cfdRenderer, serviceId);
}

async function useObservationLogging(scatterplotRenderer, cfdRenderer, serviceId) {
    const observationLoggingServiceURL = "#";
    const workTicketsURL = "#";
    const observationLoggingService = new ObservationLoggingService(observationLoggingServiceURL, serviceId);
    await observationLoggingService.loadObservations();
    scatterplotRenderer.useObservationLogging(observationLoggingService.observationsByService, workTicketsURL);
    cfdRenderer.useObservationLogging(observationLoggingService.observationsByService);

    eventBus.addEventListener("scatterplot-click", (event) => {
        initializeForm({...event, chartType: "SCATTERPLOT", serviceId});
        toggleRightSidebar(true);
    });

    eventBus.addEventListener("cfd-click", (event) => {
        initializeForm({...event, chartType: "CFD", serviceId});
        toggleRightSidebar(true);
    });

    eventBus.addEventListener("submit-observation-form", async (observation) => {
        let observationResponse;
        const observationId = observation.data.observation_id;
        delete observation.data.observation_id;
        if (observationId) {
            observationResponse = await observationLoggingService.updateObservation(observation, observationId);
        } else {
            observationResponse = await observationLoggingService.addObservation(observation);
        }
        if (observationResponse) {
            console.log(observationResponse);
            toggleRightSidebar(false);
            if (observation.data.chart_type === "SCATTERPLOT") {
                scatterplotRenderer.hideTooltip();
                scatterplotRenderer.markObservations(observationLoggingService.observationsByService);
            }
            if (observation.data.chart_type === "CFD") {
                cfdRenderer.hideTooltip();
                cfdRenderer.markObservations(observationLoggingService.observationsByService);
            }
        }
    });
}
