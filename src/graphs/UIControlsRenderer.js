import { addDaysToDate, calculateDaysBetweenDates, readJsonFile } from '../utils/utils.js';
import Renderer from './Renderer.js';
import * as d3 from 'd3';

/**
 * Extends Renderer to manage UI controls the graphs
 */
export default class UIControlsRenderer extends Renderer {
  selectedTimeRange;
  defaultTimeRange;
  #defaultReportingRangeDays = 90;
  #defaultTimeInterval = 'weeks';
  reportingRangeDays = this.#defaultReportingRangeDays;
  timeInterval = this.#defaultTimeInterval;
  brushGroup;
  brush;
  isManualBrushUpdate = true;

  constructor(data) {
    super(data);
    // this.reportingRangeDays = localStorage.getItem('reportingRangeDays') || this.reportingRangeDays;
    // this.timeInterval = localStorage.getItem('timeInterval') || this.timeInterval;
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
   * Sets up controls for selecting reporting range days and time intervals.
   * @param {string} reportingRangeDaysSelector - DOM selector for reporting range days input.
   * @param {string} timeIntervalSelector - DOM selector for time interval selection.
   */
  setupChartControls(reportingRangeDaysSelector, timeIntervalSelector) {
    this.setupReportingRangeDays(reportingRangeDaysSelector);
    this.setupTimeInterval(timeIntervalSelector);
    this.brushSelector ? this.renderBrush() : this.updateGraph(this.selectedTimeRange);
  }

  /**
   * Sets up the input control for selecting reporting range days.
   * @param {string} reportingRangeDaysSelector - DOM selector for reporting range days input.
   */
  setupReportingRangeDays(reportingRangeDaysSelector) {
    this.reportingRangeDaysInput = document.querySelector(reportingRangeDaysSelector);
    this.reportingRangeDaysInput.value = this.reportingRangeDays;
    this.selectedTimeRange ||= this.computeReportingRange(this.reportingRangeDays);
    this.reportingRangeDaysInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.reportingRangeDays = event.target.value;
        this.selectedTimeRange = this.computeReportingRange(this.reportingRangeDays);
        this.brushSelector ? this.renderBrush() : this.updateGraph(this.selectedTimeRange);
      }
    });
  }

  /**
   * Sets up the selection control for time intervals.
   * @param {string} timeIntervalSelector - DOM selector for time interval selection.
   */
  setupTimeInterval(timeIntervalSelector) {
    this.timeIntervalElement = document.querySelector(timeIntervalSelector);
    this.timeIntervalElement.value = this.timeInterval;
    this.timeIntervalElement.addEventListener('change', (event) => {
      this.timeInterval = event.target.value;
      this.drawXAxis(this.gx, this.x.copy().domain(this.selectedTimeRange), this.height, true);
    });
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
   * Sets the reporting range days.
   * @param {number} reportingRangeDays - Number of days for the reporting range.
   */
  setReportingRangeDays(reportingRangeDays) {
    this.reportingRangeDays = Math.floor(reportingRangeDays);
    if (this.reportingRangeDaysInput) {
      this.reportingRangeDaysInput.value = this.reportingRangeDays;
    }
  }

  /**
   * Sets the time interval for the chart.
   * @param {string} timeInterval - Time interval units (days, weeks, months).
   */
  setTimeInterval(timeInterval) {
    this.timeInterval = timeInterval;
    if (this.timeIntervalElement) {
      const option = Array.from(this.timeIntervalElement.options).find((o) => o.value === timeInterval);
      option.selected = true;
    }
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
   * @returns {d3.Axis} - The configured D3 axis for the x-axis.
   */
  createXAxis(x) {
    let axis;
    switch (this.timeInterval) {
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
    return axis;
  }

  /**
   * Handles click events on the x-axis, cycling through different time intervals.
   * This function changes the time interval state between days, weeks, and months,
   * and then redraws the x-axis based on the selected time range.
   */
  handleXAxisClick() {
    let timeInterval;
    switch (this.timeInterval) {
      case 'weeks':
        timeInterval = 'months';
        break;
      case 'months':
        timeInterval = 'days';
        break;
      case 'days':
        timeInterval = 'weeks';
        break;
      default:
        timeInterval = 'weeks';
    }
    this.setTimeInterval(timeInterval);
    this.drawXAxis(this.gx, this.x.copy().domain(this.selectedTimeRange), this.height, true);
  }

  /**
   * Sets up click listener for the X axis.
   */
  setupXAxisControl() {
    this.gx.on('click', () => {
      this.handleXAxisClick();
      this.eventBus?.emitEvents(this.timeIntervalChangeEventName);
      this.timeIntervalElement && (this.timeIntervalElement.value = this.timeInterval);
    });
  }

  /**
   * Abstract method to render the brush. Must be implemented in subclasses.
   */
  renderBrush() {
    throw new Error('Method not implemented. It must be implemented in subclasses!');
  }
}
