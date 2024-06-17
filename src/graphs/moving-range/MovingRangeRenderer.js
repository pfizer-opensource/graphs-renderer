import ScatterplotRenderer from '../scatterplot/ScatterplotRenderer.js';
import * as d3 from 'd3';

class MovingRangeRenderer extends ScatterplotRenderer {
  color = '#0ea5e9';
  timeScale = 'linear';

  constructor(data) {
    super(data);
    this.chartName = 'moving-range';
    this.chartType = 'MOVING_RANGE';
    this.dotClass = 'moving-range-dot';
  }

  setupEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener('change-time-range-control', this.updateBrushSelection.bind(this));
  }

  renderGraph(graphElementSelector, timeScaleSelector) {
    console.log(timeScaleSelector);
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
    this.topLimit = this.getAvgMovingRange();
    this.drawHorizontalLine(this.y, this.topLimit, 'orange', 'mid');
  }

  drawScatterplot(chartArea, data, x, y) {
    chartArea
      .selectAll(`.${this.dotClass}`)
      .data(data)
      .enter()
      .append('circle')
      .attr('class', this.dotClass)
      .attr('r', 5)
      .attr('cx', (d) => x(d.deliveredDate))
      .attr('cy', (d) => y(d.leadTime))
      .style('cursor', 'pointer')
      .attr('fill', this.color);
    // Define the line generator
    const line = d3
      .line()
      .x((d) => x(d.deliveredDate))
      .y((d) => y(d.leadTime));
    chartArea
      .selectAll('dot-line')
      .data([data])
      .enter()
      .append('path')
      .attr('class', 'dot-line')
      .attr('id', (d) => `line-${d.ticketId}`)
      .attr('d', line)
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('fill', 'none');
  }

  updateGraph(domain) {
    this.updateChartArea(domain);
    const line = d3
      .line()
      .x((d) => this.currentXScale(d.deliveredDate))
      .y((d) => this.currentYScale(d.leadTime));
    this.chartArea.selectAll('.dot-line').attr('d', line);
    this.drawHorizontalLine(this.currentYScale, this.getAvgMovingRange(), 'orange', 'mid');
  }

  getAvgMovingRange() {
    return Math.ceil(this.data.reduce((acc, curr) => acc + curr.leadTime, 0) / this.data.length);
  }
}
export default MovingRangeRenderer;
