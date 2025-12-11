import { ScatterplotRenderer } from '../scatterplot/ScatterplotRenderer.js';
import * as d3 from 'd3';

export class MovingRangeRenderer extends ScatterplotRenderer {
  color = '#0ea5e9';
  timeScale = 'logarithmic';

  constructor(data, workTicketsURL, chartName) {
    super(data);
    this.workTicketsURL = workTicketsURL;
    this.chartName = chartName;
    this.chartType = 'MOVING_RANGE';
    this.dotClass = 'moving-range-dot';
    this.yAxisLabel = 'Moving Range';
    this.limitData = {};
    this.signals = [];
    this.visibleLimits = {};
  }

  renderGraph(graphElementSelector) {
    this.graphElementSelector = graphElementSelector;
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
    this.setupMouseLeaveHandler();
    this.drawLimits();
    this.drawSignals();
  }

  setLimitData(limitData) {
    this.limitData = {
      averageMR: limitData?.averageMR,
      url: limitData?.URL,
    };
    this.topLimit = limitData?.URL;
    this.data.forEach((d) => {
      if (d.value > this.topLimit) {
        this.signals.push(`mr-${d.fromSourceId}-${d.toSourceId}`);
      }
    });
    this.drawLimits();
  }

  setProcessSignalsData(signalsData) {
    this.processSignalsData = {
      largeChange: signalsData?.largeChange || null,
    };
  }

  setActiveProcessSignal(signalType) {
    this.hideSignals();
    this.activeProcessSignal = signalType;
    this.showActiveSignal();
  }

  hideSignals() {
    this.svg.selectAll('.signal-point').classed('signal-point', false).attr('fill', this.color);
  }

  showActiveSignal() {
    if (!this.activeProcessSignal || !this.processSignalsData[this.activeProcessSignal]) {
      return;
    }

    // const signals = this.processSignalsData[this.activeProcessSignal];
    this.drawSignals();
  }

  drawSignals() {
    if (this.signals?.length > 0) {
      this.signals.forEach((id) => {
        this.svg.select(`#${id}`).classed('signal-point', true).transition().duration(200).attr('fill', 'orange');
      });
    }
  }

  drawLimits() {
    // Remove existing limits first
    this.svg.selectAll('[id^="line-"], [id^="text-"]').remove();
    // Draw new limits
    Object.entries(this.limitData).forEach(([limitType, limitValue]) => {
      if (limitValue !== null) {
        this.drawLimit(limitType, limitValue);
      }
    });
    this.updateLimitVisibility();
  }

  drawLimit(limitType, limitValue) {
    const limitConfig = {
      averageMR: { dash: '3 2', text: 'Avg', color: 'purple' },
      url: { dash: '12 8', text: 'URL', color: 'orange' },
    };

    const config = limitConfig[limitType];
    if (config) {
      this.drawHorizontalLine(this.currentYScale, limitValue, config.color, limitType, `${config.text}=${limitValue}`, config.dash);
    }
  }

  setVisibleLimits(limitConfig) {
    this.visibleLimits = { ...limitConfig };
    this.updateLimitVisibility();
  }

  updateLimitVisibility() {
    Object.entries(this.visibleLimits).forEach(([limitType, isVisible]) => {
      const display = isVisible ? 'block' : 'none';
      this.svg.select(`#line-${limitType}`).style('display', display);
      this.svg.select(`#text-${limitType}`).style('display', display);
    });
  }

  populateTooltip(event) {
    this.tooltip.style('pointer-events', 'auto').style('opacity', 0.9);

    if (event.overlappingTickets && event.overlappingTickets.length > 1) {
      // Add header for multiple moving range pairs
      this.tooltip
        .append('div')
        .style('font-weight', 'bold')
        .style('margin-bottom', '8px')
        .text(`${event.overlappingTickets.length} moving range pairs at this point:`);

      event.overlappingTickets.forEach((ticket) => {
        const pairDiv = this.tooltip
          .append('div')
          .style('margin-bottom', '6px')
          .style('padding', '4px')
          .style('border-left', '2px solid #ddd')
          .style('padding-left', '8px');

        const item1Div = pairDiv.append('div').style('margin-bottom', '2px');
        item1Div
          .append('a')
          .style('text-decoration', 'underline')
          .attr('href', `${this.workTicketsURL}`)
          .text(ticket.fromSourceId)
          .attr('target', '_blank')
          .on('click', () => {
            this.hideTooltip();
          });

        const item2Div = pairDiv.append('div');
        item2Div
          .append('a')
          .style('text-decoration', 'underline')
          .attr('href', `${this.workTicketsURL}`)
          .text(ticket.toSourceId)
          .attr('target', '_blank')
          .on('click', () => {
            this.hideTooltip();
          });
      });

      // Optionally add shared information (moving range value, date, etc.)
      if (event.date && event.metrics) {
        this.tooltip.append('div').style('margin-top', '8px').style('font-size', '12px').style('color', '#666').html(`
          <div><strong>Date:</strong> ${event.date}</div>
          <div><strong>Moving Range:</strong> ${event.metrics.movingRange || event.movingRange} days</div>
        `);
      }
    } else {
      this.tooltip
        .append('div')
        .append('a')
        .style('text-decoration', 'underline')
        .attr('href', `${this.workTicketsURL}`)
        .text(event.fromSourceId)
        .attr('target', '_blank')
        .on('click', () => {
          this.hideTooltip();
        });

      this.tooltip
        .append('div')
        .append('a')
        .style('text-decoration', 'underline')
        .attr('href', `${this.workTicketsURL}`)
        .text(event.toSourceId)
        .attr('target', '_blank')
        .on('click', () => {
          this.hideTooltip();
        });
    }
  }

  drawScatterplot(chartArea, data, x, y) {
    // Ensure deliveredDate is a Date object
    const safeData = data.map((d) => ({
      ...d,
      deliveredDate: d.deliveredDate instanceof Date ? d.deliveredDate : new Date(d.deliveredDate),
    }));
    chartArea
      .selectAll(`.${this.dotClass}`)
      .data(safeData)
      .enter()
      .append('circle')
      .attr('class', this.dotClass)
      .attr('id', (d) => `mr-${d.fromSourceId}-${d.toSourceId}`)
      .attr('r', (d) => {
        const overlapping = safeData.filter((item) => item.deliveredDate.getTime() === d.deliveredDate.getTime() && item.value === d.value);
        return overlapping.length > 1 ? 7 : 5;
      })
      .attr('cx', (d) => x(d.deliveredDate))
      .attr('cy', (d) => this.applyYScale(y, d.value))
      .style('cursor', 'pointer')
      .attr('fill', this.color)
      .on('click', (event, d) => this.handleMouseClickEvent(event, { ...d, date: d.deliveredDate }));

    // Define the line generator
    const line = d3
      .line()
      .x((d) => x(d.deliveredDate))
      .y((d) => this.applyYScale(y, d.value));
    chartArea
      .selectAll('dot-line')
      .data([safeData])
      .enter()
      .append('path')
      .attr('class', 'dot-line')
      .attr('id', (d) => `dot-line-${d.sourceId}`)
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
      .y((d) => this.applyYScale(this.currentYScale, d.value));
    this.chartArea.selectAll('.dot-line').attr('d', line);
    this.drawLimits();
    this.drawSignals();
  }

  clearGraph(graphElementSelector) {
    this.svg.select(graphElementSelector).selectAll('*').remove();
  }

  cleanup() {
    this.limitData = {};
    this.visibleLimits = {};
  }
}
