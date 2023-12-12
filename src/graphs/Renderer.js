import * as d3 from 'd3';

/**
 * Represents a generic graphs renderer
 */
export default class Renderer {
  margin = { top: 30, right: 40, bottom: 70, left: 40 };
  width = 1040 - this.margin.left - this.margin.right;
  height = 460 - this.margin.top - this.margin.bottom;
  axisLabelFontSize = 14;
  focusHeight = 120;
  gx;
  gy;
  x;
  y;
  svg;
  chartArea;

  constructor(data) {
    this.data = data;
  }

  /**
   * Creates an SVG element within a specified DOM selector.
   * @param selector - The svg selector
   * @param {number} [height=this.height] - The height of the SVG element.
   * @param {number} [width=this.width] - The width of the SVG element.
   * @returns {d3.Selection} The created SVG element.
   */
  createSvg(selector, height = this.height, width = this.width) {
    const htmlElement = document.querySelector(selector);
    if (htmlElement) {
      htmlElement.innerHTML = '';
    }
    const svg = d3
      .select(selector)
      .append('svg')
      .attr('class', 'mx-auto')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('viewBox', `0 0 ${width + this.margin.left + this.margin.right} ${height + this.margin.top + this.margin.bottom}`)
      .append('g')
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
    return svg;
  }

  /**
   * Computes a d3 time scale with a given domain and range.
   * @param {Array} domain - The domain for the scale.
   * @param {Array} range - The range for the scale.
   * @returns {d3.ScaleTime} The computed time scale.
   */
  computeTimeScale(domain, range) {
    const scale = d3.scaleTime();
    return scale.domain(domain).range(range);
  }

  /**
   * Computes a d3 linear scale with a given domain and range.
   * @param {Array} domain - The domain for the scale.
   * @param {Array} range - The range for the scale.
   * @returns {d3.ScaleLinear} The computed linear scale.
   */
  computeLinearScale(domain, range) {
    return d3.scaleLinear().domain(domain).range(range);
  }

  /**
   * Draws the X-axis of the chart.
   * @param {d3.Selection} g - The SVG group element where the axis is drawn.
   * @param {d3.Scale} x - The scale to use for the axis.
   * @param {number} [height=this.height] - The height at which to draw the axis.
   * @param isGraph [isGraph=true] - Signals if the x axis is drawn for the graphs or for the brush
   */
  /* eslint-disable-next-line no-unused-vars */
  drawXAxis(g, x, height = this.height, isGraph = true) {
    g.call(d3.axisBottom(x)).attr('transform', `translate(0, ${height})`);
  }

  /**
   * Draws the Y-axis of the chart.
   * @param {d3.Selection} g - The SVG group element where the axis is drawn.
   * @param {d3.Scale} y - The scale to use for the axis.
   */
  drawYAxis(g, y) {
    g.call(d3.axisLeft(y));
  }

  /**
   * Adds a clipping path to the SVG element.
   * @param {d3.Selection} svg - The SVG element to which the clipping path is added.
   * @param {string} clipId - The id for the clipping path.
   * @param {number} [width=this.width] - The width of the clipping area.
   * @param {number} [height=this.height] - The height of the clipping area.
   * @returns {d3.Selection} The SVG group element with the clipping path applied.
   */
  addClipPath(svg, clipId, width = this.width, height = this.height) {
    svg
      .append('defs')
      .append('svg:clipPath')
      .attr('id', clipId)
      .append('svg:rect')
      .attr('width', width)
      .attr('height', height)
      .attr('x', 0)
      .attr('y', 0);

    return svg.append('g').attr('clip-path', `url(#${clipId})`);
  }

  /**
   * Draws labels for the X and Y axes.
   * @param {d3.Selection} svg - The SVG element where labels are to be added.
   * @param {string} xLabel - The label for the X-axis.
   * @param {string} yLabel - The label for the Y-axis.
   */
  drawAxesLabels(svg, xLabel, yLabel) {
    // Add X axis label:
    svg
      .append('text')
      .attr('text-anchor', 'end')
      .attr('x', this.width)
      .attr('y', this.height + 55)
      .text(xLabel)
      .style('font-size', this.axisLabelFontSize);

    // Add Y axis label:
    svg
      .append('text')
      .attr('text-anchor', 'end')
      .attr('x', -20)
      .attr('y', -10)
      .text(yLabel)
      .attr('text-anchor', 'start')
      .style('font-size', this.axisLabelFontSize);
  }

  /**
   * Abstract method to update the chart. Must be implemented in subclasses.
   * @param {Array} domain - The domain to update the chart with.
   */
  /* eslint-disable-next-line no-unused-vars */
  updateGraph(domain) {
    throw new Error('Method not implemented. It must be implemented in subclasses!');
  }
}
