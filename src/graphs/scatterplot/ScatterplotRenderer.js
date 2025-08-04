import { calculateDaysBetweenDates } from '../../utils/utils.js';
import { UIControlsRenderer } from '../UIControlsRenderer.js';

import * as d3 from 'd3';

/**
 * Class representing a Scatterplot graph renderer
 */
export class ScatterplotRenderer extends UIControlsRenderer {
  color = '#0ea5e9';
  currentXScale;
  currentYScale;
  #areMetricsEnabled = false;
  datePropertyName = 'deliveredDate';
  xAxisLabel = 'Time';
  yAxisLabel = '# of delivery days';
  timeScale = 'logarithmic';
  workTicketsURL = '#';
  baselineStartDate;
  baselineEndDate;

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
   */
  constructor(data) {
    super(data);
    this.baselineStartDate = this.data[0].deliveredDate;
    this.baselineEndDate = this.data[this.data.length - 1].deliveredDate;
  }

  /**
   * Sets up an event bus for the renderer to listen to events.
   * @param {Object} eventBus - The event bus for communication.
   */
  setupEventBus(eventBus, timeRangeChartsEvents) {
    this.eventBus = eventBus;
    if (this.eventBus && Array.isArray(timeRangeChartsEvents)) {
      timeRangeChartsEvents.forEach((chart) => {
        this.eventBus.addEventListener(`change-time-range-${chart}`, (newTimeRange) => {
          if (!this.preventEventLoop) {
            this.updateBrushSelection(newTimeRange);
          }
        });
      });
    }
    this.eventBus?.addEventListener('change-time-interval-cfd', (timeInterval) => {
      this.timeInterval = timeInterval;
      this.drawXAxis(this.gx, this.x?.copy().domain(this.selectedTimeRange), this.height, true);
    });
  }

  //region Graph and brush rendering

