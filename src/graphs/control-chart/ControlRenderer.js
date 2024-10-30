import ScatterplotRenderer from '../scatterplot/ScatterplotRenderer.js';
import * as d3 from 'd3';

class ControlRenderer extends ScatterplotRenderer {
  color = '#0ea5e9';
  timeScale = 'linear';
  connectDots = false;

  constructor(data, avgMovingRangeFunc, chartName) {
    super(data);
    this.chartName = chartName;
    this.chartType = 'CONTROL';
    this.avgMovingRangeFunc = avgMovingRangeFunc;
    this.dotClass = 'control-dot';
    this.yAxisLabel = 'Days';
  }

  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
    this.computeGraphLimits();
    this.drawGraphLimits(this.y);
    this.setupMouseLeaveHandler();
  }

  drawGraphLimits(yScale) {
    this.drawHorizontalLine(yScale, this.topLimit, 'purple', 'top-pb', `UPL=${this.topLimit}`);
    this.drawHorizontalLine(yScale, this.avgLeadTime, 'orange', 'mid-pb', `Avg=${this.avgLeadTime}`);

    if (this.bottomLimit > 0) {
      this.drawHorizontalLine(yScale, this.bottomLimit, 'purple', 'bottom-pb', `LPL=${this.bottomLimit}`);
    } else {
      console.warn('The bottom limit is:', this.bottomLimit);
    }
  }

  computeGraphLimits() {
    this.avgLeadTime = this.getAvgLeadTime();
    const avgMovingRange = this.avgMovingRangeFunc(this.baselineStartDate, this.baselineEndDate);
    this.topLimit = Math.ceil(this.avgLeadTime + avgMovingRange * 2.66);

    this.bottomLimit = Math.ceil(this.avgLeadTime - avgMovingRange * 2.66);
    const maxY = this.y.domain()[1] > this.topLimit ? this.y.domain()[1] : this.topLimit + 5;
    let minY = this.y.domain()[0];
    if (this.bottomLimit > 5) {
      minY = this.y.domain()[0] < this.bottomLimit ? this.y.domain()[0] : this.bottomLimit - 5;
    }
    this.y.domain([minY, maxY]);
  }

  populateTooltip(event) {
    this.tooltip
      .style('pointer-events', 'auto')
      .style('opacity', 0.9)
      .append('p')
      .style('text-decoration', 'underline')
      .text(`${event.deliveredDate}`);
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
      .attr('cy', (d) => this.applyYScale(y, d.leadTime))
      .style('cursor', 'pointer')
      .attr('fill', this.color)
      .on('click', (event, d) => this.handleMouseClickEvent(event, d));
    this.connectDots && this.generateLines(chartArea, data, x, y);
  }

  getAvgLeadTime() {
    const filteredData = this.data.filter((d) => d.deliveredDate >= this.baselineStartDate && d.deliveredDate <= this.baselineEndDate);
    return Math.ceil(filteredData.reduce((acc, curr) => acc + curr.leadTime, 0) / filteredData.length);
  }

  generateLines(chartArea, data, x, y) {
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
    this.computeGraphLimits();
    this.updateChartArea(domain);
    if (this.connectDots) {
      const line = d3
        .line()
        .x((d) => this.currentXScale(d.deliveredDate))
        .y((d) => this.applyYScale(this.currentYScale, d.leadTime));
      this.chartArea.selectAll('.dot-line').attr('d', line);
    }
    this.drawGraphLimits(this.currentYScale);
    this.displayObservationMarkers(this.observations);
  }
}

export default ControlRenderer;
