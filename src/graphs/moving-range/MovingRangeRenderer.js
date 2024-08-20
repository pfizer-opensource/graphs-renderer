import ScatterplotRenderer from '../scatterplot/ScatterplotRenderer.js';
import * as d3 from 'd3';
import { formatDateToNumeric } from '../../utils/utils.js';

class MovingRangeRenderer extends ScatterplotRenderer {
  color = '#0ea5e9';
  timeScale = 'linear';

  constructor(data, avgMovingRange) {
    super(data);
    this.avgMovingRange = avgMovingRange;
    this.chartName = 'moving-range';
    this.chartType = 'MOVING_RANGE';
    this.dotClass = 'moving-range-dot';
  }

  setupEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener('change-time-range-control', this.updateBrushSelection.bind(this));
  }

  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.topLimit = this.avgMovingRange;
    const maxY = this.y.domain()[1] > this.topLimit ? this.y.domain()[1] : this.topLimit + 2;
    this.y.domain([this.y.domain()[0], maxY]);
    this.drawArea();
    this.drawHorizontalLine(this.y, this.topLimit, 'orange', 'mid');
    this.setupMouseLeaveHandler();
  }

  populateTooltip(event) {
    this.tooltip
      .style('pointer-events', 'auto')
      .style('opacity', 0.9)
      .append('p')
      .style('text-decoration', 'underline')
      .text(formatDateToNumeric(`${event.date}`));
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
      .attr('cy', (d) => this.applyYScale(y, d.leadTime))
      .style('cursor', 'pointer')
      .attr('fill', this.color)
      .on('mouseover', (event, d) => this.handleMouseClickEvent(event, { date: d.deliveredDate }));

    // Define the line generator
    const line = d3
      .line()
      .x((d) => x(d.deliveredDate))
      .y((d) => this.applyYScale(y, d.leadTime));
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
      .y((d) => this.applyYScale(this.currentYScale, d.leadTime));
    this.chartArea.selectAll('.dot-line').attr('d', line);
    this.drawHorizontalLine(this.currentYScale, this.avgMovingRange, 'orange', 'mid');
  }
}
export default MovingRangeRenderer;
