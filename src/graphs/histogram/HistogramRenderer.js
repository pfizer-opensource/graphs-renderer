import Renderer from "../Renderer.js";
import * as d3 from 'd3'

/**
 * Class representing a Histogram graph renderer
 */
class HistogramRenderer extends Renderer {
  #color = "#0ea5e9";
  #padding = 3;
  #binnedData;
  #noOfBins = 10;
  #yAccessor = (d) => d.length;
  #xAccessor = (d) => d.noOfDays;

  /**
   * Creates a HistogramRenderer instance
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
   * @param {Object} eventBus - event bus object for communicating with the other graphs through events
   */
  constructor(data, eventBus) {
    super(data);
    this.eventBus = eventBus;
    this.eventBus?.addEventListener("change-time-range-scatterplot", (timeRange) => {
      const currentSelectionData = this.data.filter((d) => d.delivered >= timeRange[0] && d.delivered <= timeRange[1]);
      this.#setXScale(currentSelectionData);
      this.#binnedData = this.#computeBinnedData(this.x, currentSelectionData);
      this.#setYScale(this.#binnedData);
      this.updateChart(currentSelectionData);
    });
  }

  #setYScale(data) {
    const maxValue = d3.max(data, this.#yAccessor);
    const padding = maxValue * 0.08; // 10% padding
    const yDomain = [0, maxValue + padding];
    this.y = this.computeLinearScale(yDomain, [this.height, 0]).nice();
  }

  #setXScale(data) {
    const xDomain = [0, d3.max(data, this.#xAccessor)];
    this.x = this.computeLinearScale(xDomain, [0, this.width]).nice();
  }

  drawGraph(graphElementSelector) {
    this.#drawSvg(graphElementSelector);
    this.#drawAxis();
    this.#drawArea();
  }

  clearGraph(graphElementSelector) {
    this.#drawSvg(graphElementSelector);
    this.#drawAxis();
  }

  #drawSvg(graphElementSelector) {
    this.svg = this.createSvg(graphElementSelector);
  }

  #drawAxis() {
    this.#setXScale(this.data);
    this.#binnedData = this.#computeBinnedData(this.x, this.data);
    this.#setYScale(this.#binnedData);
    this.gx = this.svg.append("g");
    this.gy = this.svg.append("g");
    this.drawXAxis(this.gx, this.x);
    this.drawYAxis(this.gy, this.y);
  }

  #drawArea() {
    this.chartArea = this.addClipPath(this.svg, "histogram-clip");
    this.#drawHistogram(this.chartArea, this.#binnedData, this.x, this.y);
    this.#drawPercentileLines(this.svg, this.data, this.x);
    this.drawAxisLabels(this.svg, "# of delivery days", "# of tickets");
  }

  updateChart(focusData) {
    this.drawXAxis(this.gx, this.x);
    this.drawYAxis(this.gy, this.y);

    const bars = this.chartArea.selectAll(".bar").data(this.#binnedData.filter((d) => d.length > 0));
    bars.exit().remove();
    bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .merge(bars)
      .transition()
      .duration(100)
      .attr("width", (d) => d3.max([0, this.x(d.x1) - this.x(d.x0) - 1]))
      .attr("height", (d) => this.height - this.y(this.#yAccessor(d)))
      .attr("x", (d) => this.x(d.x0))
      .attr("y", (d) => this.y(this.#yAccessor(d)))
      .attr("fill", this.#color);

    const texts = this.chartArea.selectAll(".bar-text").data(this.#binnedData.filter((d) => d.length > 0));
    texts.exit().remove();
    texts
      .enter()
      .append("text")
      .attr("class", "bar-text")
      .attr("text-anchor", "middle")
      .merge(texts)
      .transition()
      .duration(100)
      .attr("x", (d) => this.x(d.x0) + (this.x(d.x1) - this.x(d.x0) - 1) / 2 - this.#padding)
      .attr("y", (d) => this.y(this.#yAccessor(d)))
      .attr("font-size", 8)
      .text(this.#yAccessor);
    this.#drawPercentileLines(this.svg, focusData, this.x);
  }

  #computeBinnedData(x, data) {
    const bins = d3.bin().domain(x.domain()).value(this.#xAccessor).thresholds(this.#noOfBins);
    return bins(data);
  }

  #drawHistogram(svg, data, x, y) {
    svg
      .selectAll("rect")
      .data(data.filter((d) => d.length))
      .join("rect")
      .attr("class", "bar")
      .attr("width", (d) => d3.max([0, x(d.x1) - x(d.x0) - 1]))
      .attr("height", (d) => this.height - y(this.#yAccessor(d)))
      .attr("x", (d) => x(d.x0))
      .attr("y", (d) => y(this.#yAccessor(d)))
      .attr("fill", this.#color);

    svg
      .selectAll("text")
      .data(data.filter((d) => d.length))
      .join("text")
      .attr("class", "bar-text")
      .attr("x", (d) => x(d.x0) + (x(d.x1) - x(d.x0) - 1) / 2 - this.#padding)
      .attr("y", (d) => y(this.#yAccessor(d)))
      .attr("font-size", 8)
      .text(this.#yAccessor);
  }

  #computePercentileLine(data, percent) {
    const percentileIndex = Math.floor(data.length * percent);
    return data[percentileIndex].noOfDays;
  }

  #drawPercentileLines(svg, data, x) {
    const dataSortedByNoOfDays = [...data].sort((a, b) => a.noOfDays - b.noOfDays);
    const percentile1 = this.#computePercentileLine(dataSortedByNoOfDays, 0.5);
    const percentile2 = this.#computePercentileLine(dataSortedByNoOfDays, 0.7);
    const percentile3 = this.#computePercentileLine(dataSortedByNoOfDays, 0.85);
    const percentile4 = this.#computePercentileLine(dataSortedByNoOfDays, 0.95);

    this.#drawPercentileLine(svg, x, percentile1, "50%", "p1");
    this.#drawPercentileLine(svg, x, percentile2, "70%", "p2");
    this.#drawPercentileLine(svg, x, percentile3, "85%", "p3");
    this.#drawPercentileLine(svg, x, percentile4, "95%", "p4");
  }

  #drawPercentileLine(svg, x, percentile, text, percentileId) {
    const percentileTextEl = document.getElementById(`x-text-${percentileId}`);
    if (percentileTextEl) {
      svg
        .select(`#x-text-${percentileId}`)
        .attr("x", x(percentile) - 6)
        .attr("y", -2);
      svg.select(`#x-line-${percentileId}`).attr("x1", x(percentile)).attr("x2", x(percentile)).attr("y1", 0).attr("y2", this.height);
    } else {
      svg
        .append("text")
        .attr("text-anchor", "start")
        .attr("x", x(percentile))
        .attr("y", 0)
        .attr("id", `x-text-${percentileId}`)
        .text(text)
        .attr("fill", "red")
        .style("font-size", "12px");

      svg
        .append("line")
        .attr("id", `x-line-${percentileId}`)
        .style("stroke", "red")
        .style("stroke-dasharray", "10, 5")
        .style("stroke-width", 2)
        .attr("x1", x(percentile))
        .attr("x2", x(percentile))
        .attr("y1", 0)
        .attr("y2", this.height);
    }
  }
}

export default HistogramRenderer;
