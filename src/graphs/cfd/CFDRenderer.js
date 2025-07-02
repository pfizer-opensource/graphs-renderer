import { calculateDaysBetweenDates, areDatesEqual, formatDateToLocalString } from '../../utils/utils.js';
import { UIControlsRenderer } from '../UIControlsRenderer.js';
import styles from '../tooltipStyles.module.css';
import * as d3 from 'd3';

/**
 * Class representing a Cumulative Flow Diagram (CFD) graph renderer
 */
export class CFDRenderer extends UIControlsRenderer {
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
  constructor(data, states, chartName) {
    super(data);
    this.states = states;
    this.chartType = 'CFD';
    this.chartName = chartName;
    this.#statesColors = d3.scaleOrdinal().domain(this.states).range(this.#colorPalette);
  }

  /**
   * Sets up an event bus for the renderer to listen to events.
   * @param {Object} eventBus - The event bus for communication.
   */
  setupEventBus(eventBus, mouseChartsEvents, timeRangeChartsEvents) {
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
    if (this.eventBus && Array.isArray(mouseChartsEvents)) {
      mouseChartsEvents.forEach((chart) => {
        this.eventBus?.addEventListener(`${chart}-mousemove`, (event) => this.#handleMouseEvent(event, `${chart}-mousemove`));
        this.eventBus?.addEventListener(`${chart}-mouseleave`, () => this.hideTooltip());
      });
    }
  }

  //region Graph and brush rendering

  /**
   * Renders the CFD graph in a specified DOM element.
   * @param {string} graphElementSelector - Selector of the DOM element to render the graph.
   */
  renderGraph(graphElementSelector) {
    this.graphElementSelector = graphElementSelector;
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
        this.selectedTimeRange = selection.map(this.x?.invert, this.x);
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

    const brushArea = this.#createAreaGenerator(this.x, this.y.copy().range([this.focusHeight - this.margin.top, 4]));
    this.#drawStackedAreaChart(svgBrush, this.#stackedData, brushArea);
    this.changeTimeInterval(false);
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
    this.eventBus.removeAllListeners('change-time-range-scatterplot');
    this.eventBus.removeAllListeners('scatterplot-mousemove');
    this.eventBus.removeAllListeners('scatterplot-mouseleave');
    this.eventBus.removeAllListeners('change-time-interval-scatterplot');
    this.#drawBrushSvg(cfdBrushElementSelector);
    this.#drawSvg(graphElementSelector);
  }

  /**
   * Updates the chart based on the new X-axis domain.
   * @param {Array} domain - The new X-axis domain to update the chart with.
   */
  updateGraph(domain) {
    const maxY = d3.max(this.#stackedData[this.#stackedData.length - 1], (d) => (d.data.date <= domain[1] ? d[1] : -1));
    this.reportingRangeDays = calculateDaysBetweenDates(domain[0], domain[1]).roundedDays;
    this.currentXScale = this.x.copy().domain(domain);
    this.currentYScale = this.y.copy().domain([0, maxY]).nice();
    this.changeTimeInterval(false);
    this.drawXAxis(this.gx, this.currentXScale, this.height, true);
    this.drawYAxis(this.gy, this.currentYScale);

    this.chartArea
      ?.selectAll('path')
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
    this.chartArea = this.addClipPath(this.svg, `${this.chartName}-clip`);
    this.chartArea
      ?.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('id', `${this.chartName}-area`)
      .attr('fill', 'transparent');
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
   * Sets up click listener for the X axis.
   */
  setupXAxisControl() {
    this.gx.on('click', () => {
      this.changeTimeInterval(true);
      this.drawXAxis(this.gx, this.x.copy().domain(this.selectedTimeRange), this.height, true);
    });
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
    let axis;
    const clipId = `${this.chartName}-x-axis-clip`;
    this.svg
      .append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.width)
      .attr('height', this.height);
    if (isGraph) {
      axis = this.createXAxis(x);
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
      axis = this.createXAxis(x, 'months');
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
    if (observations.data.length > 0) {
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
      ?.selectAll('observations')
      .data(observations?.data?.filter((d) => d.chart_type === this.chartType))
      .join('path')
      .attr('class', 'observation-marker')
      .attr('d', trianglePath)
      .attr('transform', (d) => {
        const date = new Date(d.date_from);
        date.setUTCHours(0, 0, 0, 0);
        return `translate(${this.currentXScale(date)}, ${this.height})`;
      })
      .style('fill', 'black');
  }

  //endregion

  //region Tooltip

  /**
   * Shows the tooltip and the moving line at a specific position
   * @param {Object} event - The event object containing details: coordinates for the tooltip and line.
   */
  showTooltip(event) {
    !this.tooltip && this.createTooltip(event.lineX, event.lineY);
    let { tooltipWidth, tooltipTop } = this.computeTooltipWidthAndTop(event);

    this.clearTooltipContent(event.lineX, event.lineY);
    this.positionTooltip(event.tooltipLeft, tooltipTop, tooltipWidth);
    this.populateTooltip(event);
  }

  computeTooltipWidthAndTop(event) {
    const tooltipRect = this.tooltip.node().getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    const graphRect = d3.select(this.graphElementSelector).node().getBoundingClientRect();
    const padding = 10;
    let tooltipLeft = event.tooltipLeft;
    let tooltipTop = event.lineY - tooltipHeight - padding;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust tooltipLeft to prevent overflow on the right
    if (tooltipLeft + tooltipWidth + padding > viewportWidth) {
      tooltipLeft = viewportWidth - tooltipWidth - padding;
    }

    // Adjust tooltipLeft to prevent overflow on the left
    if (tooltipLeft < padding) {
      tooltipLeft = padding;
    }

    // Adjust tooltipTop to prevent overflow on the top
    if (tooltipTop < graphRect.top) {
      // Position the tooltip below the event point if there's not enough space above
      tooltipTop = event.lineY + padding;

      // Ensure the tooltip doesn't overflow the bottom of the viewport
      if (tooltipTop + tooltipHeight + padding > viewportHeight) {
        tooltipTop = viewportHeight - tooltipHeight - padding;
      }
    }
    return { tooltipWidth, tooltipTop };
  }

  /**
   * Hides the tooltip and the moving line on the chart.
   */
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.transition().duration(100).style('opacity', 0).style('pointer-events', 'none');
      this.cfdLine.transition().duration(100).style('display', 'none');
      this.#removeMetricsLines();
    }
  }

  cleanupTooltip() {
    this.hideTooltip();
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
    if (this.cfdLine) {
      this.cfdLine.remove();
      this.cfdLine = null;
    }
  }

  /**
   * Creates a tooltip and a moving line for the chart used for the metrics and observation logging.
   */
  createTooltip(x, y) {
    this.tooltip = d3.select('body').append('div').attr('class', styles.chartTooltip).attr('id', 'c-tooltip').style('opacity', 0);
    this.cfdLine = this.chartArea
      ?.append('line')
      .attr('id', `${this.chartName}-line`)
      .attr('stroke', 'black')
      .attr('y1', 0)
      .attr('y2', y)
      .attr('x1', x)
      .attr('x2', x)
      .style('display', 'none');
  }

  /**
   * Positions the tooltip on the page.
   * @param {number} left - The left position for the tooltip.
   * @param {number} top - The top position for the tooltip.
   * @param {number} width - The width for the tooltip.
   */
  positionTooltip(left, top, width) {
    this.tooltip?.transition().duration(100).style('opacity', 0.9).style('pointer-events', 'auto');
    this.tooltip?.style('left', left - width + 'px').style('top', top + 'px');
  }

  /**
   * Clears the content of the tooltip and the moving line.
   */
  clearTooltipContent(x, y) {
    this.cfdLine?.attr('stroke', 'black').attr('y1', 0).attr('y2', y).attr('x1', x).attr('x2', x).style('display', null);
    this.tooltip?.selectAll('*').remove();
  }

  /**
   * Populates the tooltip's content with event data: data, metrics and observation body
   * @param {Object} event - The event data for the tooltip.
   */
  populateTooltip(event) {
    this.tooltip?.append('p').text(formatDateToLocalString(event.date)).attr('class', styles.tooltipDate);

    const gridContainer = this.tooltip?.append('div').attr('class', styles.tooltipGrid);

    if (event.metrics?.averageCycleTime > 0) {
      gridContainer.append('span').text('Cycle time:').attr('class', styles.tooltipLabel).attr('class', styles.cycleTime);
      gridContainer
        .append('span')
        .text(`${event.metrics.averageCycleTime} days`)
        .attr('class', styles.tooltipValue)
        .attr('class', styles.cycleTime);
    }

    if (event.metrics?.averageLeadTime > 0) {
      gridContainer.append('span').text('Lead time:').attr('class', styles.tooltipLabel).attr('class', styles.leadTime);
      gridContainer
        .append('span')
        .text(`${event.metrics.averageLeadTime} days`)
        .attr('class', styles.tooltipValue)
        .attr('class', styles.leadTime);
    }

    if (event.metrics?.wip > 0) {
      gridContainer.append('span').text('WIP:').attr('class', styles.tooltipLabel).attr('class', styles.wip);
      gridContainer.append('span').text(`${event.metrics.wip} items`).attr('class', styles.tooltipValue).attr('class', styles.wip);
    }

    if (event.metrics?.throughput > 0) {
      gridContainer.append('span').text('Throughput:').attr('class', styles.tooltipLabel);
      gridContainer.append('span').text(`${event.metrics.throughput} items`).attr('class', styles.tooltipValue);
    }

    if (event.observationBody) {
      gridContainer.append('span').text('Observation:').attr('class', styles.tooltipLabel);
      gridContainer
        .append('span')
        .text(`${event.observationBody.substring(0, 15)}...`)
        .attr('class', styles.tooltipValue);
    }
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
    this.chartArea?.on('mousemove', (event) => this.#handleMouseEvent(event, `${this.chartName}-mousemove`));
    this.chartArea?.on('click', (event) => this.#handleMouseEvent(event, `${this.chartName}-click`));
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
      const coords = d3.pointer(event, d3.select(`#${this.chartName}-area`).node());
      const xPosition = coords[0];
      const yPosition = coords[1];

      if (xPosition < 0 || xPosition > this.width) {
        console.warn('Mouse position out of bounds:', xPosition);
        return;
      }

      const date = this.currentXScale?.invert(xPosition);
      const cumulativeCountOfWorkItems = this.currentYScale?.invert(yPosition);
      const excludeCycleTime = eventName.includes('mousemove') && !eventName.includes(this.chartName);

      const metrics = this.computeMetrics(date, Math.floor(cumulativeCountOfWorkItems), excludeCycleTime);

      this.#drawMetricLines(metrics.metricLinesData);
      delete metrics.metricLinesData;
      const observation = this.observations?.data?.find((o) => o.chart_type === this.chartType && areDatesEqual(o.date_from, date));
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
      this.showTooltip(data);
      eventName.includes('click') && this.eventBus?.emitEvents(eventName, data);
    }
  }

  /**
   * Internal method to set up a handler for mouse leave events on the chart area.
   * @private
   */
  #setupMouseLeaveHandler() {
    this.chartArea?.on('mouseleave', () => this.hideTooltip());
  }

  /**
   * Computes the CFD metrics for a given date and cumulative count.
   * @param {Date} currentDate - The current date for metrics computation.
   * @param {Number} currentCumulativeCount - The current cumulative count of items.
   * @param {Boolean} excludeCycleTime
   * @returns {Object} The computed metrics.
   */
  computeMetrics(currentDate, currentCumulativeCount, excludeCycleTime = false) {
    currentDate = new Date(currentDate);
    // currentDate.setUTCHours(0, 0, 0, 0);
    const currentDataEntry = this.data.find((d) => areDatesEqual(new Date(d.date), currentDate));
    if (currentDataEntry) {
      const filteredData = this.data.filter((d) => d.date <= currentDate).reverse();
      const currentStateIndex = this.#getCurrentStateIndex(currentCumulativeCount, currentDataEntry);
      const currentDeliveredItems = currentDataEntry.delivered;
      const leadTimeDateBefore = this.#computeLeadTimeDate(currentDeliveredItems, filteredData);
      let { cycleTimeDateBefore, averageCycleTime, biggestCycleTime, currentStateCumulativeCount, cycleTimesByState } =
        this.computeCycleTimeAndLeadTimeMetrics(currentDataEntry, filteredData, currentDate, currentStateIndex);
      const averageLeadTime = leadTimeDateBefore
        ? Math.floor(calculateDaysBetweenDates(leadTimeDateBefore, currentDate).exactTimeDiff)
        : null;
      const noOfItemsBefore = this.#getNoOfItems(currentDataEntry, this.states[this.states.indexOf('delivered')]);
      const noOfItemsAfter = this.#getNoOfItems(currentDataEntry, this.states[this.states.indexOf('analysis_active')]);

      const wip = noOfItemsAfter - noOfItemsBefore;
      const throughput = averageLeadTime ? parseFloat((wip / averageLeadTime).toFixed(1)) : undefined;
      excludeCycleTime && (averageCycleTime = null);
      return {
        currentState: this.states[currentStateIndex],
        wip,
        cycleTimesByState,
        biggestCycleTime,
        averageLeadTime,
        averageCycleTime,
        throughput,
        metricLinesData: {
          averageCycleTime,
          averageLeadTime,
          leadTimeDateBefore,
          cycleTimeDateBefore,
          currentDate,
          currentStateCumulativeCount,
          currentDataEntry,
        },
      };
    }
    return {};
  }

  computeCycleTimeAndLeadTimeMetrics(currentDataEntry, filteredData, currentDate, currentStateIndex) {
    let cycleTimeDateBefore = null;
    let averageCycleTime = null;
    let biggestCycleTime = 0;
    let currentStateCumulativeCount = null;
    let cycleTimesByState = {};
    cycleTimesByState[this.states[0]] = 0;
    for (let i = 0; i < this.states.length - 1; i++) {
      let stateCumulativeCount = this.#getNoOfItems(currentDataEntry, this.states[i]);
      let cycleTimeDate = this.#computeCycleTimeDate(stateCumulativeCount, i, filteredData);
      cycleTimesByState[this.states[i + 1]] = cycleTimeDate
        ? Math.floor(calculateDaysBetweenDates(cycleTimeDate, currentDate).exactTimeDiff)
        : null;
      if (cycleTimesByState[this.states[i + 1]] > biggestCycleTime) {
        biggestCycleTime = cycleTimesByState[this.states[i + 1]];
      }
      if (currentStateIndex > 0 && i + 1 === currentStateIndex) {
        cycleTimeDateBefore = cycleTimeDate;
        averageCycleTime = cycleTimesByState[this.states[i + 1]];
        currentStateCumulativeCount = stateCumulativeCount;
      }
    }
    return { cycleTimeDateBefore, averageCycleTime, biggestCycleTime, currentStateCumulativeCount, cycleTimesByState };
  }

  #computeLeadTimeDate(currentDeliveredItems, filteredData) {
    for (const entry of filteredData) {
      const entryDate = new Date(entry.date);
      const leadTimeCumulativeCount = this.#getNoOfItems(entry, this.states[this.states.length - 1]);
      if (leadTimeCumulativeCount <= currentDeliveredItems) return entryDate;
    }
    return null;
  }

  #computeCycleTimeDate(currentStateCumulativeCount, currentStateIndex, filteredData) {
    for (const entry of filteredData) {
      const entryDate = new Date(entry.date);
      const cycleTimeCumulativeCount = this.#getNoOfItems(entry, this.states[currentStateIndex + 1]);
      if (cycleTimeCumulativeCount <= currentStateCumulativeCount) {
        return entryDate;
      }
    }
    return null;
  }

