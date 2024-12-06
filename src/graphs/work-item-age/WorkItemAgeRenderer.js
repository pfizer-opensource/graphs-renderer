
import * as d3 from 'd3';
import styles from '../tooltipStyles.module.css';
import Renderer from '../Renderer.js';

class WorkItemAgeRenderer extends Renderer{
  color = '#0ea5e9';
  xAxisLabel = 'Work item states';
  yAxisLabel = 'Age(days)';
  dotRadius = 5;
  timeScale = "linear"

  constructor(data, states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered']) {
    const filteredData = data.filter(d => d.lastState !== "delivered");
    super(filteredData);
    this.states= states.filter(d => d !== "delivered");

  }

  renderGraph(graphElementSelector) {
    this.drawSvg(graphElementSelector);
    this.drawAxes();
    this.drawArea();
  }

  drawSvg(graphElementSelector) {
    this.svg = this.createSvg(graphElementSelector);
  }

  drawArea() {
    // Group data by state
    const groupedData = d3.group(this.data, d => d.lastState);

    // Generate x positions for dots within each state
    const stateWidth = this.x.bandwidth();
    const jitterRange = stateWidth / 2; // Range to jitter dots horizontally

    // Ensure no overlap by calculating unique x positions within each state
    groupedData.forEach((group, state) => {
      let horizontalPositions = d3.range(group.length).map(i => i * (this.dotRadius * 2) - jitterRange / 2);
      horizontalPositions = d3.shuffle(horizontalPositions); // Shuffle to spread dots randomly
      group.forEach((item, index) => {
        item.xJitter = this.x(state) + stateWidth / 2 + horizontalPositions[index];
      });
    });
    // Add vertical grid lines to delimit state areas
    this.svg.selectAll('.state-delimiter')
      .data(this.states)
      .enter()
      .append('line')
      .attr('class', 'state-delimiter')
      .attr('x1', d => this.x(d))
      .attr('x2', d => this.x(d))
      .attr('y1', 0)
      .attr('y2', this.height)
      .attr('stroke', '#ccc')
      .attr('stroke-dasharray', '4 2');

    // Draw dots
    this.svg.selectAll('.dot')
      .data(this.data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('id', (d) => `age-${d.ticketId}`)
      .attr('cx', d => d.xJitter)
      .attr('cy', d => this.y(d.age))
      .attr('r', this.dotRadius)
      .attr('fill', 'steelblue')
      .on('click', (event, d) => this.handleMouseClickEvent(event, d));
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
      this.y = d3.scaleLog()
        .domain([1, d3.max(this.data, d => d.age)])
        .range([this.height, 0]);
    } else if (this.timeScale === 'linear') {
      this.y = d3.scaleLinear()
        .domain([0, d3.max(this.data, d => d.age)])
        .range([this.height, 0]);
    }
  }


  computeXScale() {
    this.x = d3.scaleBand()
      .domain(this.states)
      .range([0, this.width])
      .padding(0);
  }

  drawXAxis(gx, x) {
    gx
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('class', 'axis-label')
      .style('text-anchor', 'middle')
  }

  drawYAxis(gy, y) {
    gy.call(d3.axisLeft(y))
      .selectAll('text')
      .attr('class', 'axis-label');
  }


  showTooltip(event) {
    console.log(event)
    !this.tooltip && this.#createTooltip();
    this.#clearTooltipContent();
    this.#positionTooltip(event.tooltipLeft, event.tooltipTop);
    this.populateTooltip(event);
    this.tooltip.on("mouseleave", ()=>this.setupMouseLeaveHandler())
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
    this.tooltip
      .style('pointer-events', 'auto')
      .style('opacity', 0.9)
    this.tooltip.append("p").text(`Age: ${event.age}`)
    this.tooltip.append("p").text(`First state:`)
    this.tooltip.append("p").text(`${event.firstState}`)
    this.tooltip.append("p").text(`Current state:`)
    this.tooltip.append("p").text(` ${event.lastState}`)
    this.tooltip
      .append('a')
      .style('text-decoration', 'underline')
      .attr('href', `${this.workTicketsURL}/${event.ticketId}`)
      .text(event.ticketId)
      .attr('target', '_blank');
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
    let data = {
      ...d,
      tooltipLeft: event.pageX,
      tooltipTop: event.pageY,
    };

    this.showTooltip(data);
  }

  setupMouseLeaveHandler() {
    d3.select(this.svg.node().parentNode).on('mouseleave', (event) => {
      if (event.relatedTarget !== this.tooltip?.node()) {
        this.hideTooltip();
      }
    });
  }
}

export default WorkItemAgeRenderer;