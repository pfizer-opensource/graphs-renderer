import ScatterplotRenderer from '../scatterplot/ScatterplotRenderer.js';
import * as d3 from 'd3';

class MovingRangeRenderer extends ScatterplotRenderer {
  color = '#0ea5e9';
  timeScale = 'linear';

  constructor(data, avgMovingRange, workTicketsURL, chartName) {
    super(data);
    this.avgMovingRange = avgMovingRange;
    this.workTicketsURL = workTicketsURL;
    this.chartName = chartName;
    this.chartType = 'MOVING_RANGE';
    this.dotClass = 'moving-range-dot';
    this.yAxisLabel = 'Moving Range';
  }

  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.computeGraphLimits();
    this.drawArea();
    this.drawGraphLimits(this.y);
    this.setupMouseLeaveHandler();
  }

  drawGraphLimits(yScale) {
    this.drawHorizontalLine(yScale, this.topLimit, 'purple', 'top-mr', `UPL=${this.topLimit}`);
    this.drawHorizontalLine(yScale, this.avgMovingRange, 'orange', 'mid-mr', `Avg=${this.avgMovingRange}`);
  }

  computeGraphLimits() {
    this.topLimit = 3.27 * this.avgMovingRange;
    const maxY = this.y.domain()[1] > this.topLimit ? this.y.domain()[1] : this.topLimit + 5;
    this.y.domain([this.y.domain()[0], maxY]);
  }

  populateTooltip(event) {
    this.tooltip
      .style('pointer-events', 'auto')
      .style('opacity', 0.9)
      .append('div')
      .append('a')
      .style('text-decoration', 'underline')
      .attr('href', `${this.workTicketsURL}/${event.workItem1}`)
      .text(event.workItem1)
      .attr('target', '_blank');
    this.tooltip
      .append('div')
      .append('a')
      .style('text-decoration', 'underline')
      .attr('href', `${this.workTicketsURL}/${event.workItem2}`)
      .text(event.workItem1)
      .attr('target', '_blank');
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
      .on('click', (event, d) => this.handleMouseClickEvent(event, { ...d, date: d.deliveredDate }));

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
    this.drawGraphLimits(this.currentYScale);
  }
}
export default MovingRangeRenderer;
