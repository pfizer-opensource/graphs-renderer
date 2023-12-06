import { calculateDaysBetweenDates, areDatesEqual, formatDateToLocalString } from '../../utils/utils.js';
import UIControlsRenderer from '../UIControlsRenderer.js';
import styles from '../tooltipStyles.module.css';
import * as d3 from 'd3';

/**
 * Class representing a Cumulative Flow Diagram (CFD) graph renderer
 */
class CFDRenderer extends UIControlsRenderer {
  #colorPalette = ['#22c55e', '#bbf7d0', '#8b5cf6', '#ddd6fe', '#0ea5e9', '#bae6fd'];
  #statesColors;
  #leadTimeColor = 'yellow';
  #cycleTimeColor = 'indigo';
  #wipColor = 'red';
  #stackedData;
  currentXScale;
  currentYScale;
  #areMetricsEnabled = false;
  datePropertyName = 'date';
  xAxisLabel = 'Time';
  yAxisLabel = '# of tickets';
  timeIntervalChangeEventName = 'change-time-interval-cfd';

  /**
   * Creates a new CFDRenderer instance
   * @constructor
   * @param {Array.<{
   *   date: string,
   *   delivered: number,
   *   verification_start: number,
   *   dev_complete: number,
   *   in_progress: number,
   *   analysis_done: number,
   *   analysis_active: number
   * }>} data - array of ticket objects workflow representing the number of tickets in each state for everyday date computed from the data tickets array received in the constructor
   *
   * @param states - the CFD states
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
  constructor(data, states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered']) {
    super(data);
    this.states = states;
    this.#statesColors = d3.scaleOrdinal().domain(this.states).range(this.#colorPalette);
    console.table(this.data);
  }

  /**
   * Sets up an event bus for the renderer to listen to events.
   * @param {Object} eventBus - The event bus for communication.
   */
  setupEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener('change-time-range-scatterplot', this.updateBrushSelection.bind(this));
    this.eventBus?.addEventListener('scatterplot-mousemove', (event) => this.#handleMouseEvent(event, 'scatterplot-mousemove'));
    this.eventBus?.addEventListener('scatterplot-mouseleave', () => this.hideTooltipAndMovingLine());
    this.eventBus?.addEventListener('change-time-interval-scatterplot', () => {
      this.handleXAxisClick();
    });
  }

  //region Graph and brush rendering

