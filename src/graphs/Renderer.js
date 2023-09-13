import * as d3 from 'd3';

export default class Renderer {
  margin = { top: 20, right: 40, bottom: 60, left: 40 };
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

  computeTimeScale(domain, range) {
    const scale = d3.scaleTime();
    return scale.domain(domain).range(range);
  }

  computeLinearScale(domain, range) {
    return d3.scaleLinear().domain(domain).range(range);
  }

  drawXAxis(g, x, height = this.height) {
    g.call(d3.axisBottom(x)).attr('transform', `translate(0, ${height})`);
  }

  drawYAxis(g, y) {
    g.call(d3.axisLeft(y));
  }

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

  drawAxisLabels(svg, xLabel, yLabel) {
    // Add X axis label:
    svg
      .append('text')
      .attr('text-anchor', 'end')
      .attr('x', this.width)
      .attr('y', this.height + 35)
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

  updateChart(_domain) {
    throw new Error('Method not implemented!');
  }
}
