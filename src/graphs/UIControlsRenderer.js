import { addDaysToDate, calculateDaysBetweenDates, readJsonFile } from '../utils/utils.js';
import Renderer from './Renderer.js';
import * as d3 from 'd3';

/**
 * Extends Renderer to manage UI controls the graphs
 */
export default class UIControlsRenderer extends Renderer {
  selectedTimeRange;
  datePropertyName;
  defaultTimeRange;
  #defaultReportingRangeDays = 90;
  #defaultTimeInterval = 'weeks';
  reportingRangeDays = this.#defaultReportingRangeDays;
  timeInterval = this.#defaultTimeInterval;
  brushGroup;
  brush;
  isManualBrushUpdate = true;
  saveConfigsToBrowserStorage = false;
  timeIntervalChangeEventName;

  constructor(data) {
    super(data);
    if (this.saveConfigsToBrowserStorage) {
      this.reportingRangeDays = localStorage.getItem('reportingRangeDays') || this.reportingRangeDays;
      this.timeInterval = localStorage.getItem('timeInterval') || this.timeInterval;
    }
  }

  /**
   * Sets up a brush control for time range selection.
   * @param {string} brushElementSelector - The DOM selector for the brush element.
   */
  setupBrush(brushElementSelector) {
    this.brushSelector = brushElementSelector;
    this.defaultTimeRange = this.computeReportingRange(this.reportingRangeDays);
    this.selectedTimeRange ||= Array.from(this.defaultTimeRange);
    this.renderBrush();
  }

  /**
   * Updates the brush selection with a new time range.
   * @param {Array} newTimeRange - The new time range for the brush.
   */
  updateBrushSelection(newTimeRange) {
    if (newTimeRange) {
      this.isManualBrushUpdate = false;
      this.selectedTimeRange = newTimeRange;
      this.brushGroup?.call(this.brush)?.call(
        this.brush.move,
        newTimeRange?.map((d) => this.x(d))
      );
    }
  }

  /**
   * Sets up the configuration loader and reset buttons.
   * @param {string} loadConfigInputSelector - DOM selector for config load input.
   * @param {string} resetConfigInputSelector - DOM selector for config reset input.
   */
  setupConfigLoader(loadConfigInputSelector, resetConfigInputSelector) {
    this.loadConfigButton = document.querySelector(loadConfigInputSelector);
    const fileChosenElement = document.querySelector('#config-file-chosen');
    this.loadConfigButton.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      try {
        const jsonConfig = await readJsonFile(file);
        fileChosenElement.textContent = file.name;
        this.reportingRangeDays = jsonConfig.reportingRangeDays || this.reportingRangeDays;
        this.timeInterval = jsonConfig.timeInterval || this.timeInterval;
        localStorage.setItem('reportingRangeDays', this.reportingRangeDays);
        localStorage.setItem('timeInterval', this.timeInterval);
        this.selectedTimeRange = this.computeReportingRange(this.reportingRangeDays);
        this.brushSelector ? this.renderBrush() : this.updateGraph(this.selectedTimeRange);
      } catch (err) {
        console.error(err);
        fileChosenElement.textContent = err;
      }
    });
    this.resetConfigButton = document.querySelector(resetConfigInputSelector);
    this.resetConfigButton.addEventListener('click', () => {
      localStorage.removeItem('reportingRangeDays');
      localStorage.removeItem('timeInterval');
      this.reportingRangeDays = this.#defaultReportingRangeDays;
      this.timeInterval = this.#defaultTimeInterval;
      this.selectedTimeRange = this.computeReportingRange(this.reportingRangeDays);
      this.brushSelector ? this.renderBrush() : this.updateGraph(this.selectedTimeRange);
    });
  }

  /**
   * Computes the reporting range for the chart based on the number of days.
   * @param {number} noOfDays - The number of days for the reporting range.
   * @returns {Array} The computed start and end dates of the reporting range.
   */
  computeReportingRange(noOfDays) {
    const finalDate = this.data[this.data.length - 1][this.datePropertyName];
    let endDate = new Date(finalDate);
    let startDate = addDaysToDate(finalDate, -Number(noOfDays));
    if (this.selectedTimeRange) {
      endDate = new Date(this.selectedTimeRange[1]);
      startDate = new Date(this.selectedTimeRange[0]);
      const diffDays = Number(noOfDays) - calculateDaysBetweenDates(startDate, endDate);
      if (diffDays < 0) {
        startDate = addDaysToDate(startDate, -Number(diffDays));
      } else {
        endDate = addDaysToDate(endDate, Number(diffDays));
        if (endDate > finalDate) {
          const diffEndDays = calculateDaysBetweenDates(finalDate, endDate);
          endDate = finalDate;
          startDate = addDaysToDate(startDate, -Number(diffEndDays));
        }
      }
    }
    if (startDate < this.data[0][this.datePropertyName]) {
      startDate = this.data[0][this.datePropertyName];
    }
    return [startDate, endDate];
  }

  /**
   * Creates and configures an x-axis based on the specified time interval.
   * The axis is created using D3.js and configured for different time intervals: days, weeks, or months.
   * @param {d3.ScaleTime} x - The D3 scale for the x-axis.
   * @param timeInterval
   * @returns {d3.Axis} - The configured D3 axis for the x-axis.
   */
  createXAxis(x, timeInterval = this.timeInterval) {
    let axis;
    switch (timeInterval) {
      case 'days':
        axis = d3
          .axisBottom(x)
          .ticks(d3.timeDay.every(1)) // label every 2 days
          .tickFormat((d, i) => {
            return i % 2 === 0 ? d3.timeFormat('%b %d')(d) : '';
          });
        break;
      case 'weeks':
        axis = d3.axisBottom(x).ticks(d3.timeWeek);
        break;
      case 'months':
        axis = d3.axisBottom(x).ticks(d3.timeMonth);
        break;
      default:
        return d3.axisBottom(x);
    }
    return axis;
  }

  /**
   * Handles click events on the x-axis, cycling through different time intervals.
   * This function changes the time interval state between days, weeks, and months,
   * and then redraws the x-axis based on the selected time range.
   */
  changeTimeInterval(isManualUpdate, chart) {
    if (isManualUpdate) {
      switch (this.timeInterval) {
        case 'weeks':
          this.timeInterval = 'months';
          break;
        case 'months':
          this.timeInterval = 'days';
          break;
        case 'days':
          this.timeInterval = 'weeks';
          break;
        default:
          this.timeInterval = 'weeks';
      }
    } else {
      this.timeInterval = this.determineTheAppropriateAxisLabels();
    }

    this.eventBus?.emitEvents(`change-time-interval-${chart}`, this.timeInterval);
  }

  determineTheAppropriateAxisLabels() {
    if (this.reportingRangeDays <= 31) {
      return 'days';
    }
    if (this.reportingRangeDays > 31 && this.reportingRangeDays <= 124) {
      return 'weeks';
    }
    return 'months';
  }

  /**
   * Abstract method to render the brush. Must be implemented in subclasses.
   */
  renderBrush() {
    throw new Error('Method not implemented. It must be implemented in subclasses!');
  }
}
