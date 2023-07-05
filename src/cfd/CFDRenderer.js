import { addDaysToDate, getNoOfDaysBetweenDates } from "../utils/utils.js";
import UIControlsRenderer from "../UIControlsRenderer.js";
import * as d3 from 'd3'

/**
 * Class representing a Cumulative Flow Diagram (CFD) graph renderer
 */
class CFDRenderer extends UIControlsRenderer {
  #keys = ["delivered", "verif_start", "dev_complete", "in_progress", "analysis_done", "analysis_active"];
  #colorPalette = ["#22c55e", "#bbf7d0", "#8b5cf6", "#ddd6fe", "#0ea5e9", "#bae6fd"];
  #colors = d3.scaleOrdinal().domain(this.#keys).range(this.#colorPalette);
  #stackedData;

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
  }

  useEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus.addEventListener("change-time-range-scatterplot", this.updateBrush.bind(this));
  }

  getReportingDomain(noOfDays) {
    const finalDate = this.data[this.data.length - 1].date;
    let endDate = new Date(finalDate);
    let startDate = addDaysToDate(finalDate, -Number(noOfDays));
    if (this.currentSelectionDomain) {
      endDate = new Date(this.currentSelectionDomain[1]);
      startDate = new Date(this.currentSelectionDomain[0]);
      const diffDays = Number(noOfDays) - getNoOfDaysBetweenDates(startDate, endDate);
      if (diffDays < 0) {
        startDate = addDaysToDate(startDate, -Number(diffDays));
      } else {
        endDate = addDaysToDate(endDate, Number(diffDays));
        if (endDate > finalDate) {
          const diffEndDays = getNoOfDaysBetweenDates(finalDate, endDate);
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

  drawGraph(graphElementSelector) {
    this.#drawSvg(graphElementSelector);
    this.svg.append("g").attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);
    this.#drawAxis();
    this.#drawArea();
  }

  drawBrush() {
    const svgBrush = this.#drawBrushSvg(this.brushSelector);
    const defaultSelectionRange = this.defaultSelectionDomain.map((d) => this.x(d));
    this.brush = d3
      .brushX()
      .extent([
        [0, 1],
        [this.width, this.focusHeight - this.margin.top + 1],
      ])
      .on("brush", ({ selection }) => {
        this.currentSelectionDomain = selection.map(this.x.invert, this.x);
        this.updateChart(this.currentSelectionDomain);
        if (this.isUserBrushEvent) {
          this.eventBus.emitEvents("change-time-range-cfd", this.currentSelectionDomain);
        }
        this.isUserBrushEvent = true;
      })
      .on("end", ({ selection }) => {
        if (!selection) {
          this.gBrush.call(this.brush.move, defaultSelectionRange);
        }
      });

    const brushArea = this.#computeArea(this.x, this.y.copy().range([this.focusHeight - this.margin.top, 4]));
    this.#drawStackedAreaChart(svgBrush, this.#stackedData, brushArea);
    this.drawXAxis(svgBrush.append("g"), this.x, "", this.focusHeight - this.margin.top);
    this.gBrush = svgBrush.append("g");
    this.gBrush.call(this.brush).call(
      this.brush.move,
      this.currentSelectionDomain.map((d) => this.x(d))
    );
  }

  clearGraph(graphElementSelector, cfdBrushElementSelector) {
    this.#drawBrushSvg(cfdBrushElementSelector);
    this.#drawSvg(graphElementSelector);
    this.#drawAxis();
  }

  #drawSvg(graphElementSelector) {
    this.svg = this.createSvg(graphElementSelector);
  }

  #drawBrushSvg(brushSelector) {
    return this.createSvg(brushSelector, this.focusHeight);
  }

  #drawAxis() {
    this.#stackedData = this.#computeStackData();
    const xDomain = d3.extent(this.data, (d) => d.date);
    this.x = this.computeTimeScale(xDomain, [0, this.width]);
    const yDomain = [0, d3.max(this.#stackedData[this.#stackedData.length - 1], (d) => d[1])];
    this.y = this.computeLinearScale(yDomain, [this.height, 0]).nice();

    this.gx = this.svg.append("g");
    this.gy = this.svg.append("g");
    this.drawXAxis(this.gx, this.x, this.rangeIncrementUnits);
    this.drawYAxis(this.gy, this.y);
  }

  #drawArea() {
    const area = this.#computeArea(this.x, this.y);
    this.chartArea = this.addClipPath(this.svg, "cfd-clip");
    this.#drawStackedAreaChart(this.chartArea, this.#stackedData, area);
    this.drawAxisLabels(this.svg, "Time", "# of tickets");
    this.#drawLegend();
  }

  updateChart(domain) {
    //get max y value before max focus date
    const maxY = d3.max(this.#stackedData[this.#stackedData.length - 1], (d) => (d.data.date <= domain[1] ? d[1] : -1));
    this.setReportingRangeDays(getNoOfDaysBetweenDates(domain[0], domain[1]));
    const focusX = this.x.copy().domain(domain);
    const focusY = this.y.copy().domain([0, maxY]).nice();
    this.drawXAxis(this.gx, focusX, this.rangeIncrementUnits, this.height);
    this.drawYAxis(this.gy, focusY);

    this.chartArea
      .selectAll("path")
      .attr("class", (d) => "area " + d.key)
      .style("fill", (d) => this.#colors(d.key))
      .attr("d", this.#computeArea(focusX, focusY));
  }

  drawXAxis(g, x, rangeIncrementUnits, height = this.height) {
    let axis;
    rangeIncrementUnits && this.setRangeIncrementUnits(rangeIncrementUnits);
    switch (rangeIncrementUnits) {
      case "days":
        axis = d3
          .axisBottom(x)
          .tickArguments([d3.timeDay.every(1)])
          .tickFormat((d) => {
            const date = new Date(d);
            if (date.getUTCDay() === 0) {
              return d3.timeFormat("%a %d/%m")(date);
            }
          });
        break;
      case "weeks":
        axis = d3.axisBottom(x).ticks(d3.timeWeek);
        break;
      case "months":
        axis = d3.axisBottom(x).ticks(d3.timeMonth);
        break;
      default:
        axis = d3.axisBottom(x);
    }
    g.call(axis).attr("transform", `translate(0, ${height})`);
  }

  #computeStackData() {
    const stack = d3.stack().keys(this.#keys);
    return stack(this.data);
  }

  #computeArea(x, y) {
    return d3
      .area()
      .x((d) => x(d.data.date))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]));
  }

  #drawStackedAreaChart(chartArea, data, area) {
    chartArea
      .selectAll("areas")
      .data(data)
      .join("path")
      .attr("class", (d) => "area " + d.key)
      .style("fill", (d) => this.#colors(d.key))
      .attr("d", area);
  }

  #drawLegend() {
    const rectSize = 14;
    const textSize = 120 + rectSize;
    const startX = 80;
    const startY = this.height + 40;
    this.svg
      .selectAll("legend-rects")
      .data(this.#keys)
      .join("rect")
      .attr("x", (d, i) => textSize * i + startX)
      .attr("y", startY)
      .attr("width", rectSize)
      .attr("height", rectSize)
      .style("fill", (d) => this.#colors(d));

    this.svg
      .selectAll("legend-labels")
      .data(this.#keys)
      .join("text")
      .attr("x", (d, i) => rectSize + 6 + i * textSize + startX)
      .attr("y", startY + rectSize / 2)
      .style("fill", "black")
      .text((d) => d)
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")
      .style("font-size", "12px")
      .style("font-weight", "500");
  }
}

export default CFDRenderer;