  /**
   * Renders the Scatterplot graph in a specified DOM element.
   * @param {string} graphElementSelector - The DOM selector for the graph element.
   */
  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
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
          this.eventBus?.emitEvents(`change-time-range-${this.chartName}`, this.selectedTimeRange);
        }
        this.isManualBrushUpdate = true;
      })
      .on('end', ({ selection }) => {
        if (!selection) {
          this.brushGroup.call(this.brush.move, defaultSelectionRange);
        }
      });

    const brushArea = this.addClipPath(svgBrush, `${this.chartName}-brush-clip`, this.width, this.focusHeight - this.margin.top + 1);
    this.drawScatterplot(brushArea, this.data, this.x, this.y.copy().range([this.focusHeight - this.margin.top - 2, 2]));
    this.changeTimeInterval(false);
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
    this.eventBus?.removeAllListeners('change-time-interval-cfd');
    this.eventBus?.removeAllListeners('change-time-range-cfd');
    this.drawBrushSvg(brushElementSelector);
    this.drawSvg(graphElementSelector);
  }

  /**
   * Updates the chart based on the new X-axis domain.
   * @param {Array} domain - The new X-axis domain to update the chart with.
   */
  updateGraph(domain) {
    this.updateChartArea(domain);
  }

  updateChartArea(domain) {
    const maxValue = d3.max(this.data, (d) => (d.deliveredDate <= domain[1] && d.deliveredDate >= domain[0] ? d.leadTime : -1));
    const maxY = this.topLimit ? Math.max(maxValue, this.topLimit + 2) : maxValue;
    this.reportingRangeDays = calculateDaysBetweenDates(domain[0], domain[1]).roundedDays;
    this.currentXScale = this.x.copy().domain(domain);
    this.currentYScale = this.y.copy().domain([1, maxY]).nice();
    const focusData = this.data.filter((d) => d.deliveredDate <= domain[1] && d.deliveredDate >= domain[0]);
    this.changeTimeInterval(false);
    this.drawXAxis(this.gx, this.currentXScale, this.height, true);
    this.drawYAxis(this.gy, this.currentYScale);

    this.chartArea
      .selectAll(`.${this.dotClass}`)
      .attr('cx', (d) => this.currentXScale(d.deliveredDate))
      .attr('cy', (d) => this.applyYScale(this.currentYScale, d.leadTime))
      .attr('fill', this.color);
    return focusData;
  }

  /**
   * Draws the SVG for the Scatterplot graph.
   * @private
   * @param {string} graphElementSelector - The selector where the SVG is to be appended.
   */
  drawSvg(graphElementSelector) {
    this.svg = this.createSvg(graphElementSelector);
  }

  /**
   * Draws a brush SVG element.
   * @private
   * @param {string} brushSelector - The selector where the brush SVG is appended.
   * @returns {d3.Selection} The created SVG element.
   */
  drawBrushSvg(brushSelector) {
    return this.createSvg(brushSelector, this.focusHeight);
  }

  /**
   * Draws the main area of the Scatterplot graph, the percentile lines and the axis labels.
   * @private
   */
  drawArea() {
    this.chartArea = this.addClipPath(this.svg, `${this.chartName}-clip`);
    this.chartArea
      .append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('id', `${this.chartName}-area`)
      .attr('fill', 'transparent');
    this.drawScatterplot(this.chartArea, this.data, this.x, this.y);
  }

  /**
   * Draws the scatterplot.
   * @private
   * @param {d3.Selection} chartArea - The chart area where the scatterplot is drawn.
   * @param {Array} data - The binned data for the scatterplot.
   * @param {d3.Scale} x - The X-axis scale.
   * @param {d3.Scale} y - The Y-axis scale.
   */
  drawScatterplot(chartArea, data, x, y) {
    chartArea
      .selectAll(`.${this.dotClass}`)
      .data(data)
      .enter()
      .append('circle')
      .attr('class', this.dotClass)
      .attr('data-date', (d) => d.deliveredDate)
      .attr('r', 5)
      .attr('cx', (d) => x(d.deliveredDate))
      .attr('cy', (d) => this.applyYScale(y, d.leadTime))
      .style('cursor', 'pointer')
      .attr('fill', this.color);
  }

  //endregion

  setTimeScaleListener(timeScaleSelector) {
    this.timeScaleSelectElement = document.querySelector(timeScaleSelector);
    if (this.timeScaleSelectElement) {
      this.timeScaleSelectElement.value = this.timeScale;
      this.timeScaleSelectElement.addEventListener('change', (event) => {
        this.timeScale = event.target.value;
        this.computeYScale();
        this.updateGraph(this.selectedTimeRange);
        this.renderBrush();
      });
    }
  }

  setBaselineListener(baselineStartDateSelector, baselineEndDateSelector, baselineErrorSelector, namespace) {
    const lastIndex = this.data.length - 1;
    this.baselineStartDateElement = d3.select(baselineStartDateSelector);
    if (this.baselineStartDateElement) {
      this.baselineStartDateElement.attr('min', new Date(this.data[0].deliveredDate).toISOString().split('T')[0]);
      this.baselineStartDateElement.attr('max', new Date(this.data[lastIndex].deliveredDate).toISOString().split('T')[0]);
      this.baselineStartDateElement.on(`change.${namespace}`, (event) => {
        const selectedValue = d3.select(event.target).property('value');
        this.baselineStartDate = new Date(selectedValue);

        if (this.baselineEndDate && this.baselineStartDate > this.baselineEndDate) {
          d3.select(baselineErrorSelector).style('display', 'block').text('Start date cannot be later than end date.');

          // Reset the end date to the start date
          this.baselineEndDateElement.property('value', selectedValue);
          this.baselineEndDate = new Date(selectedValue);

          // Hide the error message after 3 seconds
          setTimeout(() => {
            d3.select(baselineErrorSelector).style('display', 'none');
          }, 3000);
        }

        this.updateGraph(this.selectedTimeRange);
      });
    }

    this.baselineEndDateElement = d3.select(baselineEndDateSelector);
    if (this.baselineEndDateElement) {
      this.baselineEndDateElement.attr('min', new Date(this.data[0].deliveredDate).toISOString().split('T')[0]);
      this.baselineEndDateElement.attr('max', new Date(this.data[lastIndex].deliveredDate).toISOString().split('T')[0]);
      this.baselineEndDateElement.on(`change.${namespace}`, (event) => {
        const selectedValue = d3.select(event.target).property('value');
        this.baselineEndDate = new Date(selectedValue);

        if (this.baselineStartDate && this.baselineStartDate > this.baselineEndDate) {
          d3.select(baselineErrorSelector).style('display', 'block').text('End date cannot be earlier than start date.');

          // Reset the start date to the end date
          this.baselineStartDateElement.property('value', selectedValue);
          this.baselineStartDate = new Date(selectedValue);

          // Hide the error message after 3 seconds
          setTimeout(() => {
            d3.select(baselineErrorSelector).style('display', 'none');
          }, 3000);
        }

        this.updateGraph(this.selectedTimeRange);
      });
    }
  }

  //region Axes rendering

  /**
   * Sets up click listener for the X axis.
   */
  setupXAxisControl() {
    this.gx.on('click', () => {
      this.changeTimeInterval(true);
      this.drawXAxis(this.gx, this.x?.copy().domain(this.selectedTimeRange), this.height, true);
    });
  }

  /**
   * Draws the axes for the Scatterplot graph.
   * @private
   */
  drawAxes() {
    this.computeXScale();
    this.computeYScale();
    this.gx = this.svg.append('g');
    this.gy = this.svg.append('g');
    this.drawXAxis(this.gx, this.x, this.height, true);
    this.drawYAxis(this.gy, this.y);
    this.drawAxesLabels(this.svg, this.xAxisLabel, this.yAxisLabel);
  }

  computeYScale() {
    // Start domain from a small positive value: 0.6 to avoid log(0) issues
    const yDomain = [0.5, d3.max(this.data, (d) => d.leadTime)];

    if (this.timeScale === 'logarithmic') {
      this.y = d3
        .scaleLog()
        .base(2)
        .domain(yDomain)
        .range([this.height - 34, 0])
        .nice();
    } else if (this.timeScale === 'linear') {
      this.y = this.computeLinearScale([0, d3.max(this.data, (d) => d.leadTime)], [this.height - 4, 0]).nice();
    }
  }

  applyYScale(yScale, value) {
    if (this.timeScale === 'logarithmic' && value <= 0.5) {
      // Handle zero or negative values explicitly
      return yScale(0.5);
    } else {
      return yScale(value);
    }
  }

  computeXScale() {
    const bufferDays = 5;
    const xExtent = d3.extent(this.data, (d) => d.deliveredDate);
    const minDate = new Date(xExtent[0]);
    const maxDate = new Date(xExtent[1]);
    minDate.setDate(minDate.getDate() - bufferDays);
    maxDate.setDate(maxDate.getDate() + bufferDays);
    const xDomain = [minDate, maxDate];
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
    if (isGraph) {
      const axis = this.createXAxis(x);
      const axisHeight = 20;
      let grayBand = g.select('.axis-background');
      if (grayBand.empty()) {
        grayBand = g
          .append('rect')
          .attr('class', 'axis-background')
          .attr('x', 0)
          .attr('y', 4)
          .attr('width', this.width)
          .attr('height', axisHeight)
          .attr('fill', 'gray')
          .attr('opacity', 0.5)
          .attr('cursor', 'pointer');
      }
      const xAxisGroup = g.attr('class', 'x-axis-group').attr('transform', `translate(0, ${height})`);
      xAxisGroup.call(axis);
      xAxisGroup.selectAll('.tick line').attr('stroke', 'black').attr('opacity', 0.3).attr('y1', 15).attr('y2', -this.height);
      xAxisGroup
        .selectAll('.tick text')
        .attr('fill', 'black')
        .attr('y', axisHeight + 6)
        .attr('dy', '10px');
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
      const axis = this.createXAxis(x, 'months');
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

    if (this.timeScale === 'logarithmic') {
      // Manually add tick for 0.5 value which is rendered as value 0
      gy.append('g')
        .attr('class', 'tick')
        .attr('transform', `translate(0, ${y(0.5)})`) // Position tick line at y(0.5)
        .append('line')
        .attr('x2', this.width)
        .attr('stroke', 'black')
        .attr('opacity', 0.9);

      // Manually add text label for 0.6 value is rendered as value 0
      gy.append('g')
        .attr('class', 'tick')
        .attr('transform', `translate(0, ${y(0.5)})`) // Position text at y(0.5)
        .append('text')
        .attr('x', -4)
        .attr('dy', '.32em')
        .attr('stroke', 'black')
        .text('0');
    }
  }

  //endregion

  //region Observation logging

  /**
   * Sets up observation logging for the renderer.
   * @param {Object} observations - Observations data for the renderer.
   */
  setupObservationLogging(observations) {
    if (observations?.data?.length > 0) {
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
    this.chartArea?.selectAll('.ring')?.remove();
  }

  /**
   * Creates markers on the graph for the observations logged.
   * @private
   */
  #createObservationMarkers() {
    this.chartArea
      .selectAll('ring')
      .data(
        this.data.filter((d) =>
          this.observations?.data?.some((o) => o.work_item.toString() === d.ticketId.toString() && o.chart_type === this.chartType)
        )
      )
      .enter()
      .append('circle')
      .attr('class', 'ring')
      .attr('cx', (d) => this.currentXScale(d.deliveredDate))
      .attr('cy', (d) => this.applyYScale(this.currentYScale, d.leadTime))
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', '2px');
  }

  //endregion

  //region Tooltip

  /**
   * Populates the tooltip's content with event data: ticket id and observation body
   * @private
   * @param {Object} event - The event data for the tooltip.
   */
  populateTooltip(event) {
    this.tooltip
      .style('pointer-events', 'auto')
      .style('opacity', 0.9)
      .append('a')
      .style('text-decoration', 'underline')
      .attr('href', `${this.workTicketsURL}/${event.ticketId}`)
      .text(event.ticketId)
      .attr('target', '_blank')
      .on('click', () => {
        this.hideTooltip();
      });
    event.observationBody && this.tooltip.append('p').text('Observation: ' + event.observationBody);
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
    this.chartArea.on('mousemove', (event) => this.eventBus?.emitEvents(`${this.chartName}-mousemove`, event));
    this.chartArea.on('mouseleave', () => this.eventBus?.emitEvents(`${this.chartName}-mouseleave`));
    this.setupMouseLeaveHandler();
    this.#areMetricsEnabled = true;
  }

  /**
   * Handles mouse click events
   * @param {Object} event - The mouse event object.
   * @param d - The scatterplot graph data entry
   * @private
   */
  handleMouseClickEvent(event, d) {
    // Find all tickets with the same values
    const overlappingTickets = this.data.filter(
      (ticket) => ticket.deliveredDate.getTime() === d.deliveredDate.getTime() && ticket.leadTime === d.leadTime
    );

    let data = {
      ...d,
      tooltipLeft: event.pageX,
      tooltipTop: event.pageY,
      overlappingTickets: overlappingTickets,
      ticketCount: overlappingTickets.length,
    };

    if (this.#areMetricsEnabled && this.observations) {
      const observations = overlappingTickets
        .map((ticket) => this.observations?.data?.find((o) => o.work_item === ticket.ticketId && o.chart_type === this.chartType))
        .filter((obs) => obs);

      data = {
        ...data,
        date: d.deliveredDate,
        metrics: {
          leadTime: d.leadTime,
        },
        observations: observations,
      };
    }

    this.eventBus?.emitEvents(`${this.chartName}-click`, data);
    this.showTooltip(data);
  }

  /**
   * Internal method to set up a handler for mouse leave events on the chart area.
   * @private
   */
  setupMouseLeaveHandler(retries = 10) {
    const svgNode = this.svg?.node();
    if (!svgNode || !svgNode.parentNode) {
      if (retries > 0) {
        setTimeout(() => this.setupMouseLeaveHandler(retries - 1), 100);
      } else {
        console.error('SVG parentNode is not available after retries.');
      }
      return;
    }
    d3.select(svgNode.parentNode).on('mouseleave', (event) => {
      if (event.relatedTarget !== this.tooltip?.node()) {
        this.hideTooltip();
      }
    });
  }

  //endregion

  //region Percentile lines rendering

  #getTextWidth(text, fontSize = '12px', fontFamily = 'Arial') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontSize} ${fontFamily}`;
    const width = context.measureText(text).width;
    return width;
  }

  drawHorizontalLine(yScale, yValue, color, id, text = '', dash = '7') {
    let lineEl = this.svg.select('#line-' + id);
    let textEl = this.svg.select('#text-' + id);

    if (lineEl.empty()) {
      lineEl = this.svg
        .append('line')
        .attr('x1', 0)
        .attr('x2', this.width)
        .attr('id', 'line-' + id)
        .attr('class', 'average-line')
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', dash);
      textEl = this.svg
        .append('text')
        .attr('text-anchor', 'start')
        .attr('id', 'text-' + id)
        .style('font-size', '12px');
    }
    lineEl.attr('y1', this.applyYScale(yScale, yValue)).attr('y2', this.applyYScale(yScale, yValue)).attr('stroke', color);
    if (text) {
      textEl
        .text(text)
        .attr('fill', color)
        .attr('y', this.applyYScale(yScale, yValue) - 4);
      // Measure text width
      const textWidth = this.#getTextWidth(text, '12px');
      const adjustedX = this.width - textWidth;
      textEl.attr('x', adjustedX);
    }
  }

  //endregion
}
