import { getNoOfDaysBetweenDates, addDaysToDate } from '../../utils/utils.js';
import UIControlsRenderer from '../UIControlsRenderer.js';
import styles from '../tooltipStyles.module.css';

import * as d3 from 'd3';

/**
 * Class representing a Scatterplot graph renderer
 */
class ScatterplotRenderer extends UIControlsRenderer {
  #color = '#0ea5e9';
  currentXScale;
  currentYScale;

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
    console.table(data);
  }

  useEventBus(eventBus) {
    this.eventBus = eventBus;
    this.eventBus?.addEventListener('change-time-range-cfd', this.updateBrush.bind(this));
  }

  useObservationLogging(observations, workTicketsURL) {
    if (observations) {
      this.scatterplotTooltip = d3.select('body').append('div').attr('class', styles.tooltip).attr('id', 's-tooltip').style('opacity', 0);
      d3.select(this.svg.node().parentNode).on('mouseleave', (event) => {
        if (event.relatedTarget !== this.scatterplotTooltip.node()) {
          this.hideTooltip();
        }
      });
      this.workTicketsURL = workTicketsURL;
      this.markObservations(observations);
    }
  }

  markObservations(observations) {
    if (observations) {
      this.observations = observations;
      this.chartArea.selectAll('.ring').remove();
      this.chartArea
        .selectAll('ring')
        .data(this.data.filter((d) => this.observations.data.rows.some((o) => o.work_item === d.ticketId)))
        .enter()
        .append('circle')
        .attr('class', 'ring')
        .attr('cx', (d) => this.currentXScale(d.delivered))
        .attr('cy', (d) => this.currentYScale(d.noOfDays))
        .attr('r', 8)
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-width', '2px');
    }
  }

  hideTooltip() {
    this.scatterplotTooltip.transition().duration(100).style('opacity', 0).style('pointer-events', 'none');
  }

  showTooltip(event) {
    this.scatterplotTooltip.selectAll('*').remove();
    this.scatterplotTooltip.transition().duration(100).style('opacity', 0.9).style('pointer-events', 'auto');
    this.scatterplotTooltip
      .style('left', event.tooltipLeft + 'px')
      .style('top', event.tooltipTop + 'px')
      .style('pointer-events', 'auto')
      .style('opacity', 0.9)
      .append('a')
      .style('text-decoration', 'underline')
      .attr('href', `${this.workTicketsURL}/${event.ticketId}`)
      .attr('href', `#`)
      .text(event.ticketId)
      .attr('target', '_blank');
    event.observationBody && this.scatterplotTooltip.append('p').text('Observation: ' + event.observationBody);
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
      .on('brush', ({ selection }) => {
        this.currentSelectionDomain = selection.map(this.x.invert, this.x);
        this.updateChart(this.currentSelectionDomain);
        if (this.isUserBrushEvent && this.eventBus) {
          this.eventBus?.emitEvents('change-time-range-scatterplot', this.currentSelectionDomain);
        }
        this.isUserBrushEvent = true;
      })
      .on('end', ({ selection }) => {
        if (!selection) {
          this.gBrush.call(this.brush.move, defaultSelectionRange);
        }
      });

    const brushArea = this.addClipPath(svgBrush, 'scatterplot-brush-clip', this.width, this.focusHeight - this.margin.top + 1);
    this.#drawScatterPlot(brushArea, this.data, this.x, this.y.copy().range([this.focusHeight - this.margin.top - 2, 2]));
    this.drawXAxis(svgBrush.append('g'), this.x, '', this.focusHeight - this.margin.top);
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

    this.gx = this.svg.append('g');
    this.gy = this.svg.append('g');
    this.drawXAxis(this.gx, this.x, this.rangeIncrementUnits);
    this.drawYAxis(this.gy, this.y);
  }

  #drawArea() {
    this.chartArea = this.addClipPath(this.svg, 'scatterplot-clip');
    this.#drawScatterPlot(this.chartArea, this.data, this.x, this.y);
    this.#drawPercentileLines(this.svg, this.data, this.y);
    this.drawAxisLabels(this.svg, 'Time', '# of delivery days');
  }

  updateChart(domain) {
    const maxY = d3.max(this.data, (d) => (d.delivered <= domain[1] && d.delivered >= domain[0] ? d.noOfDays : -1));
    this.setReportingRangeDays(getNoOfDaysBetweenDates(domain[0], domain[1]));
    this.currentXScale = this.x.copy().domain(domain);
    this.currentYScale = this.y.copy().domain([0, maxY]).nice();
    const focusData = this.data.filter((d) => d.delivered <= domain[1] && d.delivered >= domain[0]);
    this.drawXAxis(this.gx, this.currentXScale, this.rangeIncrementUnits, this.height);
    this.drawYAxis(this.gy, this.currentYScale);

    this.chartArea
      .selectAll('.dot')
      .attr('cx', (d) => this.currentXScale(d.delivered))
      .attr('cy', (d) => this.currentYScale(d.noOfDays))
      .attr('fill', this.#color);
    this.#drawPercentileLines(this.svg, focusData, this.currentYScale);
    this.markObservations(this.observations);
  }

  drawXAxis(g, x, rangeIncrementUnits, height = this.height) {
    let axis;
    rangeIncrementUnits && this.setRangeIncrementUnits(rangeIncrementUnits);
    switch (rangeIncrementUnits) {
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
    const outerXAxisTicks = g.append('g').attr('class', 'outer-ticks').call(axis.tickSize(-height).tickFormat(''));
    outerXAxisTicks.selectAll('.tick line').attr('opacity', 0.1);
  }

  drawYAxis(gy, y) {
    const yAxis = d3.axisLeft(y).tickSize(-this.width);
    gy.call(yAxis).selectAll('.tick line').attr('opacity', 0.1);
  }

  #drawScatterPlot(chartArea, data, x, y) {
    chartArea
      .selectAll('dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('id', (d) => d.ticketId)
      .attr('data-date', (d) => d.delivered)
      .attr('r', 5)
      .attr('cx', (d) => x(d.delivered))
      .attr('cy', (d) => y(d.noOfDays))
      .style('cursor', 'pointer')
      .attr('fill', this.#color)
      .on('click', (event, d) => {
        if (this.observations) {
          const observation = this.observations.data.rows.find((o) => o.work_item === d.ticketId);
          const data = {
            date: d.delivered,
            ticketId: d.ticketId,
            tooltipLeft: event.pageX,
            tooltipTop: event.pageY,
            observationBody: observation?.body,
            observationId: observation?.id,
          };
          this.showTooltip(data);
          this.eventBus?.emitEvents('scatterplot-click', data);
        }
      });
  }

  #computePercentileLine(data, percent) {
    const percentileIndex = Math.floor(data.length * percent);
    return data[percentileIndex]?.noOfDays;
  }

  #drawPercentileLines(svg, data, y) {
    const dataSortedByNoOfDays = [...data].sort((a, b) => a.noOfDays - b.noOfDays);
    const percentile1 = this.#computePercentileLine(dataSortedByNoOfDays, 0.5);
    const percentile2 = this.#computePercentileLine(dataSortedByNoOfDays, 0.7);
    const percentile3 = this.#computePercentileLine(dataSortedByNoOfDays, 0.85);
    const percentile4 = this.#computePercentileLine(dataSortedByNoOfDays, 0.95);

    percentile1 && this.#drawPercentileLine(svg, y, percentile1, '50%', 'p1');
    percentile2 && this.#drawPercentileLine(svg, y, percentile2, '70%', 'p2');
    percentile3 && this.#drawPercentileLine(svg, y, percentile3, '85%', 'p3');
    percentile4 && this.#drawPercentileLine(svg, y, percentile4, '95%', 'p4');
  }

  #drawPercentileLine(svg, y, percentile, text, percentileId) {
    const percentileTextEl = document.getElementById(`y-text-${percentileId}`);
    if (percentileTextEl) {
      svg
        .select(`#y-text-${percentileId}`)
        .attr('x', this.width + 4)
        .attr('y', y(percentile) + 4);
      svg.select(`#y-line-${percentileId}`).attr('x1', 0).attr('x2', this.width).attr('y1', y(percentile)).attr('y2', y(percentile));
    } else {
      svg
        .append('text')
        .attr('text-anchor', 'start')
        .attr('x', this.width + 2)
        .attr('y', y(percentile) + 4)
        .attr('id', `y-text-${percentileId}`)
        .text(text)
        .attr('fill', 'red')
        .style('font-size', '12px');
      svg
        .append('line')
        .attr('id', `y-line-${percentileId}`)
        .style('stroke', 'red')
        .style('stroke-dasharray', '10, 5')
        .style('stroke-width', 2)
        .attr('x1', 0)
        .attr('x2', this.width)
        .attr('y1', y(percentile))
        .attr('y2', y(percentile));
    }
  }
}

export default ScatterplotRenderer;
