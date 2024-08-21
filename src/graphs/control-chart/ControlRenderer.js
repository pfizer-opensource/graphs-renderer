import ScatterplotRenderer from '../scatterplot/ScatterplotRenderer.js';
import * as d3 from 'd3';

class ControlRenderer extends ScatterplotRenderer {
  color = '#0ea5e9';
  timeScale = 'linear';
  connectDots = false;

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

    this.avgLeadTime = this.getAvgLeadTime();
    this.topLimit = Math.ceil(this.avgLeadTime + this.avgMovingRange * 2.66);

    this.bottomLimit = Math.ceil(this.avgLeadTime - this.avgMovingRange * 2.66);
    const maxY = this.y.domain()[1] > this.topLimit ? this.y.domain()[1] : this.topLimit + 2;
    let minY = this.y.domain()[0];
    if (this.bottomLimit > 0) {
      minY = this.y.domain()[0] < this.bottomLimit ? this.y.domain()[0] : this.bottomLimit - 2;
    }
    this.y.domain([minY, maxY]);
    this.drawArea();
    this.drawHorizontalLine(this.y, this.topLimit, 'purple', 'top');
    this.drawHorizontalLine(this.y, this.avgLeadTime, 'orange', 'center');
    if (this.bottomLimit > 0) {
      this.drawHorizontalLine(this.y, this.bottomLimit, 'purple', 'bottom');
    } else {
      console.warn('The bottom limit is:', this.bottomLimit);
    }
    this.setupMouseLeaveHandler();
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
    return Math.ceil(this.data.reduce((acc, curr) => acc + curr.leadTime, 0) / this.data.length);
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
    this.updateChartArea(domain);
    if (this.connectDots) {
      const line = d3
        .line()
        .x((d) => this.currentXScale(d.deliveredDate))
        .y((d) => this.applyYScale(this.currentYScale, d.leadTime));
      this.chartArea.selectAll('.dot-line').attr('d', line);
    }
    this.drawHorizontalLine(this.currentYScale, this.topLimit, 'purple', 'top');
    this.drawHorizontalLine(this.currentYScale, this.avgLeadTime, 'orange', 'center');
    this.bottomLimit > 0 && this.drawHorizontalLine(this.currentYScale, this.bottomLimit, 'purple', 'bottom');
    this.displayObservationMarkers(this.observations);
  }
}

export default ControlRenderer;