  /**
   * Renders the CFD graph in a specified DOM element.
   * @param {string} graphElementSelector - Selector of the DOM element to render the graph.
   */
  renderGraph(graphElementSelector) {
    this.#drawSvg(graphElementSelector);
    this.svg.append('g').attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
    this.#stackedData = this.#computeStackData();
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

    const brushArea = this.#createAreaGenerator(this.x, this.y.copy().range([this.focusHeight - this.margin.top, 4]));
    this.#drawStackedAreaChart(svgBrush, this.#stackedData, brushArea);
    this.drawXAxis(svgBrush.append('g'), this.x, this.focusHeight - this.margin.top);
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
    this.drawXAxis(this.gx, this.currentXScale, this.height);
    this.drawYAxis(this.gy, this.currentYScale);

    this.chartArea
      .selectAll('path')
      .attr('class', (d) => 'area ' + d.key)
      .style('fill', (d) => this.#statesColors(d.key))
      .attr('d', this.#createAreaGenerator(this.currentXScale, this.currentYScale));
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
    this.chartArea = this.addClipPath(this.svg, 'cfd-clip');
    this.chartArea.append('rect').attr('width', '100%').attr('height', '100%').attr('id', 'cfd-area').attr('fill', 'transparent');
    const areaGenerator = this.#createAreaGenerator(this.x, this.y);
    this.#drawStackedAreaChart(this.chartArea, this.#stackedData, areaGenerator);
    this.#drawLegend();
  }

  /**
   * Computes the stacked data for the CFD graph.
   * For more information, see {@link http://using-d3js.com/05_06_stacks.html}.
   * @private
   * @returns {Array} The computed stacked data.
   */
  #computeStackData() {
    const stack = d3.stack().keys(this.states);
    return stack(this.data);
  }

  /**
   * Computes the area generator for the stacked area chart.
   * For more information, see {@link https://d3js.org/d3-shape/area}.
   * @private
   * @param {d3.Scale} x - The X-axis scale.
   * @param {d3.Scale} y - The Y-axis scale.
   * @returns {d3.Area} The computed area.
   */
  #createAreaGenerator(x, y) {
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
   * @param {d3.Area} areaGenerator - The area for the stacked area chart.
   */
  #drawStackedAreaChart(chartArea, data, areaGenerator) {
    chartArea
      .selectAll('areas')
      .data(data)
      .join('path')
      .attr('class', (d) => 'area ' + d.key)
      .style('fill', (d) => this.#statesColors(d.key))
      .attr('d', areaGenerator);
  }

  /**
   * Draws the legend for the colored areas in the CFD graph.
   * @private
   */
  #drawLegend() {
    const rectSize = 14;
    const textSize = 120 + rectSize;
    const startX = 80;
    const startY = this.height + 55;
    const reversedKeys = [...this.states].reverse();
    this.svg
      .selectAll('legend-rects')
      .data(reversedKeys)
      .join('rect')
      .attr('x', (_, i) => textSize * i + startX)
      .attr('y', startY)
      .attr('width', rectSize)
      .attr('height', rectSize)
      .style('fill', (d) => this.#statesColors(d));

    this.svg
      .selectAll('legend-labels')
      .data(reversedKeys)
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

  //endregion

  //region Axes rendering

  /**
   * Draws the axes for the CFD graph.
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

  /**
   * Computes the Y scale.
   * This method determines the domain from the maximum value of the stacked data
   * and sets the range using the graph's height.
   * For more information, see {@link https://d3js.org/d3-scale/linear}.
   * @private
   */
  #computeYScale() {
    const yDomain = [0, d3.max(this.#stackedData[this.#stackedData.length - 1], (d) => d[1])];
    this.y = this.computeLinearScale(yDomain, [this.height, 0]).nice();
  }

  /**
   * Computes the X scale
   * This method determines the domain from the extent of the data's date values
   * and sets the range using the graph's width.
   * For more information, see {@link https://d3js.org/d3-scale/time}.
   * @private
   */
  #computeXScale() {
    const xDomain = d3.extent(this.data, (d) => d.date);
    this.x = this.computeTimeScale(xDomain, [0, this.width]);
  }

  /**
   * Draws the X-axis with the specified settings.
   * @param {d3.Selection} g - The group element where the axis is drawn.
   * @param {d3.Scale} x - The scale to use for the axis.
   * @param {number} height - The height of the axis.
   * @param isGraph
   */
  drawXAxis(g, x, height = this.height, isGraph = false) {
    const axis = this.createXAxis(x);
    const clipId = 'cfd-x-axis-clip';
    this.svg
      .append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.width)
      .attr('height', this.height);
    if (isGraph) {
      const axisGroup = g.call(axis).attr('transform', `translate(0, ${height})`);
      const axisPath = axisGroup
        .selectAll('path')
        .style('stroke', 'gray')
        .style('stroke-width', '40px')
        .style('cursor', 'pointer')
        .style('opacity', '0.5');

      axisPath.on('mouseover', function () {
        d3.select(this).transition().duration(300).style('stroke-width', '50px');
      });
      axisPath.on('mouseout', function () {
        d3.select(this).transition().duration(300).style('stroke-width', '40px');
      });

      g.selectAll('line').attr('y1', 0).attr('y2', 10).style('stroke', 'black').style('opacity', '0.5');
      g.selectAll('text').attr('y', 30).style('fill', 'black');
      g.attr('clip-path', `url(#${clipId})`);
    } else {
      g.call(axis).attr('transform', `translate(0, ${height})`);
    }
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
    const triangleHeight = 16;
    const triangleBase = 11;
    const trianglePath = `M${-triangleBase / 2},0 L${triangleBase / 2},0 L0,-${triangleHeight} Z`;
    this.chartArea
      .selectAll('observations')
      .data(observations.data.filter((d) => d.chart_type === 'CFD'))
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
    !this.tooltip && this.#createTooltipAndMovingLine();
    const tooltipWidth = this.tooltip.node().getBoundingClientRect().width;
    this.#clearTooltipAndMovingLine(event.lineX, event.lineY);
    this.#positionTooltip(event.tooltipLeft, 0, tooltipWidth);
    this.#populateTooltip(event);
  }

  /**
   * Hides the tooltip and the moving line on the chart.
   */
  hideTooltipAndMovingLine() {
    if (this.tooltip) {
      this.tooltip.transition().duration(100).style('opacity', 0).style('pointer-events', 'none');
      this.cfdLine.transition().duration(100).style('display', 'none');
      this.#removeMetricsLines();
    }
  }

  /**
   * Creates a tooltip and a moving line for the chart used for the metrics and observation logging.
   * @private
   */
  #createTooltipAndMovingLine() {
    this.tooltip = d3.select('body').append('div').attr('class', styles.tooltip).attr('id', 'c-tooltip').style('opacity', 0);
    this.cfdLine = this.chartArea.append('line').attr('id', 'cfd-line').attr('stroke', 'black').style('display', 'none');
  }

