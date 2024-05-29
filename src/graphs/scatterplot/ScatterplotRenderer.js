import { calculateDaysBetweenDates } from '../../utils/utils.js';
import UIControlsRenderer from '../UIControlsRenderer.js';
import styles from '../tooltipStyles.module.css';

import * as d3 from 'd3';

/**
 * Class representing a Scatterplot graph renderer
 */
class ScatterplotRenderer extends UIControlsRenderer {
  #color = '#0ea5e9';
  currentXScale;
  currentYScale;
  #areMetricsEnabled = false;
  datePropertyName = 'delivered';
  xAxisLabel = 'Time';
  yAxisLabel = '# of delivery days';
  timeIntervalChangeEventName = 'change-time-interval-scatterplot';

  /**
   * Creates a ScatterplotRenderer instance
   * @constructor
   * @param {Array.<{
   *   delivered: string,
   *   noOfDays: number,
   *   ticketId: string
   * }>} data - array of ticket objects containing the ticket number, the number of days it took to be delivered and the delivered date
   *
   * @example
   *
   * data = [
   *   {
   *     "delivered": "2023-01-09T15:12:03.000Z",
   *     "noOfDays": 3,
   *     "ticketId": "T-9125349"
   *   }
   * ];
   * @param workTicketsURL - The tickets base url
   */
  constructor(data, workTicketsURL) {
    super(data);
    this.workTicketsURL = workTicketsURL;
    console.table(data);
  }

