import { calculateDaysBetweenDates, addDaysToDate } from '../../utils/utils.js';
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
   *     "ticketId": "TRON-12349"
   *   }
   * ];
   */
  constructor(data) {
    super(data);
    console.table(data);
  }

  /**
   * Sets up an event bus for the renderer to listen to events.
   * @param {Object} eventBus - The event bus for communication.
   */
  setupEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener('change-time-range-cfd', this.updateBrushSelection.bind(this));
  }

  //region Observation logging

  /**
   * Sets up observation logging for the renderer.
   * @param {Object} observations - Observations data for the renderer.
   * @param {Object} workTicketsURL - The work items base url.
   */
  setupObservationLogging(observations, workTicketsURL) {
    if (observations) {
      this.#createTooltip();
      this.#setupMouseLeaveHandler();
      this.workTicketsURL = workTicketsURL;
      this.displayObservationMarkers(observations);
    }
  }

  /**
   * Displays markers for the observations logged on the graph.
   * @param {Object} observations - Observations data to be marked on the graph.
   */
  displayObservationMarkers(observations) {
    if (observations) {
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
      .data(this.data.filter((d) => this.observations.data.rows.some((o) => o.work_item === d.ticketId)))
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
    this.#clearTooltipContent();
    this.#positionTooltip(event.tooltipLeft, event.tooltipTop);
    this.#populateTooltip(event);
  }

  /**
   * Hides the tooltip.
   */
  hideTooltip() {
    this.tooltip.transition().duration(100).style('opacity', 0).style('pointer-events', 'none');
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
      .attr('href', `#`)
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

  /**
   * Internal method to set up a handler for mouse leave events on the chart area.
   * @private
   */
  #setupMouseLeaveHandler() {
    d3.select(this.svg.node().parentNode).on('mouseleave', (event) => {
      if (event.relatedTarget !== this.tooltip.node()) {
        this.hideTooltip();
      }
    });
  }

  //endregion

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
    const defaultSelectionRange = this.defaultTimeRange.map((d) => this.x(d));
    const svgBrush = this.createSvg(this.brushSelector, this.focusHeight);
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
    this.drawXAxis(svgBrush.append('g'), this.x, '', this.focusHeight - this.margin.top);
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
    this.drawXAxis(this.gx, this.currentXScale, this.timeInterval, this.height);
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
    this.#drawScatterplot(this.chartArea, this.data, this.x, this.y);
    this.#drawPercentileLines(this.svg, this.data, this.y);
    this.drawAxisLabels(this.svg, 'Time', '# of delivery days');
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
      .on('click', (event, d) => {
        if (this.observations) {
          const observation = this.observations.data.rows.find((o) => o.work_item === d.ticketId);
          const data = {
            date: d.delivered,
            ticketId: d.ticketId,
            tooltipLeft: event.pageX,
            tooltipTop: event.pageY,
            observationBody: observation?.body,
            observationId: observation?.id,
          };
          this.#showTooltip(data);
          this.eventBus?.emitEvents('scatterplot-click', data);
        }
      });
  }

  /**
   * Computes the reporting range for the chart based on the number of days.
   * @param {number} noOfDays - The number of days for the reporting range.
   * @returns {Array} The computed start and end dates of the reporting range.
   */
  computeReportingRange(noOfDays) {
    const finalDate = this.data[this.data.length - 1].delivered;
    let endDate = new Date(finalDate);
    let startDate = addDaysToDate(finalDate, -Number(noOfDays));
    if (this.selectedTimeRange) {
      endDate = new Date(this.selectedTimeRange[1]);
      startDate = new Date(this.selectedTimeRange[0]);
      const diffDays = Number(noOfDays) - calculateDaysBetweenDates(startDate, endDate);
      if (diffDays < 0) {
        startDate = addDaysToDate(startDate, -Number(diffDays));
      } else {
        endDate = addDaysToDate(endDate, Number(diffDays));
        if (endDate > finalDate) {
          const diffEndDays = calculateDaysBetweenDates(finalDate, endDate);
          endDate = finalDate;
          startDate = addDaysToDate(startDate, -Number(diffEndDays));
        }
      }
    }
    if (startDate < this.data[0].delivered) {
      startDate = this.data[0].delivered;
    }
    return [startDate, endDate];
  }

  //endregion

  //region Axes rendering

  /**
   * Draws the axes for the Scatterplot graph.
   * @private
   */
  #drawAxes() {
    const xDomain = d3.extent(this.data, (d) => d.delivered);
    this.x = this.computeTimeScale(xDomain, [0, this.width]);
    const yDomain = [0, d3.max(this.data, (d) => d.noOfDays)];
    this.y = this.computeLinearScale(yDomain, [this.height, 0]).nice();

    this.gx = this.svg.append('g');
    this.gy = this.svg.append('g');
    this.drawXAxis(this.gx, this.x, this.timeInterval);
    this.drawYAxis(this.gy, this.y);
  }

  /**
   * Draws the X-axis for the Scatterplot graph.
   * @override
   * @param {d3.Selection} g - The SVG group element where the axis is drawn.
   * @param {d3.Scale} x - The scale to use for the axis.
   * @param {string} [timeInterval] - The time interval for the X-axis ticks.
   * @param {number} [height=this.height] - The height at which to draw the axis.
   */
  drawXAxis(g, x, timeInterval, height = this.height) {
    let axis;
    timeInterval && this.setTimeInterval(timeInterval);
    switch (timeInterval) {
      case 'days':
        axis = d3
          .axisBottom(x)
          .tickArguments([d3.timeDay.every(1)])
          .tickFormat((d) => {
            const date = new Date(d);
            if (date.getUTCDay() === 0) {
              return d3.timeFormat('%a %d/%m')(date);
            }
          });
        break;
      case 'weeks':
        axis = d3.axisBottom(x).ticks(d3.timeWeek);
        break;
      case 'months':
        axis = d3.axisBottom(x).ticks(d3.timeMonth);
        break;
      default:
        axis = d3.axisBottom(x);
    }
    g.call(axis).attr('transform', `translate(0, ${height})`);
    const outerXAxisTicks = g.append('g').attr('class', 'outer-ticks').call(axis.tickSize(-height).tickFormat(''));
    outerXAxisTicks.selectAll('.tick line').attr('opacity', 0.1);
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

  //region Percentile lines rendering

  /**
   * Draws percentile lines on the scatterplot.
   * @private
   * @param {d3.Selection} svg - The SVG selection to draw the lines.
   * @param {Array} data - The array of data points.
   * @param {d3.Scale} x - The Y-axis scale.
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
   * @param {d3.Scale} x - The Y-axis scale.
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
