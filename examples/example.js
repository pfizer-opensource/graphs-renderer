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
import {initializeForm, toggleRightSidebar, warningField} from "./sidebars.js"


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
    console.table(data)
    //Create a CFDGraph
    const states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered'];
    const cfdGraph = new CFDGraph(data, states);
    //Compute the dataset for a cfd graph
    const cfdGraphDataSet = cfdGraph.computeDataSet();
    //Create a CFDRenderer
    const cfdRenderer = new CFDRenderer(cfdGraphDataSet, states.reverse());
    //Pass the created event bus to teh cfd graph
    cfdRenderer.setupEventBus(eventBus);
    const reportingRangeDays = 0.75 * cfdGraphDataSet.length;
    if (document.querySelector(cfdGraphElementSelector)) {
        if (cfdGraphDataSet.length > 0) {
            cfdRenderer.renderGraph(cfdGraphElementSelector);
            cfdRenderer.setReportingRangeDays(reportingRangeDays);
            cfdRenderer.setupXAxisControl()
            cfdRenderer.enableMetrics()
            document.querySelector(cfdBrushElementSelector) && cfdRenderer.setupBrush(cfdBrushElementSelector);
            document.querySelector(controlsElementSelector) && cfdRenderer.setupChartControls("#reporting-range-input", "#range-increments-select");
            document.querySelector(loadConfigInputSelector) && cfdRenderer.setupConfigLoader(loadConfigInputSelector, resetConfigInputSelector);
        } else {
            cfdRenderer.clearGraph(cfdGraphElementSelector, cfdBrushElementSelector);
        }
    }

    //The scatterplot area chart, histogram area chart and scatterplot brush window elements css selectors
    const scatterplotGraphElementSelector = "#scatterplot-area-div";
    const histogramGraphElementSelector = "#histogram-area-div";
    const baseJiraURL = "https://digitalpfizer.atlassian.net/browse";
    const scatterplotBrushElementSelector = "#scatterplot-brush-div";
    //Create a ScatterplotGraph
    const scatterplotGraph = new ScatterplotGraph(data);
    //Compute the dataset for the scatterplot and histogram graphs
    const leadTimeDataSet = scatterplotGraph.computeDataSet(data);
    //Create a ScatterplotRenderer
    const scatterplotRenderer = new ScatterplotRenderer(leadTimeDataSet, baseJiraURL);
    //Pass the created event bus to teh cfd graph
    scatterplotRenderer.setupEventBus(eventBus);
    //Create a HistogramRenderer
    const histogramRenderer = new HistogramRenderer(leadTimeDataSet, eventBus);
    if (document.querySelector(scatterplotGraphElementSelector)) {
        if (leadTimeDataSet.length > 0) {
            scatterplotRenderer.renderGraph(scatterplotGraphElementSelector);
            scatterplotRenderer.setReportingRangeDays(reportingRangeDays);
            scatterplotRenderer.setupXAxisControl()
            scatterplotRenderer.enableMetrics()
            document.querySelector(histogramGraphElementSelector) && histogramRenderer.renderGraph(histogramGraphElementSelector);
            document.querySelector(scatterplotBrushElementSelector) && scatterplotRenderer.setupBrush(scatterplotBrushElementSelector);
            document.querySelector(controlsElementSelector) && scatterplotRenderer.setupChartControls("#reporting-range-input", "#range-increments-select");
            document.querySelector(loadConfigInputSelector) && scatterplotRenderer.setupConfigLoader(loadConfigInputSelector, resetConfigInputSelector);
        } else {
            scatterplotRenderer.clearGraph(scatterplotGraphElementSelector, scatterplotBrushElementSelector);
            histogramRenderer.clearGraph(histogramGraphElementSelector);
        }
    }
    await useObservationLogging(scatterplotRenderer, cfdRenderer, serviceId);
}

async function useObservationLogging(scatterplotRenderer, cfdRenderer, serviceId) {
    const loggingServiceURL = "https://4njxsfgzvh.execute-api.us-east-1.amazonaws.com/v1"; //dev
    const btoaToken = "cVJNd0d3WGJ0bXBETDIzN0VJR2tyZ1dib3BHS1dnUlZrMXd2M1RvN2hGV3I="; //dev
   const observationLoggingService = new ObservationLoggingService(loggingServiceURL, btoaToken, serviceId);
    let observations = [];
    try {
        await observationLoggingService.loadObservations();
        observations = observationLoggingService.observationsByService;
    } catch (e) {
        console.error(e);
    }

    scatterplotRenderer.setupObservationLogging(observations);
    cfdRenderer.setupObservationLogging(observations);
    eventBus.addEventListener("scatterplot-click", (event) => {
        initializeForm({ ...event, chartType: "SCATTERPLOT", serviceId });
        toggleRightSidebar(true);
    });
    eventBus.addEventListener("cfd-click", (event) => {
        initializeForm({ ...event, chartType: "CFD", serviceId });
        toggleRightSidebar(true);
    });
    eventBus.addEventListener("submit-observation-form", async (observation) => {
        let observationResponse;
        const observationId = observation.observation_id;
        delete observation.observation_id;
        try {
            if (observationId) {
                observationResponse = await observationLoggingService.updateObservation(observation, observationId);
            } else {
                observationResponse = await observationLoggingService.addObservation(observation);
            }
            if (observationResponse) {
                toggleRightSidebar(false);
                if (observation.chart_type === "SCATTERPLOT") {
                    scatterplotRenderer.hideTooltip();
                    scatterplotRenderer.displayObservationMarkers(observationLoggingService.observationsByService);
                }
                if (observation.chart_type === "CFD") {
                    cfdRenderer.hideTooltipAndMovingLine();
                    cfdRenderer.displayObservationMarkers(observationLoggingService.observationsByService);
                }
            }
        } catch (e) {
            warningField.textContent = "Error submitting the observation: " + e.message;
            console.log( "Error submitting the observation: " + e.message);
        }
    });
}
