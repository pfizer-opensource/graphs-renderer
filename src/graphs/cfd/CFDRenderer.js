import { addDaysToDate, calculateDaysBetweenDates, areDatesEqual, formatDateToLocalString } from '../../utils/utils.js';
import UIControlsRenderer from '../UIControlsRenderer.js';
import styles from '../tooltipStyles.module.css';
import * as d3 from 'd3';

/**
 * Class representing a Cumulative Flow Diagram (CFD) graph renderer
 */
class CFDRenderer extends UIControlsRenderer {
  #keys = ['delivered', 'verif_start', 'dev_complete', 'in_progress', 'analysis_done', 'analysis_active'];
  #colorPalette = ['#22c55e', '#bbf7d0', '#8b5cf6', '#ddd6fe', '#0ea5e9', '#bae6fd'];
  #colors = d3.scaleOrdinal().domain(this.#keys).range(this.#colorPalette);
  #stackedData;
  currentXScale;
  currentYScale;

  /**
   * Creates a new CFDRenderer instance
   * @constructor
   * @param {Array.<{
   *   date: string,
   *   delivered: number,
   *   verif_start: number,
   *   dev_complete: number,
   *   in_progress: number,
   *   analysis_done: number,
   *   analysis_active: number
   * }>} data - array of ticket objects workflow representing the number of tickets in each state for every day date computed from the data tickets array received in the constructor
   *
   * @example
   *
   * data = [
   *   {
   *     "date": "2023-01-09T15:12:03.000Z",
   *     "delivered": 1,
   *     "verif_start": 101,
   *     "dev_complete": 35,
   *     "in_progress": 19,
   *     "analysis_done": 0,
   *     "analysis_active": 0
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
    this.eventBus?.addEventListener('change-time-range-scatterplot', this.updateBrushSelection.bind(this));
  }

  //region Observation logging

  /**
   * Sets up observation logging for the renderer.
   * @param {Object} observations - Observations data for the renderer.
   */
  setupObservationLogging(observations) {
    if (observations) {
      this.#createTooltipAndMovingLine();
      this.#setupMouseLeaveHandler();
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
      this.#createObservationMarkers(observations);
    }
  }

