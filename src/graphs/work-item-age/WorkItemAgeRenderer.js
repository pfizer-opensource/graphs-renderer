import * as d3 from 'd3';
import styles from '../tooltipStyles.module.css';
import { Renderer } from '../Renderer.js';

export class WorkItemAgeRenderer extends Renderer {
  color = '#0ea5e9';
  xAxisLabel = 'Work item states';
  yAxisLabel = 'Age(days)';
  dotRadius = 7;
  timeScale = 'logarithmic';

  constructor(
    data,
    workTicketsURL,
    states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered']
  ) {
    const filteredData = data.filter((d) => d.currentState !== 'delivered');
    super(filteredData);
    this.states = states.filter((d) => d !== 'delivered');
    this.data = this.groupData(filteredData);
    this.groupedData = this.groupData(filteredData);
    this.workTicketsURL = workTicketsURL;
    this.chartType = 'WORK_ITEM_AGE';
  }

  setupEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  groupData(data) {
    const groupedData = data.reduce((acc, item) => {
      let group = acc.find((g) => g.currentState === item.currentState && g.age === item.age);
      if (!group) {
        group = { currentState: item.currentState, age: item.age, items: [] };
        acc.push(group);
      }
      group.items.push(item);
      return acc;
    }, []);
    groupedData.sort((t1, t2) => this.states.indexOf(t1.currentState) - this.states.indexOf(t2.currentState));
    return groupedData;
  }

  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
    this.drawPercentileLines(this.data, this.y);
  }

  drawSvg(graphElementSelector) {
    this.svg = this.createSvg(graphElementSelector);
  }

  drawArea() {
    this.computeDotPositions();

    // Add vertical grid lines to delimit state areas
    this.svg
      .selectAll('.state-delimiter')
      .data(this.states)
      .enter()
      .append('line')
      .attr('class', 'state-delimiter')
      .attr('x1', (d) => this.x(d))
      .attr('x2', (d) => this.x(d))
      .attr('y1', 0)
      .attr('y2', this.height)
      .attr('stroke', '#ccc')
      .attr('stroke-dasharray', '4 2');

    // Draw dots
    this.svg
      .selectAll('.dot')
      .data(this.groupedData)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .style('cursor', 'pointer')
      .attr('id', (d) => `age-${d.ticketId}`)
      .attr('cx', (d) => d.xJitter)
      .attr('cy', (d) => this.y(d.age))
      .attr('r', this.dotRadius)
      .attr('fill', 'steelblue')
      .on('click', (event, d) => this.handleMouseClickEvent(event, d));

    // Add numbers inside the dots
    this.svg
      .selectAll('.dot-label')
      .data(this.groupedData)
      .enter()
      .append('text')
      .attr('class', 'dot-label')
      .attr('x', (d) => d.xJitter)
      .attr('y', (d) => this.y(d.age))
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .style('cursor', 'pointer')
      .style('fill', 'white')
      .text((d) => d.items.length)
      .on('click', (event, d) => this.handleMouseClickEvent(event, d));
  }

  computeDotPositions() {
    const groupedData = d3.group(this.groupedData, (d) => d.currentState);

    // Generate x positions for dots within each state
    const stateWidth = this.x.bandwidth();
    const jitterRange = stateWidth - this.dotRadius * 2; // Adjust range to prevent overlap

    groupedData.forEach((group, state) => {
      // Generate evenly spaced positions within the jitter range
      let horizontalPositions = d3.range(group.length).map((i) => i * (this.dotRadius * 2) - jitterRange / 2);

      // Shuffle positions for randomness
      horizontalPositions = d3.shuffle(horizontalPositions);

      group.forEach((item, index) => {
        // Clamp positions to keep dots inside the band
        const xPosition = horizontalPositions[index];
        const clampedX = Math.max(-jitterRange / 2 + this.dotRadius, Math.min(jitterRange / 2 - this.dotRadius, xPosition));

        // Assign xJitter, ensuring the dot stays within the band
        item.xJitter = this.x(state) + stateWidth / 2 + clampedX;
      });
    });
  }

  setTimeScaleListener(timeScaleSelector) {
    this.timeScaleSelectElement = document.querySelector(timeScaleSelector);
    if (this.timeScaleSelectElement) {
      this.timeScaleSelectElement.value = this.timeScale;
      this.timeScaleSelectElement.addEventListener('change', (event) => {
        this.timeScale = event.target.value;
        this.computeYScale();
        this.updateChartArea(this.selectedTimeRange);
      });
    }
  }

  updateChartArea() {
    this.drawYAxis(this.gy, this.y);
    // this.computeDotPositions();
    this.svg
      .selectAll(`.dot`)
      .attr('cx', (d) => d.xJitter)
      .attr('cy', (d) => this.y(d.age));
    this.svg
      .selectAll(`.dot-label`)
      .attr('x', (d) => d.xJitter)
      .attr('y', (d) => this.y(d.age));
    this.displayObservationMarkers(this.observations);
    this.drawPercentileLines(this.data, this.y);
  }

  drawAxes() {
    this.computeXScale();
    this.computeYScale();
    this.gx = this.svg.append('g');
    this.gy = this.svg.append('g');
    this.drawXAxis(this.gx, this.x);
    this.drawYAxis(this.gy, this.y);
    this.drawAxesLabels(this.svg, this.xAxisLabel, this.yAxisLabel);
  }

  computeYScale() {
    if (this.timeScale === 'logarithmic') {
      this.y = d3
        .scaleLog()
        .domain([1, d3.max(this.groupedData, (d) => d.age)])
        .range([this.height, 0]);
    } else if (this.timeScale === 'linear') {
      this.y = d3
        .scaleLinear()
        .domain([0, d3.max(this.groupedData, (d) => d.age)])
        .range([this.height, 0]);
    }
  }

  computeXScale() {
    this.x = d3.scaleBand().domain(this.states).range([0, this.width]).padding(0);
  }

  drawXAxis(gx, x) {
    gx.attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('class', 'axis-label')
      .style('text-anchor', 'middle');
  }

  drawYAxis(gy, y) {
    gy.call(d3.axisLeft(y)).selectAll('text').attr('class', 'axis-label');
  }

  showTooltip(event) {
    !this.tooltip && this.#createTooltip();
    this.#clearTooltipContent();
    this.#positionTooltip(event.tooltipLeft, event.tooltipTop);
    this.populateTooltip(event);
    this.tooltip.on('mouseleave', () => this.setupMouseLeaveHandler());
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
    this.tooltip = d3.select('body').append('div').attr('class', styles.chartTooltip).attr('id', 's-tooltip').style('opacity', 0);
  }

  /**
   * Populates the tooltip's content with event data: ticket id and observation body
   * @private
   * @param {Object} event - The event data for the tooltip.
   */
  populateTooltip(event) {
    this.tooltip.style('pointer-events', 'auto').style('opacity', 0.9);
    this.tooltip.append('p').text(`Age: ${event.age}`);
    event.items.forEach((item) => {
      this.tooltip
        .append('div')
        .append('a')
        .style('text-decoration', 'underline')
        .attr('href', `${this.workTicketsURL}/${item.ticketId}`)
        .text(item.ticketId)
        .attr('target', '_blank');
    });
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

  handleMouseClickEvent(event, d) {
    const observationsData = [];
    d.items.forEach((item) => {
      const obs = this.observations?.data?.find((o) => item.ticketId === o.work_item && o.chart_type === this.chartType);
      if (obs) {
        observationsData.push(obs);
      }
    });

    let data = {
      ...d,
      tooltipLeft: event.pageX,
      tooltipTop: event.pageY,
      observations: observationsData,
    };

    this.eventBus?.emitEvents(`work-item-age-click`, data);
    this.showTooltip(data);
  }

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

  setupObservationLogging(observations) {
    if (observations?.data?.length > 0) {
      this.observations = observations;
      this.displayObservationMarkers(observations);
    }
  }

  displayObservationMarkers(observations) {
    if (observations?.data) {
      this.observations = observations;
      this.#removeObservationMarkers();
      this.#createObservationMarkers();
    }
  }

  #removeObservationMarkers() {
    this.svg?.selectAll('.ring')?.remove();
  }

  #createObservationMarkers() {
    this.svg
      .selectAll('ring')
      .data(
        this.groupedData.filter((d) =>
          this.observations?.data?.some(
            (o) => d.items.find((i) => i.ticketId === o.work_item.toString()) && o.chart_type === this.chartType
          )
        )
      )
      .enter()
      .append('circle')
      .attr('class', 'ring')
      .attr('cx', (d) => d.xJitter)
      .attr('cy', (d) => this.y(d.age))
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', '2px');
  }

  //region Percentile lines rendering

  computePercentileLine(data, percent) {
    const percentileIndex = Math.floor(data.length * percent);
    return data[percentileIndex]?.age;
  }

  drawPercentileLines(data, y) {
    console.log('drawPercentileLines');
    const dataSortedByAge = [...data].sort((a, b) => a.age - b.age);
    console.log('dataSortedByAge');
    console.table(dataSortedByAge);
    const percentile1 = this.computePercentileLine(dataSortedByAge, 0.5);
    const percentile2 = this.computePercentileLine(dataSortedByAge, 0.75);
    const percentile3 = this.computePercentileLine(dataSortedByAge, 0.85);

    percentile1 && this.drawHorizontalLine(y, percentile1, 'green', 'p1', '50%');
    percentile1 && this.drawHorizontalLine(y, percentile2, 'orange', 'p2', '75%');
    percentile1 && this.drawHorizontalLine(y, percentile3, 'red', 'p3', '85%');
  }

  drawHorizontalLine(yScale, yValue, color, id, text = '') {
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
        .attr('stroke-dasharray', '7');
      textEl = this.svg
        .append('text')
        .attr('text-anchor', 'start')
        .attr('id', 'text-' + id)
        .style('font-size', '12px');
    }
    lineEl.attr('y1', yScale(yValue)).attr('y2', yScale(yValue)).attr('stroke', color);
    if (text) {
      textEl
        .text(text)
        .attr('fill', color)
        .attr('y', yScale(yValue) - 4);
      // Measure text width
      const textWidth = this.#getTextWidth(text, '12px');
      const adjustedX = this.width - textWidth;
      textEl.attr('x', adjustedX);
    }
  }

  #getTextWidth(text, fontSize = '12px', fontFamily = 'Arial') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontSize} ${fontFamily}`;
    const width = context.measureText(text).width;
    return width;
  }

  //endregion
}