  /**
   * Draws metric lines on the chart for average cycle time, lead time, and work-in-progress (WIP).
   * @param {Object} params - The parameters object.
   * @param {number|null} params.averageCycleTime - The average cycle time.
   * @param {number|null} params.averageLeadTime - The average lead time.
   * @param {Date|null} params.leadTimeDateBefore - The date before the current date for lead time computation.
   * @param {Date|null} params.cycleTimeDateBefore - The date before the current date for cycle time computation.
   * @param {Date} params.currentDate - The current date.
   * @param {number} params.currentStateCumulativeCount - The cumulative count in the current state.
   * @param {Object} params.currentDataEntry - The current data entry object.
   * @private
   */
  #drawMetricLines({
    averageCycleTime = 0,
    averageLeadTime = 0,
    leadTimeDateBefore,
    cycleTimeDateBefore,
    currentDate,
    currentStateCumulativeCount,
    currentDataEntry,
  } = {}) {
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
    this.chartArea?.selectAll(`.${cssClass}`).remove();
    const x1 = this.currentXScale(dateBefore);
    const x2 = this.currentXScale(dateAfter);
    const y = this.currentYScale(noOfItems);
    this.chartArea
      ?.append('line')
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
    this.chartArea?.selectAll(`.${cssClass}`).remove();
    const y1 = this.currentYScale(noOfItemsBefore);
    const y2 = this.currentYScale(noOfItemsAfter);
    const x = this.currentXScale(date);
    this.chartArea
      ?.append('line')
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
    this.chartArea?.selectAll('.wip-line').remove();
    this.chartArea?.selectAll('.cycle-time-line').remove();
    this.chartArea?.selectAll('.lead-time-line').remove();
  }

  /**
   * Computes the number of items in a given state.
   * @private
   * @param {Object} currentData - The current data entry.
   * @param {string} state - The state to count items for.
   * @returns {number} The count of items in the specified state.
   */
  #getNoOfItems(currentData, state) {
    if (!currentData || typeof currentData !== 'object') return 0;
    if (!this.states || !Array.isArray(this.states)) return 0;

    let cumulativeCount = 0;
    const lastIndex = this.states.indexOf(state);
    if (lastIndex === -1) return 0;

    for (let stateIndex = 0; stateIndex <= lastIndex; stateIndex++) {
      const key = this.states[stateIndex];
      const value = currentData[key];
      cumulativeCount += typeof value === 'number' ? value : 0; // skip undefined/null
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
        if (currentCumulativeCount < cumulativeCount) {
          return stateIndex;
        }
      }
    }
    return -1;
  }

  //endregion
}