  /**
   * Creates markers on the graph for the observations logged.
   * @private
   */
  #createObservationMarkers(observations) {
    const triangleHeight = 12;
    const triangleBase = 8;
    const trianglePath = `M0,0 L${triangleBase},0 L${triangleBase / 2},-${triangleHeight} Z`;
    this.chartArea
      .selectAll('observations')
      .data(observations.data.rows.filter((d) => d.chart_type === 'CFD'))
      .join('path')
      .attr('class', 'observation-marker')
      .attr('d', trianglePath)
      .attr('transform', (d) => {
        const date = new Date(d.date_from);
        date.setHours(0, 0, 0, 0);
        return `translate(${this.currentXScale(date)}, ${this.height})`;
      })
      .style('fill', 'black');
  }

  //endregion

  //region Tooltip

  /**
   * Shows the tooltip and the moving line at a specific position
   * @param {Object} event - The event object containing details: coordinates for the tooltip and line.
   * @private
   */
  #showTooltipAndMovingLine(event) {
    const tooltipWidth = this.cfdTooltip.node().getBoundingClientRect().width;
    this.#clearTooltipAndMovingLine(event.lineX, event.lineY);
    this.#positionTooltip(event.tooltipLeft, event.tooltipTop, tooltipWidth);
    this.#populateTooltip(event);
  }

  /**
   * Hides the tooltip and the moving line on the chart.
   */
  hideTooltipAndMovingLine() {
    this.cfdTooltip.transition().duration(100).style('opacity', 0).style('pointer-events', 'none');
    this.cfdLine.transition().duration(100).style('display', 'none');
  }

  /**
   * Creates a tooltip and a moving line for the chart used for the metrics and observation logging.
   * @private
   */
  #createTooltipAndMovingLine() {
    this.cfdTooltip = d3.select('body').append('div').attr('class', styles.tooltip).attr('id', 'c-tooltip').style('opacity', 0);
    this.cfdLine = this.chartArea.append('line').attr('id', 'cfd-line').attr('stroke', 'black').style('display', 'none');
  }

  /**
   * Populates the tooltip's content with event data: data, metrics and observation body
   * @private
   * @param {Object} event - The event data for the tooltip.
   */
  #populateTooltip(event) {
    this.cfdTooltip.style('pointer-events', 'auto').style('opacity', 0.9).append('p').text(formatDateToLocalString(event.date));
    event.metrics.averageCycleTime > 0 && this.cfdTooltip.append('p').text(`Average cycle time: ${event.metrics.averageCycleTime} days`);
    event.metrics.averageLeadTime > 0 && this.cfdTooltip.append('p').text(`Average lead time: ${event.metrics.averageLeadTime} days`);
    event.metrics.throughput > 0 && this.cfdTooltip.append('p').text(`Throughput: ${event.metrics.throughput} tickets`);
    event.observationBody && this.cfdTooltip.append('p').text('Observation: ' + event.observationBody);
  }

  /**
   * Positions the tooltip on the page.
   * @private
   * @param {number} left - The left position for the tooltip.
   * @param {number} top - The top position for the tooltip.
   * @param {number} width - The width for the tooltip.
   */
  #positionTooltip(left, top, width) {
    this.cfdTooltip.transition().duration(100).style('opacity', 0.9).style('pointer-events', 'auto');
    this.cfdTooltip.style('left', left - width + 'px').style('top', top + 'px');
  }

  /**
   * Clears the content of the tooltip and the moving line.
   * @private
   */
  #clearTooltipAndMovingLine(x, y) {
    this.cfdLine.attr('stroke', 'black').attr('y1', 0).attr('y2', y).attr('x1', x).attr('x2', x).style('display', null);
    this.cfdTooltip.selectAll('*').remove();
  }

  /**
   * Handles mouse events on the chart area by displaying the tooltip with the computed metrics and the moving line.
   * It also sends the metrics data on the event bus for the specified eventName
   * @param {Object} event - The mouse event object.
   * @param {string} eventName - The name of the event to be triggered.
   * @private
   */
  #handleMouseEvent(event, eventName) {
    if (this.observations) {
      const coords = d3.pointer(event, d3.select('#cfd-clip').node()); // Get the mouse x-position
      const xPosition = coords[0];
      const yPosition = coords[1];
      const date = this.currentXScale.invert(xPosition);
      const cumulativeCountOfWorkItems = this.currentYScale.invert(yPosition);
      const metrics = this.#computeMetrics(date, Math.floor(cumulativeCountOfWorkItems));
      const observation = this.observations.data.rows.find((o) => o.chart_type === 'CFD' && areDatesEqual(o.date_from, date));
      const data = {
        date: date,
        lineX: xPosition,
        lineY: this.height,
        tooltipLeft: event.pageX,
        tooltipTop: event.pageY,
        metrics: metrics,
        observationBody: observation?.body,
        observationId: observation?.id,
      };
      this.#showTooltipAndMovingLine(data);
      this.eventBus?.emitEvents(eventName, data);
    }
  }

  /**
   * Internal method to set up a handler for mouse leave events on the chart area.
   * @private
   */
  #setupMouseLeaveHandler() {
    this.chartArea.on('mouseleave', () => this.hideTooltipAndMovingLine());
  }

  //endregion

  //region Graph and brush rendering

  /**
   * Renders the CFD graph in a specified DOM element.
   * @param {string} graphElementSelector - Selector of the DOM element to render the graph.
   */
  renderGraph(graphElementSelector) {
    this.#drawSvg(graphElementSelector);
    this.svg.append('g').attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
    this.#drawAxes();
    this.#drawArea();
  }

  /**
   * Renders a brush component with the time range selection.
   */
  renderBrush() {
    const svgBrush = this.#drawBrushSvg(this.brushSelector);
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
          this.eventBus?.emitEvents('change-time-range-cfd', this.selectedTimeRange);
        }
        this.isManualBrushUpdate = true;
      })
      .on('end', ({ selection }) => {
        if (!selection) {
          this.brushGroup.call(this.brush.move, defaultSelectionRange);
        }
      });

    const brushArea = this.#computeArea(this.x, this.y.copy().range([this.focusHeight - this.margin.top, 4]));
    this.#drawStackedAreaChart(svgBrush, this.#stackedData, brushArea);
    this.drawXAxis(svgBrush.append('g'), this.x, '', this.focusHeight - this.margin.top);
    this.brushGroup = svgBrush.append('g');
    this.brushGroup.call(this.brush).call(
      this.brush.move,
      this.selectedTimeRange.map((d) => this.x(d))
    );
  }

  /**
   * Clears the CFD graph and brush from the specified DOM elements.
   * @param {string} graphElementSelector - Selector of the DOM element to clear the graph.
   * @param {string} cfdBrushElementSelector - Selector of the DOM element to clear the brush.
   */
  clearGraph(graphElementSelector, cfdBrushElementSelector) {
    this.#drawBrushSvg(cfdBrushElementSelector);
    this.#drawSvg(graphElementSelector);
    this.#drawAxes();
  }

  /**
   * Updates the chart based on the new X-axis domain.
   * @param {Array} domain - The new X-axis domain to update the chart with.
   */
  updateGraph(domain) {
    const maxY = d3.max(this.#stackedData[this.#stackedData.length - 1], (d) => (d.data.date <= domain[1] ? d[1] : -1));
    this.setReportingRangeDays(calculateDaysBetweenDates(domain[0], domain[1]));
    this.currentXScale = this.x.copy().domain(domain);
    this.currentYScale = this.y.copy().domain([0, maxY]).nice();
    this.drawXAxis(this.gx, this.currentXScale, this.timeInterval, this.height);
    this.drawYAxis(this.gy, this.currentYScale);

    this.chartArea
      .selectAll('path')
      .attr('class', (d) => 'area ' + d.key)
      .style('fill', (d) => this.#colors(d.key))
      .attr('d', this.#computeArea(this.currentXScale, this.currentYScale));
    this.displayObservationMarkers(this.observations);
  }

  /**
   * Draws the SVG element for the CFD graph.
   * @private
   * @param {string} graphElementSelector - The selector where the SVG is appended.
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
   * Draws the stacked area of the CFD graph, the axis labels and the legend.
   * @private
   */
  #drawArea() {
    const area = this.#computeArea(this.x, this.y);
    this.chartArea = this.addClipPath(this.svg, 'cfd-clip');
    this.chartArea.append('rect').attr('width', '100%').attr('height', '100%').attr('id', 'cfd-area').attr('fill', 'transparent');
    this.chartArea.on('mousemove', (event) => this.#handleMouseEvent(event, 'cfd-mousemove'));
    this.chartArea.on('click', (event) => this.#handleMouseEvent(event, 'cfd-click'));
    this.#drawStackedAreaChart(this.chartArea, this.#stackedData, area);
    this.drawAxisLabels(this.svg, 'Time', '# of tickets');
    this.#drawLegend();
  }

  /**
   * Computes the stacked data for the CFD graph.
   * @private
   * @returns {Array} The computed stacked data.
   */
  #computeStackData() {
    const stack = d3.stack().keys(this.#keys);
    return stack(this.data);
  }

  /**
   * Computes the area for the stacked area chart.
   * @private
   * @param {d3.Scale} x - The X-axis scale.
   * @param {d3.Scale} y - The Y-axis scale.
   * @returns {d3.Area} The computed area.
   */
  #computeArea(x, y) {
    return d3
      .area()
      .x((d) => x(d.data.date))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]));
  }

  /**
   * Draws a stacked area chart on the specified chart area.
   * @private
   * @param {d3.Selection} chartArea - The chart area where the stacked area chart is drawn.
   * @param {Array} data - The data for the stacked area chart.
   * @param {d3.Area} area - The area for the stacked area chart.
   */
  #drawStackedAreaChart(chartArea, data, area) {
    chartArea
      .selectAll('areas')
      .data(data)
      .join('path')
      .attr('class', (d) => 'area ' + d.key)
      .style('fill', (d) => this.#colors(d.key))
      .attr('d', area);
  }

  /**
   * Draws the legend for the colored areas in the CFD graph.
   * @private
   */
  #drawLegend() {
    const rectSize = 14;
    const textSize = 120 + rectSize;
    const startX = 80;
    const startY = this.height + 40;
    this.svg
      .selectAll('legend-rects')
      .data(this.#keys)
      .join('rect')
      .attr('x', (_, i) => textSize * i + startX)
      .attr('y', startY)
      .attr('width', rectSize)
      .attr('height', rectSize)
      .style('fill', (d) => this.#colors(d));

    this.svg
      .selectAll('legend-labels')
      .data(this.#keys)
      .join('text')
      .attr('x', (_, i) => rectSize + 6 + i * textSize + startX)
      .attr('y', startY + rectSize / 2)
      .style('fill', 'black')
      .text((d) => d)
      .attr('text-anchor', 'left')
      .style('alignment-baseline', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '500');
  }

  /**
   * Computes the reporting range for the chart based on the number of days.
   * @param {number} noOfDays - The number of days for the reporting range.
   * @returns {Array} The computed start and end dates of the reporting range.
   */
  computeReportingRange(noOfDays) {
    const finalDate = this.data[this.data.length - 1].date;
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
    if (startDate < this.data[0].date) {
      startDate = this.data[0].date;
    }
    return [startDate, endDate];
  }

  //endregion

  //region Axes rendering

  /**
   * Draws the axes for the CFD graph.
   * @private
   */
  #drawAxes() {
    this.#stackedData = this.#computeStackData();
    const xDomain = d3.extent(this.data, (d) => d.date);
    this.x = this.computeTimeScale(xDomain, [0, this.width]);
    const yDomain = [0, d3.max(this.#stackedData[this.#stackedData.length - 1], (d) => d[1])];
    this.y = this.computeLinearScale(yDomain, [this.height, 0]).nice();

    this.gx = this.svg.append('g');
    this.gy = this.svg.append('g');
    this.drawXAxis(this.gx, this.x, this.timeInterval);
    this.drawYAxis(this.gy, this.y);
  }

  /**
   * Draws the X-axis with the specified settings.
   * @param {d3.Selection} g - The group element where the axis is drawn.
   * @param {d3.Scale} x - The scale to use for the axis.
   * @param {string} timeInterval - The time interval.
   * @param {number} height - The height of the axis.
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
  }

  //endregion

  //region Metric

  /**
   * Computes the CFD metrics for a given date and cumulative count.
   * @private
   * @param {Date} currentDate - The current date for metrics computation.
   * @param {number} currentCumulativeCount - The current cumulative count of items.
   * @returns {Object} The computed metrics.
   */
  #computeMetrics(currentDate, currentCumulativeCount) {
    currentDate = new Date(currentDate);
    const currentDataEntry = this.data.find((d) => areDatesEqual(new Date(d.date), currentDate));
    const currentStateIndex = this.#getCurrentStateIndex(currentCumulativeCount, currentDataEntry);
    const currentStateCumulativeCount = this.#getNoOfItems(currentDataEntry, this.#keys[currentStateIndex]);
    const currentDeliveredItems = currentDataEntry.delivered;
    let cycleTimeDateBefore = null;
    let leadTimeDateBefore = null;
    for (const entry of this.data) {
      const entryDate = new Date(entry.date);
      const cycleTimeCumulativeCount = this.#getNoOfItems(entry, this.#keys[currentStateIndex + 1]);
      const leadTimeCumulativeCount = this.#getNoOfItems(entry, this.#keys[this.#keys.length - 1]);
      if (entryDate < currentDate && cycleTimeCumulativeCount <= currentStateCumulativeCount) {
        cycleTimeDateBefore = entryDate;
      }
      if (entryDate < currentDate && leadTimeCumulativeCount <= currentDeliveredItems) {
        leadTimeDateBefore = entryDate;
      }
    }
    const averageCycleTime =
      cycleTimeDateBefore && currentDate ? Math.floor(calculateDaysBetweenDates(cycleTimeDateBefore, currentDate)) : null;
    const averageLeadTime =
      leadTimeDateBefore && currentDate ? Math.floor(calculateDaysBetweenDates(leadTimeDateBefore, currentDate)) : null;
    let throughput = 0;
    if (averageLeadTime) {
      const diff = (this.#getNoOfItems(currentDataEntry, this.#keys[this.#keys.length - 1]) - currentDeliveredItems) / averageLeadTime;
      throughput = parseFloat(diff.toFixed(2));
    }
    return {
      currentState: this.#keys[currentStateIndex],
      cycleTimeDateBefore: formatDateToLocalString(cycleTimeDateBefore),
      leadTimeDateBefore: formatDateToLocalString(leadTimeDateBefore),
      averageCycleTime,
      averageLeadTime,
      throughput,
    };
  }

  /**
   * Computes the number of items in a given state.
   * @private
   * @param {Object} currentData - The current data entry.
   * @param {string} state - The state to count items for.
   * @returns {number} The count of items in the specified state.
   */
  #getNoOfItems(currentData, state) {
    let cumulativeCount = 0;
    const lastIndex = this.#keys.indexOf(state);
    for (let stateIndex = 0; stateIndex <= lastIndex; stateIndex++) {
      cumulativeCount += currentData[this.#keys[stateIndex]];
    }
    return cumulativeCount;
  }

  /**
   * Determines the current state index based on the cumulative count of items.
   * @private
   * @param {number} currentCumulativeCount - The current cumulative count of items.
   * @param {Object} currentDataEntry - The current data entry.
   * @returns {number} The index of the current state.
   */
  #getCurrentStateIndex(currentCumulativeCount, currentDataEntry) {
    let cumulativeCount = 0;
    for (let stateIndex = 0; stateIndex < this.#keys.length; stateIndex++) {
      cumulativeCount += currentDataEntry[this.#keys[stateIndex]];
      if (currentCumulativeCount <= cumulativeCount) {
        return stateIndex;
      }
    }
    return -1;
  }

  //endregion
}

export default CFDRenderer;
