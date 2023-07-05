import { getNoOfDaysBetweenDates, addDaysToDate } from "../../utils/utils.js";
import UIControlsRenderer from "../UIControlsRenderer.js";

/**
 * Class representing a Scatterplot graph renderer
 */
class ScatterplotRenderer extends UIControlsRenderer {
  #color = "#0ea5e9";

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
   *     "ticketId": "TRON-12349"
   *   }
   * ];
   */
  constructor(data) {
    super(data);
  }

  useEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener("change-time-range-cfd", this.updateBrush.bind(this));
  }

  getReportingDomain(noOfDays) {
    const finalDate = this.data[this.data.length - 1].delivered;
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
    if (startDate < this.data[0].delivered) {
      startDate = this.data[0].delivered;
    }
    return [startDate, endDate];
  }

  drawGraph(graphElementSelector) {
    this.#drawSvg(graphElementSelector);
    this.#drawAxis();
    this.#drawArea();
  }

  drawBrush() {
    const defaultSelectionRange = this.defaultSelectionDomain.map((d) => this.x(d));
    const svgBrush = this.createSvg(this.brushSelector, this.focusHeight);
    this.brush = d3
      .brushX()
      .extent([
        [0, 1],
        [this.width, this.focusHeight - this.margin.top + 1],
      ])
      .on("brush", ({ selection }) => {
        this.currentSelectionDomain = selection.map(this.x.invert, this.x);
        this.updateChart(this.currentSelectionDomain);
        if (this.isUserBrushEvent && this.eventBus) {
          this.eventBus?.emitEvents("change-time-range-scatterplot", this.currentSelectionDomain);
        }
        this.isUserBrushEvent = true;
      })
      .on("end", ({ selection }) => {
        if (!selection) {
          this.gBrush.call(this.brush.move, defaultSelectionRange);
        }
      });

    const brushArea = this.addClipPath(svgBrush, "scatterplot-brush-clip", this.width, this.focusHeight - this.margin.top + 1);
    this.#drawScatterPlot(brushArea, this.data, this.x, this.y.copy().range([this.focusHeight - this.margin.top - 2, 2]));
    this.drawXAxis(svgBrush.append("g"), this.x, "", this.focusHeight - this.margin.top);
    this.gBrush = brushArea;
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
    const xDomain = d3.extent(this.data, (d) => d.delivered);
    this.x = this.computeTimeScale(xDomain, [0, this.width]);
    const yDomain = [0, d3.max(this.data, (d) => d.noOfDays)];
    this.y = this.computeLinearScale(yDomain, [this.height, 0]).nice();

    this.gx = this.svg.append("g");
    this.gy = this.svg.append("g");
    this.drawXAxis(this.gx, this.x, this.rangeIncrementUnits);
    this.drawYAxis(this.gy, this.y);
  }

  #drawArea() {
    this.chartArea = this.addClipPath(this.svg, "scatterplot-clip");
    this.#drawScatterPlot(this.chartArea, this.data, this.x, this.y);
    this.#drawPercentileLines(this.svg, this.data, this.y);
    this.drawAxisLabels(this.svg, "Time", "# of delivery days");
  }

  updateChart(domain) {
    //get max y value before max focus date
    const maxY = d3.max(this.data, (d) => (d.delivered <= domain[1] && d.delivered >= domain[0] ? d.noOfDays : -1));
    this.setReportingRangeDays(getNoOfDaysBetweenDates(domain[0], domain[1]));
    const focusX = this.x.copy().domain(domain);
    const focusY = this.y.copy().domain([0, maxY]).nice();
    const focusData = this.data.filter((d) => d.delivered <= domain[1] && d.delivered >= domain[0]);
    this.drawXAxis(this.gx, focusX, this.rangeIncrementUnits, this.height);
    this.drawYAxis(this.gy, focusY);

    this.chartArea
      .selectAll(".dot")
      .attr("cx", (d) => focusX(d.delivered))
      .attr("cy", (d) => focusY(d.noOfDays))
      .attr("fill", this.#color);
    this.#drawPercentileLines(this.svg, focusData, focusY);
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
    const outerXAxisTicks = g.append("g").attr("class", "outer-ticks").call(axis.tickSize(-height).tickFormat(""));
    outerXAxisTicks.selectAll(".tick line").attr("opacity", 0.1);
  }

  drawYAxis(gy, y, height = this.height) {
    const yAxis = d3.axisLeft(y).tickSize(-this.width);
    gy.call(yAxis).selectAll(".tick line").attr("opacity", 0.1);
  }

  #drawScatterPlot(chartArea, data, x, y) {
    const tooltip = d3.select("body").append("a").attr("class", "tooltip").style("opacity", 0).attr("target", "_blank");

    chartArea
      .selectAll("dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("r", 5)
      .attr("cx", (d) => x(d.delivered))
      .attr("cy", (d) => y(d.noOfDays))
      .style("cursor", "pointer")
      .attr("fill", this.#color)
      .on("click", function (event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9).style("pointer-events", "auto");
        tooltip
          .html(d.ticketId)
          .attr("href", `https://digitalpfizer.atlassian.net/browse/${d.ticketId}`)
          .style("left", event.pageX + "px")
          .style("top", event.pageY + "px");
      });
    tooltip.on("mouseout", () => {
      tooltip.transition().duration(500).style("opacity", 0).style("pointer-events", "none");
    });
  }

  #computePercentileLine(data, percent) {
    const percentileIndex = Math.floor(data.length * percent);
    return data[percentileIndex].noOfDays;
  }

  #drawPercentileLines(svg, data, y) {
    const dataSortedByNoOfDays = [...data].sort((a, b) => a.noOfDays - b.noOfDays);
    const percentile1 = this.#computePercentileLine(dataSortedByNoOfDays, 0.5);
    const percentile2 = this.#computePercentileLine(dataSortedByNoOfDays, 0.7);
    const percentile3 = this.#computePercentileLine(dataSortedByNoOfDays, 0.85);
    const percentile4 = this.#computePercentileLine(dataSortedByNoOfDays, 0.95);

    this.#drawPercentileLine(svg, y, percentile1, "50%", "p1");
    this.#drawPercentileLine(svg, y, percentile2, "70%", "p2");
    this.#drawPercentileLine(svg, y, percentile3, "85%", "p3");
    this.#drawPercentileLine(svg, y, percentile4, "95%", "p4");
  }

  #drawPercentileLine(svg, y, percentile, text, percentileId) {
    const percentileTextEl = document.getElementById(`y-text-${percentileId}`);
    if (percentileTextEl) {
      svg
        .select(`#y-text-${percentileId}`)
        .attr("x", this.width + 4)
        .attr("y", y(percentile) + 4);
      svg.select(`#y-line-${percentileId}`).attr("x1", 0).attr("x2", this.width).attr("y1", y(percentile)).attr("y2", y(percentile));
    } else {
      svg
        .append("text")
        .attr("text-anchor", "start")
        .attr("x", this.width + 2)
        .attr("y", y(percentile) + 4)
        .attr("id", `y-text-${percentileId}`)
        .text(text)
        .attr("fill", "red")
        .style("font-size", "12px");
      svg
        .append("line")
        .attr("id", `y-line-${percentileId}`)
        .style("stroke", "red")
        .style("stroke-dasharray", "10, 5")
        .style("stroke-width", 2)
        .attr("x1", 0)
        .attr("x2", this.width)
        .attr("y1", y(percentile))
        .attr("y2", y(percentile));
    }
  }
}

export default ScatterplotRenderer;