  /**
   * Sets up an event bus for the renderer to listen to events.
   * @param {Object} eventBus - The event bus for communication.
   */
  setupEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener('change-time-range-cfd', this.updateBrushSelection.bind(this));
    this.eventBus?.addEventListener('change-time-interval-cfd', () => {
      this.handleXAxisClick();
    });
  }

  //region Graph and brush rendering

  /**
   * Renders the Scatterplot graph in a specified DOM element.
   * @param {string} graphElementSelector - The DOM selector for the graph element.
   */
  renderGraph(graphElementSelector) {
    this.#drawSvg(graphElementSelector);
    this.#drawAxes();
    this.#drawArea();
  }

  /**
   * Renders a brush component with the time range selection.
   */
  renderBrush() {
    const svgBrush = this.createSvg(this.brushSelector, this.focusHeight);
    const defaultSelectionRange = this.defaultTimeRange.map((d) => this.x(d));
    this.brush = d3
      .brushX()
      .extent([
        [0, 1],
        [this.width, this.focusHeight - this.margin.top + 1],
      ])
      .on('brush', ({ selection }) => {
        this.selectedTimeRange = selection.map(this.x.invert, this.x);
        this.updateGraph(this.selectedTimeRange);
        if (this.isManualBrushUpdate && this.eventBus) {
          this.eventBus?.emitEvents('change-time-range-scatterplot', this.selectedTimeRange);
        }
        this.isManualBrushUpdate = true;
      })
      .on('end', ({ selection }) => {
        if (!selection) {
          this.brushGroup.call(this.brush.move, defaultSelectionRange);
        }
      });

    const brushArea = this.addClipPath(svgBrush, 'scatterplot-brush-clip', this.width, this.focusHeight - this.margin.top + 1);
    this.#drawScatterplot(brushArea, this.data, this.x, this.y.copy().range([this.focusHeight - this.margin.top - 2, 2]));
    this.drawXAxis(svgBrush.append('g'), this.x, this.focusHeight - this.margin.top);
    this.brushGroup = brushArea;
    this.brushGroup.call(this.brush).call(
      this.brush.move,
      this.selectedTimeRange.map((d) => this.x(d))
    );
  }

  /**
   * Clears the Scatterplot graph from specified DOM elements.
   * @param {string} graphElementSelector - The selector of the graph element to clear.
   * @param {string} brushElementSelector - The selector of the brush element to clear.
   */
  clearGraph(graphElementSelector, brushElementSelector) {
    this.#drawBrushSvg(brushElementSelector);
    this.#drawSvg(graphElementSelector);
    this.#drawAxes();
  }

  /**
   * Updates the chart based on the new X-axis domain.
   * @param {Array} domain - The new X-axis domain to update the chart with.
   */
  updateGraph(domain) {
    const maxY = d3.max(this.data, (d) => (d.delivered <= domain[1] && d.delivered >= domain[0] ? d.noOfDays : -1));
    this.setReportingRangeDays(calculateDaysBetweenDates(domain[0], domain[1]));
    this.currentXScale = this.x.copy().domain(domain);
    this.currentYScale = this.y.copy().domain([0, maxY]).nice();
    const focusData = this.data.filter((d) => d.delivered <= domain[1] && d.delivered >= domain[0]);
    this.drawXAxis(this.gx, this.currentXScale, this.height);
    this.drawYAxis(this.gy, this.currentYScale);

    this.chartArea
      .selectAll('.dot')
      .attr('cx', (d) => this.currentXScale(d.delivered))
      .attr('cy', (d) => this.currentYScale(d.noOfDays))
      .attr('fill', this.#color);
    this.#drawPercentileLines(this.svg, focusData, this.currentYScale);
    this.displayObservationMarkers(this.observations);
  }

  /**
   * Draws the SVG for the Scatterplot graph.
   * @private
   * @param {string} graphElementSelector - The selector where the SVG is to be appended.
   */
  #drawSvg(graphElementSelector) {
    this.svg = this.createSvg(graphElementSelector);
  }

  /**
   * Draws a brush SVG element.
   * @private
   * @param {string} brushSelector - The selector where the brush SVG is appended.
   * @returns {d3.Selection} The created SVG element.
   */
  #drawBrushSvg(brushSelector) {
    return this.createSvg(brushSelector, this.focusHeight);
  }

  /**
   * Draws the main area of the Scatterplot graph, the percentile lines and the axis labels.
   * @private
   */
  #drawArea() {
    this.chartArea = this.addClipPath(this.svg, 'scatterplot-clip');
    this.chartArea.append('rect').attr('width', '100%').attr('height', '100%').attr('id', 'scatterplot-area').attr('fill', 'transparent');
    this.#drawScatterplot(this.chartArea, this.data, this.x, this.y);
    this.#drawPercentileLines(this.svg, this.data, this.y);
  }

  /**
   * Draws the scatterplot.
   * @private
   * @param {d3.Selection} chartArea - The chart area where the scatterplot is drawn.
   * @param {Array} data - The binned data for the scatterplot.
   * @param {d3.Scale} x - The X-axis scale.
   * @param {d3.Scale} y - The Y-axis scale.
   */
  #drawScatterplot(chartArea, data, x, y) {
    chartArea
      .selectAll('dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('id', (d) => d.ticketId)
      .attr('data-date', (d) => d.delivered)
      .attr('r', 5)
      .attr('cx', (d) => x(d.delivered))
      .attr('cy', (d) => y(d.noOfDays))
      .style('cursor', 'pointer')
      .attr('fill', this.#color)
      .on('click', (event, d) => this.#handleMouseClickEvent(event, d));
  }

  //endregion

  //region Axes rendering

  /**
   * Draws the axes for the Scatterplot graph.
   * @private
   */
  #drawAxes() {
    this.#computeXScale();
    this.#computeYScale();
    this.gx = this.svg.append('g');
    this.gy = this.svg.append('g');
    this.drawXAxis(this.gx, this.x, this.height, true);
    this.drawYAxis(this.gy, this.y);
    this.drawAxesLabels(this.svg, this.xAxisLabel, this.yAxisLabel);
  }

  #computeYScale() {
    const yDomain = [0, d3.max(this.data, (d) => d.noOfDays)];
    this.y = this.computeLinearScale(yDomain, [this.height, 0]).nice();
  }

  #computeXScale() {
    const xDomain = d3.extent(this.data, (d) => d.delivered);
    this.x = this.computeTimeScale(xDomain, [0, this.width]);
  }

  /**
   * Draws the X-axis for the Scatterplot graph.
   * @override
   * @param {d3.Selection} g - The SVG group element where the axis is drawn.
   * @param {d3.Scale} x - The scale to use for the axis.
   * @param {number} [height=this.height] - The height at which to draw the axis.
   * @param isGraph
   */
  drawXAxis(g, x, height = this.height, isGraph = false) {
    const axis = this.createXAxis(x);
    if (isGraph) {
      const axisHeight = 25;
      let grayBand = g.select('.axis-background');
      if (grayBand.empty()) {
        grayBand = g
          .append('rect')
          .attr('class', 'axis-background')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', this.width)
          .attr('height', axisHeight)
          .attr('fill', 'gray')
          .attr('opacity', 0.5)
          .attr('cursor', 'pointer');
      }
      const xAxisGroup = g.attr('class', 'x-axis-group').attr('transform', `translate(0, ${height})`);
      xAxisGroup.call(axis);
      xAxisGroup.selectAll('.tick line').attr('stroke', 'black').attr('opacity', 0.3).attr('y1', 15).attr('y2', -this.height);
      xAxisGroup.selectAll('.tick text').attr('fill', 'black').attr('y', axisHeight).attr('dy', '10px');
      xAxisGroup.select('.domain').remove();
      grayBand.on('mouseover', function () {
        d3.select(this)
          .transition()
          .duration(300)
          .attr('height', axisHeight + 10);
      });
      grayBand.on('mouseout', function () {
        d3.select(this).transition().duration(300).attr('height', axisHeight);
      });
    } else {
      g.call(axis).attr('transform', `translate(0, ${height})`);
      const outerXAxisTicks = g.append('g').attr('class', 'outer-ticks').call(axis?.tickSize(-height).tickFormat(''));
      outerXAxisTicks.selectAll('.tick line').attr('opacity', 0.1);
    }
  }

  /**
   * Sets the Y-scale for the scatterplot based on the data.
   * @param {d3.Selection} gy - The SVG group element where the axis is drawn.
   * @param {d3.Scale} y - The scale to use for the axis.
   *
   */
  drawYAxis(gy, y) {
    const yAxis = d3.axisLeft(y).tickSize(-this.width);
    gy.call(yAxis).selectAll('.tick line').attr('opacity', 0.1);
  }

  //endregion

  //region Observation logging

  /**
   * Sets up observation logging for the renderer.
   * @param {Object} observations - Observations data for the renderer.
   */
  setupObservationLogging(observations) {
    if (observations) {
      this.displayObservationMarkers(observations);
      this.enableMetrics();
    }
  }

  /**
   * Displays markers for the observations logged on the graph.
   * @param {Object} observations - Observations data to be marked on the graph.
   */
  displayObservationMarkers(observations) {
    if (observations?.data) {
      this.observations = observations;
      this.#removeObservationMarkers();
      this.#createObservationMarkers();
    }
  }

  /**
   * Removes observation markers from the chart.
   * @private
   */
  #removeObservationMarkers() {
    this.chartArea.selectAll('.ring').remove();
  }

  /**
   * Creates markers on the graph for the observations logged.
   * @private
   */
  #createObservationMarkers() {
    this.chartArea
      .selectAll('ring')
      .data(this.data.filter((d) => this.observations.data?.some((o) => o.work_item === d.ticketId)))
      .enter()
      .append('circle')
      .attr('class', 'ring')
      .attr('cx', (d) => this.currentXScale(d.delivered))
      .attr('cy', (d) => this.currentYScale(d.noOfDays))
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', '2px');
  }

  //endregion

  //region Tooltip

  /**
   * Shows the tooltip with provided event data.
   * @param {Object} event - The event data for the tooltip.
   */
  #showTooltip(event) {
    !this.tooltip && this.#createTooltip();
    this.#clearTooltipContent();
    this.#positionTooltip(event.tooltipLeft, event.tooltipTop);
    this.#populateTooltip(event);
  }

  /**
   * Hides the tooltip.
   */
  hideTooltip() {
    this.tooltip?.transition().duration(100).style('opacity', 0).style('pointer-events', 'none');
  }

  /**
   * Creates a tooltip for the chart used for the observation logging.
   * @private
   */
  #createTooltip() {
    this.tooltip = d3.select('body').append('div').attr('class', styles.tooltip).attr('id', 's-tooltip').style('opacity', 0);
  }

  /**
   * Populates the tooltip's content with event data: ticket id and observation body
   * @private
   * @param {Object} event - The event data for the tooltip.
   */
  #populateTooltip(event) {
    this.tooltip
      .style('pointer-events', 'auto')
      .style('opacity', 0.9)
      .append('a')
      .style('text-decoration', 'underline')
      .attr('href', `${this.workTicketsURL}/${event.ticketId}`)
      .text(event.ticketId)
      .attr('target', '_blank');
    event.observationBody && this.tooltip.append('p').text('Observation: ' + event.observationBody);
  }

  /**
   * Positions the tooltip on the page.
   * @private
   * @param {number} left - The left position for the tooltip.
   * @param {number} top - The top position for the tooltip.
   */
  #positionTooltip(left, top) {
    this.tooltip.transition().duration(100).style('opacity', 0.9).style('pointer-events', 'auto');
    this.tooltip.style('left', left + 'px').style('top', top + 'px');
  }

  /**
   * Clears the content of the tooltip.
   * @private
   */
  #clearTooltipContent() {
    this.tooltip.selectAll('*').remove();
  }

  //endregion

  //region Metrics

  /**
   * Enables metric tracking on the chart area.
   * It activates mouse event handlers for mouse movement events on the chart area.
   * If metrics are already enabled, the function exits without making changes.
   */
  enableMetrics() {
    if (this.#areMetricsEnabled) {
      return; // Exit the function if metrics are already enabled
    }
    this.chartArea.on('mousemove', (event) => this.eventBus?.emitEvents('scatterplot-mousemove', event));
    this.chartArea.on('mouseleave', () => this.eventBus?.emitEvents('scatterplot-mouseleave'));
    this.#setupMouseLeaveHandler();
    this.#areMetricsEnabled = true;
  }

  /**
   * Handles mouse click events
   * @param {Object} event - The mouse event object.
   * @param d - The scatterplot graph data entry
   * @private
   */
  #handleMouseClickEvent(event, d) {
    let data = {
      ticketId: d.ticketId,
      tooltipLeft: event.pageX,
      tooltipTop: event.pageY,
    };
    if (this.#areMetricsEnabled) {
      const observation = this.observations?.data?.find((o) => o.work_item === d.ticketId);
      data = {
        ...data,
        date: d.delivered,
        metrics: {
          leadTime: d.noOfDays,
        },
        observationBody: observation?.body,
        observationId: observation?.id,
      };
      this.eventBus?.emitEvents('scatterplot-click', data);
    }
    this.#showTooltip(data);
  }

  /**
   * Internal method to set up a handler for mouse leave events on the chart area.
   * @private
   */
  #setupMouseLeaveHandler() {
    d3.select(this.svg.node().parentNode).on('mouseleave', (event) => {
      if (event.relatedTarget !== this.tooltip?.node()) {
        this.hideTooltip();
      }
    });
  }

  //endregion

  //region Percentile lines rendering

  /**
   * Draws percentile lines on the scatterplot.
   * @private
   * @param {d3.Selection} svg - The SVG selection to draw the lines.
   * @param {Array} data - The array of data points.
   * @param {d3.Scale} y - The Y-axis scale.
   */
  #drawPercentileLines(svg, data, y) {
    const dataSortedByNoOfDays = [...data].sort((a, b) => a.noOfDays - b.noOfDays);
    const percentile1 = this.#computePercentileLine(dataSortedByNoOfDays, 0.5);
    const percentile2 = this.#computePercentileLine(dataSortedByNoOfDays, 0.7);
    const percentile3 = this.#computePercentileLine(dataSortedByNoOfDays, 0.85);
    const percentile4 = this.#computePercentileLine(dataSortedByNoOfDays, 0.95);

    percentile1 && this.#drawPercentileLine(svg, y, percentile1, '50%', 'p1');
    percentile2 && this.#drawPercentileLine(svg, y, percentile2, '70%', 'p2');
    percentile3 && this.#drawPercentileLine(svg, y, percentile3, '85%', 'p3');
    percentile4 && this.#drawPercentileLine(svg, y, percentile4, '95%', 'p4');
  }

  /**
   * Computes the value at a specified percentile in the data.
   * @private
   * @param {Array} data - The array of data points.
   * @param {number} percent - The percentile to compute (between 0 and 1).
   * @returns {number} The value at the specified percentile.
   */
  #computePercentileLine(data, percent) {
    const percentileIndex = Math.floor(data.length * percent);
    return data[percentileIndex]?.noOfDays;
  }

  /**
   * Draws a single percentile line on the scatterplot.
   * @private
   * @param {d3.Selection} svg - The SVG selection to draw the line.
   * @param {d3.Scale} y - The Y-axis scale.
   * @param {number} percentile - The percentile value.
   * @param {string} text - The text label for the percentile line.
   * @param {string} percentileId - The unique identifier for the percentile line.
   */
  #drawPercentileLine(svg, y, percentile, text, percentileId) {
    const percentileTextEl = document.getElementById(`y-text-${percentileId}`);
    if (percentileTextEl) {
      svg
        .select(`#y-text-${percentileId}`)
        .attr('x', this.width + 4)
        .attr('y', y(percentile) + 4);
      svg.select(`#y-line-${percentileId}`).attr('x1', 0).attr('x2', this.width).attr('y1', y(percentile)).attr('y2', y(percentile));
    } else {
      svg
        .append('text')
        .attr('text-anchor', 'start')
        .attr('x', this.width + 2)
        .attr('y', y(percentile) + 4)
        .attr('id', `y-text-${percentileId}`)
        .text(text)
        .attr('fill', 'red')
        .style('font-size', '12px');
      svg
        .append('line')
        .attr('id', `y-line-${percentileId}`)
        .style('stroke', 'red')
        .style('stroke-dasharray', '10, 5')
        .style('stroke-width', 2)
        .attr('x1', 0)
        .attr('x2', this.width)
        .attr('y1', y(percentile))
        .attr('y2', y(percentile));
    }
  }

  //endregion
}

export default ScatterplotRenderer;