  /**
   * Positions the tooltip on the page.
   * @private
   * @param {number} left - The left position for the tooltip.
   * @param {number} top - The top position for the tooltip.
   * @param {number} width - The width for the tooltip.
   */
  #positionTooltip(left, top, width) {
    this.tooltip?.transition().duration(100).style('opacity', 0.9).style('pointer-events', 'auto');
    this.tooltip?.style('left', left - width + 'px').style('top', top + 50 + 'px');
  }

  /**
   * Populates the tooltip's content with event data: data, metrics and observation body
   * @private
   * @param {Object} event - The event data for the tooltip.
   */
  #populateTooltip(event) {
    this.tooltip?.append('p').text(formatDateToLocalString(event.date)).attr('class', 'text-center');
    const gridContainer = this.tooltip?.append('div').attr('class', 'grid grid-cols-2 gap-2');
    if (event.metrics.averageCycleTime > 0) {
      gridContainer
        .append('span')
        .text('Cycle time:')
        .attr('class', 'pr-1')
        .style('text-align', 'start')
        .style('color', this.#cycleTimeColor);
      gridContainer
        .append('span')
        .text(`${event.metrics.averageCycleTime} days`)
        .attr('class', 'pl-1')
        .style('text-align', 'start')
        .style('color', this.#cycleTimeColor);
    }
    if (event.metrics.averageLeadTime > 0) {
      gridContainer
        .append('span')
        .text('Lead time:')
        .attr('class', 'pr-1')
        .style('text-align', 'start')
        .style('color', this.#leadTimeColor);
      gridContainer
        .append('span')
        .text(`${event.metrics.averageLeadTime} days`)
        .attr('class', 'pl-1')
        .style('text-align', 'start')
        .style('color', this.#leadTimeColor);
    }
    if (event.metrics.wip > 0) {
      gridContainer.append('span').text('WIP:').attr('class', 'pr-1').style('text-align', 'start').style('color', this.#wipColor);
      gridContainer
        .append('span')
        .text(`${event.metrics.wip} items`)
        .attr('class', 'pl-1')
        .style('text-align', 'start')
        .style('color', this.#wipColor);
    }
    if (event.metrics.throughput > 0) {
      gridContainer.append('span').text('Throughput:').attr('class', 'pr-1').style('text-align', 'start');
      gridContainer.append('span').text(`${event.metrics.throughput} items`).attr('class', 'pl-1').style('text-align', 'start');
    }
    if (event.observationBody) {
      gridContainer.append('span').text('Observation:').attr('class', 'pr-1').style('text-align', 'start');
      gridContainer.append('span').text(`${event.observationBody}`).attr('class', 'pl-1').style('text-align', 'start');
    }
  }

  /**
   * Clears the content of the tooltip and the moving line.
   * @private
   */
  #clearTooltipAndMovingLine(x, y) {
    this.cfdLine?.attr('stroke', 'black').attr('y1', 0).attr('y2', y).attr('x1', x).attr('x2', x).style('display', null);
    this.tooltip?.selectAll('*').remove();
  }

  //endregion

  //region Metrics

  /**
   * Enables metric tracking on the chart area.
   * It activates mouse event handlers for mouse movement and click events on the chart area.
   * If metrics are already enabled, the function exits without making changes.
   */
  enableMetrics() {
    if (this.#areMetricsEnabled) {
      return; // Exit the function if metrics are already enabled
    }
    this.#areMetricsEnabled = true;
    this.chartArea.on('mousemove', (event) => this.#handleMouseEvent(event, 'cfd-mousemove'));
    this.chartArea.on('click', (event) => this.#handleMouseEvent(event, 'cfd-click'));
    this.#setupMouseLeaveHandler();
  }

  /**
   * Handles mouse events on the chart area by displaying the tooltip with the computed metrics and the moving line.
   * It also sends the metrics data on the event bus for the specified eventName
   * @param {Object} event - The mouse event object.
   * @param {string} eventName - The name of the event to be triggered.
   * @private
   */
  #handleMouseEvent(event, eventName) {
    if (this.#areMetricsEnabled) {
      this.#removeMetricsLines();
      const coords = d3.pointer(event, d3.select('#cfd-area').node()); // Get the mouse x-position
      const xPosition = coords[0];
      const yPosition = coords[1];
      const date = this.currentXScale.invert(xPosition);
      const cumulativeCountOfWorkItems = this.currentYScale.invert(yPosition);
      const excludeCycleTime = eventName === 'scatterplot-mousemove';

      const metrics = this.#computeMetrics(date, Math.floor(cumulativeCountOfWorkItems), excludeCycleTime);
      const observation = this.observations?.data?.find((o) => o.chart_type === 'CFD' && areDatesEqual(o.date_from, date));
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
      eventName.includes('click') && this.eventBus?.emitEvents(eventName, data);
    }
  }

  /**
   * Internal method to set up a handler for mouse leave events on the chart area.
   * @private
   */
  #setupMouseLeaveHandler() {
    this.chartArea.on('mouseleave', () => this.hideTooltipAndMovingLine());
  }

  /**
   * Computes the CFD metrics for a given date and cumulative count.
   * @private
   * @param {Date} currentDate - The current date for metrics computation.
   * @param {Number} currentCumulativeCount - The current cumulative count of items.
   * @param {Boolean} excludeCycleTime
   * @returns {Object} The computed metrics.
   */
  #computeMetrics(currentDate, currentCumulativeCount, excludeCycleTime = false) {
    currentDate = new Date(currentDate);
    const currentDataEntry = this.data.find((d) => areDatesEqual(new Date(d.date), currentDate));
    if (currentDataEntry) {
      const currentStateIndex = this.#getCurrentStateIndex(currentCumulativeCount, currentDataEntry);
      const currentStateCumulativeCount =
        currentStateIndex >= 0 ? this.#getNoOfItems(currentDataEntry, this.states[currentStateIndex]) : -1;
      const currentDeliveredItems = currentDataEntry.delivered;
      const { cycleTimeDateBefore, leadTimeDateBefore } = this.#computeCycleAndLeadTimeDates(
        currentDate,
        currentStateCumulativeCount,
        currentDeliveredItems,
        currentStateIndex
      );

      let averageCycleTime = cycleTimeDateBefore ? Math.floor(calculateDaysBetweenDates(cycleTimeDateBefore, currentDate)) : null;
      const averageLeadTime = leadTimeDateBefore ? Math.floor(calculateDaysBetweenDates(leadTimeDateBefore, currentDate)) : null;

      const noOfItemsBefore = this.#getNoOfItems(currentDataEntry, this.states[this.states.indexOf('delivered')]);
      const noOfItemsAfter = this.#getNoOfItems(currentDataEntry, this.states[this.states.indexOf('analysis_active')]);

      const wip = noOfItemsAfter - noOfItemsBefore;
      const throughput = averageLeadTime ? parseFloat((wip / averageLeadTime).toFixed(1)) : undefined;
      excludeCycleTime && (averageCycleTime = null);
      this.#drawMetricLines(
        averageCycleTime,
        averageLeadTime,
        leadTimeDateBefore,
        cycleTimeDateBefore,
        currentDate,
        currentStateCumulativeCount,
        currentDataEntry
      );

      return {
        currentState: this.states[currentStateIndex],
        cycleTimeDateBefore: formatDateToLocalString(cycleTimeDateBefore),
        leadTimeDateBefore: formatDateToLocalString(leadTimeDateBefore),
        wip,
        averageCycleTime,
        averageLeadTime,
        throughput,
      };
    }
    return {};
  }

  /**
   * Computes the dates for cycle time and lead time based on the current state of the data.
   * @param {Date} currentDate - The current date for which the computation is made.
   * @param {number} currentStateCumulativeCount - The cumulative count of items in the current state.
   * @param {number} currentDeliveredItems - The count of delivered items up to the current date.
   * @param {number} currentStateIndex - The index of the current state in the states array.
   * @returns {{cycleTimeDateBefore: Date | null, leadTimeDateBefore: Date | null}}
   *          An object containing the computed cycle time date and lead time date prior to the current date.
   */

  #computeCycleAndLeadTimeDates(currentDate, currentStateCumulativeCount, currentDeliveredItems, currentStateIndex) {
    let cycleTimeDateBefore = null;
    let leadTimeDateBefore = null;
    for (const entry of this.data) {
      const entryDate = new Date(entry.date);
      if (entryDate >= currentDate) continue;

      if (currentStateCumulativeCount >= 0) {
        const cycleTimeCumulativeCount = this.#getNoOfItems(entry, this.states[currentStateIndex + 1]);
        if (cycleTimeCumulativeCount <= currentStateCumulativeCount) cycleTimeDateBefore = entryDate;
      }

      const leadTimeCumulativeCount = this.#getNoOfItems(entry, this.states[this.states.length - 1]);
      if (leadTimeCumulativeCount <= currentDeliveredItems) leadTimeDateBefore = entryDate;
    }
    return { cycleTimeDateBefore, leadTimeDateBefore };
  }

  /**
   * Draws metric lines on the chart for average cycle time, lead time, and work-in-progress (WIP).
   *
   * @param {number|null} averageCycleTime - The average cycle time.
   * @param {number|null} averageLeadTime - The average lead time.
   * @param {Date|null} leadTimeDateBefore - The date before the current date for lead time computation.
   * @param {Date|null} cycleTimeDateBefore - The date before the current date for cycle time computation.
   * @param {Date} currentDate - The current date.
   * @param {number} currentStateCumulativeCount - The cumulative count in the current state.
   * @param {Object} currentDataEntry - The current data entry object.
   * @private
   */
  #drawMetricLines(
    averageCycleTime,
    averageLeadTime,
    leadTimeDateBefore,
    cycleTimeDateBefore,
    currentDate,
    currentStateCumulativeCount,
    currentDataEntry
  ) {
    if (averageLeadTime) {
      this.#drawHorizontalMetricLine(leadTimeDateBefore, currentDate, currentDataEntry.delivered, 'lead-time-line', this.#leadTimeColor, 3);
    }

    if (averageCycleTime) {
      this.#drawHorizontalMetricLine(
        cycleTimeDateBefore,
        currentDate,
        currentStateCumulativeCount,
        'cycle-time-line',
        this.#cycleTimeColor,
        2
      );
    }

    const noOfItemsBefore = this.#getNoOfItems(currentDataEntry, this.states[this.states.indexOf('delivered')]);
    const noOfItemsAfter = this.#getNoOfItems(currentDataEntry, this.states[this.states.indexOf('analysis_active')]);
    this.#drawVerticalMetricLine(currentDate, noOfItemsBefore, noOfItemsAfter, 'wip-line', this.#wipColor);
  }

  /**
   * Draws a horizontal metric line on the chart.
   *
   * @param {Date} dateBefore - The start date for the line.
   * @param {Date} dateAfter - The end date for the line.
   * @param {number} noOfItems - The number of items to determine the y-axis position.
   * @param {string} cssClass - The CSS class for styling the line.
   * @param {string} color - The color of the line.
   * @param {number} width - The width of the line.
   * @private
   */
  #drawHorizontalMetricLine(dateBefore, dateAfter, noOfItems, cssClass, color, width) {
    this.chartArea.selectAll(`.${cssClass}`).remove();
    const x1 = this.currentXScale(dateBefore);
    const x2 = this.currentXScale(dateAfter);
    const y = this.currentYScale(noOfItems);
    this.chartArea
      .append('line')
      .attr('x1', x1)
      .attr('y1', y)
      .attr('x2', x2)
      .attr('y2', y)
      .attr('stroke', color)
      .attr('stroke-width', width)
      .attr('class', cssClass);
  }

  /**
   * Draws a vertical metric line on the chart.
   *
   * @param {Date} date - The date for which the line is drawn.
   * @param {number} noOfItemsBefore - The number of items before the date to determine the start y-axis position.
   * @param {number} noOfItemsAfter - The number of items after the date to determine the end y-axis position.
   * @param {string} cssClass - The CSS class for styling the line.
   * @param {string} color - The color of the line.
   * @private
   */
  #drawVerticalMetricLine(date, noOfItemsBefore, noOfItemsAfter, cssClass, color) {
    this.chartArea.selectAll(`.${cssClass}`).remove();
    const y1 = this.currentYScale(noOfItemsBefore);
    const y2 = this.currentYScale(noOfItemsAfter);
    const x = this.currentXScale(date);
    this.chartArea
      .append('line')
      .attr('x1', x)
      .attr('y1', y1)
      .attr('x2', x)
      .attr('y2', y2)
      .attr('stroke', color)
      .attr('stroke-width', 3)
      .attr('class', cssClass);
  }

  /**
   * Removes all metric lines (work-in-progress, cycle time, and lead time lines) from the chart.
   * @private
   */
  #removeMetricsLines() {
    this.chartArea.selectAll('.wip-line').remove();
    this.chartArea.selectAll('.cycle-time-line').remove();
    this.chartArea.selectAll('.lead-time-line').remove();
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
    const lastIndex = this.states.indexOf(state);
    for (let stateIndex = 0; stateIndex <= lastIndex; stateIndex++) {
      cumulativeCount += currentData[this.states[stateIndex]];
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
    if (currentDataEntry) {
      let cumulativeCount = 0;
      for (let stateIndex = 0; stateIndex < this.states.length; stateIndex++) {
        cumulativeCount += currentDataEntry[this.states[stateIndex]];
        if (currentCumulativeCount <= cumulativeCount) {
          return stateIndex;
        }
      }
    }
    return -1;
  }

  //endregion
}

export default CFDRenderer;
