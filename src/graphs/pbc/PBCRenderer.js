import { UIControlsRenderer } from '../UIControlsRenderer.js';

export class PBCRenderer extends UIControlsRenderer {
  constructor(controlData, movingRangeData, workTicketsURL, chartName = 'pbc') {
    super(controlData);
    this.controlData = controlData;
    this.movingRangeData = movingRangeData;
    this.workTicketsURL = workTicketsURL;
    this.chartName = chartName;
    this.chartType = 'PBC';
    // Child renderers
    this.controlRenderer = null;
    this.movingRangeRenderer = null;
  }

  /**
   * Initialize child renderers with their respective data
   */
  initializeRenderers(ControlRenderer, MovingRangeRenderer) {
    this.controlRenderer = new ControlRenderer(this.controlData, `${this.chartName}-control`, this.workTicketsURL);
    this.movingRangeRenderer = new MovingRangeRenderer(this.movingRangeData, this.workTicketsURL, `${this.chartName}-moving-range`);
  }

  /**
   * Render both charts
   */
  renderGraph(containerSelector) {
    this.createContainers(containerSelector);
    // Render control chart
    this.controlRenderer.renderGraph(`${containerSelector} .control-chart`);
    // Render moving range chart
    this.movingRangeRenderer.renderGraph(`${containerSelector} .moving-range-chart`);
    // Sync baseline dates and time ranges
    this.syncChartProperties();
  }

  /**
   * Create HTML containers for both charts
   */
  createContainers(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.innerHTML = `
      <div class="pbc-charts">
        <div class="control-chart"></div>
        <div class="moving-range-chart"></div>
      </div>
    `;
  }

  /**
   * Setup brush - only from control chart
   */
  setupBrush(brushSelector) {
    this.brushSelector = brushSelector;
    this.controlRenderer.setupBrush(brushSelector);
    this.syncBrushEvents();
    this.updateGraph(this.controlRenderer.selectedTimeRange);
  }

  /**
   * Sync brush events to update both charts
   */
  syncBrushEvents() {
    // Override control renderer's updateGraph to also update moving range
    const originalUpdateGraph = this.controlRenderer.updateGraph.bind(this.controlRenderer);
    this.controlRenderer.updateGraph = (domain) => {
      // Update control chart
      originalUpdateGraph(domain);

      // Update moving range chart with the same domain
      this.movingRangeRenderer.updateGraph(domain);
    };
  }

  setTimeScale(timeScale) {
    this.controlRenderer.timeScale = timeScale;
    this.movingRangeRenderer.timeScale = timeScale;
  }

  /**
   * Sync properties between charts
   */
  syncChartProperties() {
    if (!this.controlRenderer || !this.movingRangeRenderer) return;
    this.movingRangeRenderer.reportingRangeDays = 30;
    this.controlRenderer.reportingRangeDays = 30;
    this.movingRangeRenderer.timeInterval = 'months';
    this.controlRenderer.timeInterval = 'months';
    this.movingRangeRenderer.timeScale = 'logarithmic';
    this.controlRenderer.timeScale = 'logarithmic';
  }

  /**
   * Setup event bus for both charts
   */
  setupEventBus(eventBus, mouseChartsEvents, timeRangeChartsEvents) {
    this.controlRenderer?.setupEventBus(eventBus, mouseChartsEvents, timeRangeChartsEvents);
    this.movingRangeRenderer?.setupEventBus(eventBus, mouseChartsEvents, timeRangeChartsEvents);
  }

  /**
   * Setup observations for both charts
   */
  setupObservationLogging(observations) {
    this.controlRenderer?.setupObservationLogging(observations);
    this.movingRangeRenderer?.setupObservationLogging(observations);
  }

  setTimeScaleListener(timeScaleSelector) {
    const selectElement = document.querySelector(timeScaleSelector);
    if (!selectElement) {
      console.warn(`Time scale selector not found: ${timeScaleSelector}`);
      return;
    }
    // Single event listener that updates both charts
    selectElement.addEventListener('change', (event) => {
      const newTimeScale = event.target.value;
      // Update both renderers
      if (this.controlRenderer) {
        this.controlRenderer.timeScale = newTimeScale;
        this.controlRenderer.computeYScale();
        this.controlRenderer.updateGraph(this.controlRenderer.selectedTimeRange);
        this.controlRenderer.renderBrush(); // Only control renderer renders brush
      }

      if (this.movingRangeRenderer) {
        this.movingRangeRenderer.timeScale = newTimeScale;
        this.movingRangeRenderer.computeYScale();
        this.movingRangeRenderer.updateGraph(this.controlRenderer.selectedTimeRange);
        // No renderBrush() for moving range
      }
    });
  }

  /**
   * Clear both charts
   */
  clearGraph(containerSelector, brushSelector) {
    this.controlRenderer?.clearGraph(`${containerSelector} .control-chart`, brushSelector);
    this.movingRangeRenderer?.clearGraph(`${containerSelector} .moving-range-chart`, null);

    const container = document.querySelector(containerSelector);
    if (container) container.innerHTML = '';
  }

  /**
   * Update both charts
   */
  updateGraph(domain) {
    this.controlRenderer?.updateGraph(domain);
    this.movingRangeRenderer?.updateGraph(domain);
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.controlRenderer?.cleanupTooltip?.();
    this.movingRangeRenderer?.cleanupTooltip?.();
  }
}
