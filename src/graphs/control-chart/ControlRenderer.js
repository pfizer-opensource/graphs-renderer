import { ScatterplotRenderer } from '../scatterplot/ScatterplotRenderer.js';
import * as d3 from 'd3';

export class ControlRenderer extends ScatterplotRenderer {
  color = '#0ea5e9';
  timeScale = 'logarithmic';
  connectDots = false;

  constructor(data, chartName, workTicketsURL) {
    super(data);
    this.chartName = chartName;
    this.chartType = 'CONTROL';
    this.workTicketsURL = workTicketsURL;
    this.dotClass = 'control-dot';
    this.yAxisLabel = 'Days';
    this.limitData = {};
    this.processSignalsData = {};
    this.visibleLimits = {};
    this.activeProcessSignal = null;
  }

  setLimitData(limitData) {
    this.limitData = {
      naturalProcessLimits: limitData?.naturalProcessLimits || null,
      twoSigma: limitData?.twoSigma || null,
      oneSigma: limitData?.oneSigma || null,
      averageCycleTime: limitData?.averageCycleTime || null,
    };
    this.topLimit = limitData?.naturalProcessLimits?.upper;
    this.drawLimits();
  }

  setProcessSignalsData(signalsData) {
    this.processSignalsData = {
      largeChange: signalsData?.largeChange || null,
      moderateChange: signalsData?.moderateChange || null,
      moderateSustainedShift: signalsData?.moderateSustainedShift || null,
      smallSustainedShift: signalsData?.smallSustainedShift || null,
    };
  }

  setVisibleLimits(limitConfig) {
    this.visibleLimits = { ...limitConfig };
    this.updateLimitVisibility();
  }

  setActiveProcessSignal(signalType) {
    this.hideSignals();
    this.activeProcessSignal = signalType;
    this.showActiveSignal();
  }

  drawLimits() {
    // Remove existing limits first
    this.svg.selectAll('[id^="line-"], [id^="text-"]').remove();

    // Draw new limits
    Object.entries(this.limitData).forEach(([limitType, limitValue]) => {
      if (limitValue) {
        this.drawLimit(limitType, limitValue);
      }
    });

    this.updateLimitVisibility();
  }

  drawLimit(limitType, limitValue) {
    const limitConfig = {
      naturalProcessLimits: { dash: '3 2', text: 'NPL', color: 'orange' },
      twoSigma: { dash: '12 8', text: '2s', color: 'orange' },
      oneSigma: { dash: '20 10', text: '1s', color: 'orange' },
      averageCycleTime: { dash: '7', text: 'Avg', color: 'purple' },
    };

    const config = limitConfig[limitType];
    if (!config) return;

    if (typeof limitValue === 'number') {
      this.drawHorizontalLine(this.currentYScale, limitValue, config.color, limitType, `${config.text}=${limitValue}`, config.dash);
    } else if (limitValue && typeof limitValue === 'object') {
      if (limitValue.upper !== undefined) {
        this.drawHorizontalLine(
          this.currentYScale,
          limitValue.upper,
          config.color,
          `${limitType}-upper`,
          `${config.text}U=${limitValue.upper}`,
          config.dash
        );
      }
      if (limitValue.lower !== undefined && limitValue.lower > 0) {
        this.drawHorizontalLine(
          this.currentYScale,
          limitValue.lower,
          config.color,
          `${limitType}-lower`,
          `${config.text}L=${limitValue.lower}`,
          config.dash
        );
      }
    }
  }

  updateLimitVisibility() {
    Object.entries(this.visibleLimits).forEach(([limitType, isVisible]) => {
      const display = isVisible ? 'block' : 'none';
      // Handle both single limits and upper/lower pairs
      this.svg.select(`#line-${limitType}`).style('display', display);
      this.svg.select(`#text-${limitType}`).style('display', display);
      this.svg.select(`#line-${limitType}-upper`).style('display', display);
      this.svg.select(`#text-${limitType}-upper`).style('display', display);
      this.svg.select(`#line-${limitType}-lower`).style('display', display);
      this.svg.select(`#text-${limitType}-lower`).style('display', display);
    });
  }

  showActiveSignal() {
    if (!this.activeProcessSignal || !this.processSignalsData[this.activeProcessSignal]) {
      return;
    }

    const signals = this.processSignalsData[this.activeProcessSignal];
    this.drawSignals(signals);
  }

  hideSignals() {
    this.svg.selectAll('.signal-point').classed('signal-point', false).attr('fill', this.color);
  }

  drawSignals(signals) {
    if (signals.upper && signals.lower) {
      [...signals.upper, ...signals.lower].forEach((id) => {
        this.svg.select(`#control-${id}`).classed('signal-point', true).transition().duration(200).attr('fill', 'orange');
      });
    }
  }

  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
    this.drawLimits();
    this.showActiveSignal();
  }

  populateTooltip(event) {
    this.tooltip.style('pointer-events', 'auto').style('opacity', 0.9);

    if (event.overlappingTickets && event.overlappingTickets.length > 1) {
      // Add header for multiple tickets
      this.tooltip
        .append('div')
        .style('font-weight', 'bold')
        .style('margin-bottom', '8px')
        .text(`${event.overlappingTickets.length} tickets at this point:`);

      event.overlappingTickets.forEach((ticket) => {
        const ticketDiv = this.tooltip.append('div').style('margin-bottom', '4px');

        ticketDiv
          .append('a')
          .style('text-decoration', 'underline')
          .attr('href', `${this.workTicketsURL}/${ticket.ticketId}`)
          .text(ticket.ticketId)
          .attr('target', '_blank')
          .on('click', () => {
            this.hideTooltip();
          });
      });

      // Optionally add shared information (date, lead time)
      if (event.date && event.metrics) {
        this.tooltip.append('div').style('margin-top', '8px').style('font-size', '12px').style('color', '#666').html(`
          <div><strong>Date:</strong> ${event.date}</div>
          <div><strong>Lead Time:</strong> ${event.metrics.leadTime} days</div>
        `);
      }
    } else {
      this.tooltip
        .append('div')
        .append('a')
        .style('text-decoration', 'underline')
        .attr('href', `${this.workTicketsURL}/${event.ticketId}`)
        .text(event.ticketId)
        .attr('target', '_blank')
        .on('click', () => {
          this.hideTooltip();
        });
    }
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
      .attr('r', (d) => {
        const overlapping = data.filter(
          (item) => item.deliveredDate.getTime() === d.deliveredDate.getTime() && item.leadTime === d.leadTime
        );
        return overlapping.length > 1 ? 7 : 5;
      })
      .attr('cx', (d) => x(d.deliveredDate))
      .attr('cy', (d) => this.applyYScale(y, d.leadTime))
      .style('cursor', 'pointer')
      .attr('fill', this.color)
      .on('click', (event, d) => this.handleMouseClickEvent(event, d));
    this.connectDots && this.generateLines(chartArea, data, x, y);
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
      .attr('id', (d) => `dot-line-${d.ticketId}`)
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
    this.drawLimits();
    this.showActiveSignal();
    this.displayObservationMarkers(this.observations);
  }

  cleanup() {
    this.limitData = {};
    this.processSignalsData = {};
    this.visibleLimits = {};
    this.activeProcessSignal = null;
  }
}
