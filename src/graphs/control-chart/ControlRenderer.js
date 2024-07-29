import ScatterplotRenderer from '../scatterplot/ScatterplotRenderer.js';

class ControlRenderer extends ScatterplotRenderer {
  color = '#0ea5e9';
  timeScale = 'linear';

  constructor(data, avgMovingRange) {
    super(data);
    this.chartName = 'control';
    this.chartType = 'CONTROL';
    this.avgMovingRange = avgMovingRange;
    this.dotClass = 'control-dot';
    this.yAxisLabel = 'Days';
  }

  setupEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener('change-time-range-moving-range', this.updateBrushSelection.bind(this));
  }

  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
    this.avgLeadTime = this.getAvgLeadTime();
    this.topLimit = Math.ceil(this.avgLeadTime + this.avgMovingRange * 2.66);
    this.bottomLimit = Math.ceil(this.avgLeadTime - this.avgMovingRange * 2.66);
    this.drawHorizontalLine(this.y, this.topLimit, 'purple', 'top');
    this.drawHorizontalLine(this.y, this.avgLeadTime, 'orange', 'center');
    this.bottomLimit > 0 && this.drawHorizontalLine(this.y, this.bottomLimit, 'purple', 'bottom');
  }

  drawScatterplot(chartArea, data, x, y) {
    chartArea
      .selectAll(`.${this.dotClass}`)
      .data(data)
      .enter()
      .append('circle')
      .attr('class', this.dotClass)
      .attr('id', (d) => `control-${d.ticketId}`)
      .attr('data-date', (d) => d.deliveredDate)
      .attr('r', 5)
      .attr('cx', (d) => x(d.deliveredDate))
      .attr('cy', (d) => y(d.leadTime))
      .style('cursor', 'pointer')
      .attr('fill', this.color)
      .on('click', (event, d) => this.handleMouseClickEvent(event, d));
  }

  getAvgLeadTime() {
    return Math.ceil(this.data.reduce((acc, curr) => acc + curr.leadTime, 0) / this.data.length);
  }

  updateGraph(domain) {
    this.updateChartArea(domain);
    this.drawHorizontalLine(this.currentYScale, this.topLimit, 'purple', 'top');
    this.drawHorizontalLine(this.currentYScale, this.avgLeadTime, 'orange', 'center');
    this.bottomLimit > 0 && this.drawHorizontalLine(this.currentYScale, this.bottomLimit, 'purple', 'bottom');
    this.displayObservationMarkers(this.observations);
  }
}

export default ControlRenderer;
