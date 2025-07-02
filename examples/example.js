import {exampleData} from "./exampleData.js";
import {
    CFDGraph,
    CFDRenderer,
    ScatterplotGraph,
    MovingRangeGraph,
    MovingRangeRenderer,
    ControlRenderer,
    HistogramRenderer,
    SimpleScatterplotRenderer,
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

// eslint-disable-next-line no-unused-vars
function renderCfdGraph(data, controlsElementSelector, loadConfigInputSelector, resetConfigInputSelector) {
    //The cfd area chart and brush window elements css selectors
    const cfdGraphElementSelector = "#cfd-area-div";
    const cfdBrushElementSelector = "#cfd-brush-div";
    //Declare the states array for the cfd graph data
    const states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered'];
    //Declare the states in  reversed order for the CFD (stacked area chart) to render correctly the areas
    const reversedStates = [...states].reverse();
    //Create a CFDGraph
    const cfdGraph = new CFDGraph(data, states);
    //Compute the dataset for a cfd graph
    const cfdGraphDataSet = cfdGraph.computeDataSet();
    //Create a CFDRenderer with the reversed states
    const cfdRenderer = new CFDRenderer(cfdGraphDataSet, reversedStates);
    //Pass the created event bus to the cfd graph
    cfdRenderer.setupEventBus(eventBus);
    const reportingRangeDays = 0.75 * cfdGraphDataSet.length;
    if (document.querySelector(cfdGraphElementSelector)) {
        if (cfdGraphDataSet.length > 0) {
            cfdRenderer.renderGraph(cfdGraphElementSelector);
            cfdRenderer.reportingRangeDays = reportingRangeDays
            cfdRenderer.setupXAxisControl()
            cfdRenderer.enableMetrics()
            document.querySelector(cfdBrushElementSelector) && cfdRenderer.setupBrush(cfdBrushElementSelector);
            document.querySelector(loadConfigInputSelector) && cfdRenderer.setupConfigLoader(loadConfigInputSelector, resetConfigInputSelector);
        } else {
            cfdRenderer.clearGraph(cfdGraphElementSelector, cfdBrushElementSelector);
        }
    }
    return {cfdRenderer, reportingRangeDays};
}

function renderScatterplotAndHistogramGraphs(data, reportingRangeDays, controlsElementSelector, loadConfigInputSelector, resetConfigInputSelector) {
    //The scatterplot area chart, histogram area chart and scatterplot brush window elements css selectors
    const scatterplotGraphElementSelector = "#scatterplot-area-div";
    const movingRangeGraphElementSelector = "#moving-range-area-div";
    const controlGraphElementSelector = "#control-area-div";
    const histogramGraphElementSelector = "#histogram-area-div";
    const timeScaleSelector = "#time-scale-select";
    const baseJiraURL = "";
    const scatterplotBrushElementSelector = "#scatterplot-brush-div";
    const controlBrushElementSelector = "#control-brush-div";
    const movingRangeBrushElementSelector = "#moving-range-brush-div";
    //Create a ScatterplotGraph
    const scatterplotGraph = new ScatterplotGraph(data);
    // //Compute the dataset for the scatterplot and histogram graphs
    const leadTimeDataSet = scatterplotGraph.computeDataSet(data);
    //Create a ScatterplotRenderer
    const scatterplotRenderer = new SimpleScatterplotRenderer(leadTimeDataSet, baseJiraURL);
    //Pass the created event bus to teh cfd graph
    scatterplotRenderer.setupEventBus(eventBus);
    //Create a HistogramRenderer
    const histogramRenderer = new HistogramRenderer(leadTimeDataSet, eventBus);
    if (document.querySelector(scatterplotGraphElementSelector)) {
        if (leadTimeDataSet.length > 0) {
            scatterplotRenderer.setTimeScaleListener(timeScaleSelector)
            scatterplotRenderer.renderGraph(scatterplotGraphElementSelector);
            scatterplotRenderer.reportingRangeDays = reportingRangeDays
            scatterplotRenderer.setupXAxisControl()
            scatterplotRenderer.enableMetrics()
            document.querySelector(histogramGraphElementSelector) && histogramRenderer.renderGraph(histogramGraphElementSelector);
            document.querySelector(scatterplotBrushElementSelector) && scatterplotRenderer.setupBrush(scatterplotBrushElementSelector);
            document.querySelector(loadConfigInputSelector) && scatterplotRenderer.setupConfigLoader(loadConfigInputSelector, resetConfigInputSelector);
        } else {
            scatterplotRenderer.clearGraph(scatterplotGraphElementSelector, scatterplotBrushElementSelector);
            histogramRenderer.clearGraph(histogramGraphElementSelector);
        }
    }

    //filter leadTimeDataSet values to not exceed 80 days lead time
    const filteredLeadTimeDataSet = leadTimeDataSet.filter((d) => d.leadTime <= 80);

    //Moving range chart
    const movingRangeGraph = new MovingRangeGraph(filteredLeadTimeDataSet);
    const movingRangeGraphDataSet = movingRangeGraph.computeDataSet();
    const avgMovingRange = movingRangeGraph.getAvgMovingRange()
    const movingRangeRenderer = new MovingRangeRenderer(movingRangeGraphDataSet, avgMovingRange);
    movingRangeRenderer.renderGraph(movingRangeGraphElementSelector);
    movingRangeRenderer.reportingRangeDays = reportingRangeDays;
    movingRangeRenderer.setupEventBus(eventBus)
    document.querySelector(movingRangeBrushElementSelector) && movingRangeRenderer.setupBrush(movingRangeBrushElementSelector);
    movingRangeRenderer.setupXAxisControl()


    //Control chart
    const controlRenderer = new ControlRenderer(filteredLeadTimeDataSet, avgMovingRange);
    controlRenderer.renderGraph(controlGraphElementSelector);
    controlRenderer.reportingRangeDays = reportingRangeDays;
    controlRenderer.setupEventBus(eventBus)
    document.querySelector(controlBrushElementSelector) && controlRenderer.setupBrush(controlBrushElementSelector);
    controlRenderer.setupXAxisControl()

    return scatterplotRenderer;
}

async function renderGraphs(data, serviceId) {
    //The Load and reset config input buttons css selectors
    const loadConfigInputSelector = "#load-config-input";
    const resetConfigInputSelector = "#reset-config-input";
    //The controls div css selector that contains the reporting range days input and the x axes labeling units dropdown
    const controlsElementSelector = "#controls-div";

    const {
        cfdRenderer,
        reportingRangeDays
    } = renderCfdGraph(data, controlsElementSelector, loadConfigInputSelector, resetConfigInputSelector);
    const scatterplotRenderer = renderScatterplotAndHistogramGraphs(data, reportingRangeDays, controlsElementSelector, loadConfigInputSelector, resetConfigInputSelector);
    const useObservationLogging = false;
    useObservationLogging && await useObservationLogging(scatterplotRenderer, cfdRenderer, serviceId);
}

async function useObservationLogging(scatterplotRenderer, cfdRenderer, serviceId) {
    const loggingServiceURL = "";
    const btoaToken = "";
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
        initializeForm({...event, chartType: "SCATTERPLOT", serviceId});
        toggleRightSidebar(true);
    });
    eventBus.addEventListener("cfd-click", (event) => {
        initializeForm({...event, chartType: "CFD", serviceId});
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
            console.log("Error submitting the observation: " + e.message);
        }
    });
}
