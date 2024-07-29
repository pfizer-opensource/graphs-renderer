import ScatterplotRenderer from './ScatterplotRenderer.js';

/**
 * Class representing a Scatterplot graph renderer
 */
class SimpleScatterplotRenderer extends ScatterplotRenderer {
  currentXScale;
  currentYScale;
  timeScale = 'logarithmic';

  /**
   * Creates a SimpleScatterplotRenderer instance
   * @constructor
   * @param {Array.<{
   *   deliveredDate: string,
   *   leadTime: number,
   *   ticketId: string
   * }>} data - array of ticket objects containing the ticket number, the number of days it took to be delivered and the delivered date
   *
   * @example
   *
   * data = [
   *   {
   *     "deliveredDate": "2023-01-09T15:12:03.000Z",
   *     "leadTime": 3,
   *     "ticketId": "TRON-12349"
   *   }
   * ];
   * @param workTicketsURL - The tickets base url
   */
  constructor(data, workTicketsURL) {
    super(data);
    this.workTicketsURL = workTicketsURL;
    this.chartName = 'scatterplot';
    this.chartType = 'SCATTERPLOT';
    this.dotClass = 'scatterplot-dot';
  }

  /**
   * Sets up an event bus for the renderer to listen to events.
   * @param {Object} eventBus - The event bus for communication.
   */
  setupEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener('change-time-range-cfd', this.updateBrushSelection.bind(this));
    this.eventBus?.addEventListener('change-time-interval-cfd', (timeInterval) => {
      this.timeInterval = timeInterval;
      this.drawXAxis(this.gx, this.x.copy().domain(this.selectedTimeRange), this.height, true);
    });
  }

  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
    this.drawPercentileLines(this.data, this.y);
  }

  drawScatterplot(chartArea, data, x, y) {
    console.log('Simple___dot____', this.dotClass);
    chartArea
      .selectAll(`.${this.dotClass}`)
      .data(data)
      .enter()
      .append('circle')
      .attr('class', this.dotClass)
      .attr('id', (d) => d.ticketId)
      .attr('data-date', (d) => d.deliveredDate)
      .attr('r', 5)
      .attr('cx', (d) => x(d.deliveredDate))
      .attr('cy', (d) => y(d.leadTime))
      .style('cursor', 'pointer')
      .attr('fill', this.color)
      .on('click', (event, d) => this.handleMouseClickEvent(event, d));
  }

  updateGraph(domain) {
    const focusData = this.updateChartArea(domain);
    this.drawPercentileLines(focusData, this.currentYScale);
    this.displayObservationMarkers(this.observations);
  }

  setTimeScaleListener(timeScaleSelector) {
    this.timeScaleSelectElement = document.querySelector(timeScaleSelector);
    if (this.timeScaleSelectElement) {
      this.timeScaleSelectElement.value = this.timeScale;
      this.timeScaleSelectElement.addEventListener('change', (event) => {
        this.timeScale = event.target.value;
        this.computeYScale();
        this.updateGraph(this.selectedTimeRange);
      });
    }
  }

  computePercentileLine(data, percent) {
    const percentileIndex = Math.floor(data.length * percent);
    return data[percentileIndex]?.leadTime;
  }

  drawPercentileLines(data, y) {
    const dataSortedByLeadTime = [...data].sort((a, b) => a.leadTime - b.leadTime);
    const percentile1 = this.computePercentileLine(dataSortedByLeadTime, 0.5);
    const percentile2 = this.computePercentileLine(dataSortedByLeadTime, 0.7);
    const percentile3 = this.computePercentileLine(dataSortedByLeadTime, 0.85);
    const percentile4 = this.computePercentileLine(dataSortedByLeadTime, 0.95);

    percentile1 && this.drawHorizontalLine(y, percentile1, 'red', 'p1', '50%');
    percentile1 && this.drawHorizontalLine(y, percentile2, 'red', 'p2', '70%');
    percentile1 && this.drawHorizontalLine(y, percentile3, 'red', 'p3', '85%');
    percentile1 && this.drawHorizontalLine(y, percentile4, 'red', 'p4', '95%');
  }
}

export default SimpleScatterplotRenderer;
