import { addDaysToDate, calculateDaysBetweenDates, readJsonFile } from '../utils/utils.js';
import { Renderer } from './Renderer.js';
import * as d3 from 'd3';

/**
 * Extends Renderer to manage UI controls the graphs
 */
export class UIControlsRenderer extends Renderer {
  selectedTimeRange;
  preventEventLoop;
  chartName;
  chartType;
  datePropertyName;
  defaultTimeRange;
  #defaultReportingRangeDays = 90;
  #defaultTimeInterval = 'months';
  reportingRangeDays = this.#defaultReportingRangeDays;
  timeInterval = this.#defaultTimeInterval;
  brushGroup;
  brush;
  isManualBrushUpdate = true;
  saveConfigsToBrowserStorage = false;

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
      const [newStart, newEnd] = newTimeRange;
      const [domainStart, domainEnd] = this.x.domain();
      const duration = newEnd - newStart;
      let selectedMin = newStart;
      let selectedMax = newEnd;
      // Ensure selectedMin does not go before domainStart
      const adjustSelectedMin = (calculatedMin) => {
        if (calculatedMin < domainStart) {
          return domainStart;
        }
        return calculatedMin;
      };

      // Check if newTimeRange exceeds the domain
      if (newStart < domainStart || newEnd > domainEnd) {
        selectedMax = domainEnd;

        // Calculate selectedMin based on the duration
        selectedMin = new Date(domainEnd.getTime() - duration);

        // Ensure selectedMin does not go before domainStart
        selectedMin = adjustSelectedMin(selectedMin);

        if (selectedMin === domainStart) {
          selectedMax = new Date(selectedMin.getTime() + duration);

          // Ensure selectedMax does not exceed domainEnd
          if (selectedMax > domainEnd) {
            selectedMax = domainEnd;
          }
        }
      }

      this.selectedTimeRange = [selectedMin, selectedMax];

      // Set the flag before emitting an event
      this.preventEventLoop = true;

      this.brushGroup?.call(this.brush)?.call(
        this.brush.move,
        this.selectedTimeRange?.map((d) => this.x(d))
      );

      // Reset the flag after the event is handled
      this.preventEventLoop = false;
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
    // Ensure finalDate is a Date object
    const finalDateRaw = this.data[this.data.length - 1][this.datePropertyName];
    const finalDate = finalDateRaw instanceof Date ? finalDateRaw : new Date(finalDateRaw);
    let endDate = new Date(finalDate);
    let startDate = addDaysToDate(finalDate, -Number(noOfDays));
    if (this.selectedTimeRange) {
      endDate = this.selectedTimeRange[1] instanceof Date ? new Date(this.selectedTimeRange[1]) : new Date(this.selectedTimeRange[1]);
      startDate = this.selectedTimeRange[0] instanceof Date ? new Date(this.selectedTimeRange[0]) : new Date(this.selectedTimeRange[0]);
      const diffDays = Number(noOfDays) - calculateDaysBetweenDates(startDate, endDate).roundedDays;
      if (diffDays < 0) {
        startDate = addDaysToDate(startDate, -Number(diffDays));
      } else {
        endDate = addDaysToDate(endDate, Number(diffDays));
        if (endDate > finalDate) {
          const diffEndDays = calculateDaysBetweenDates(finalDate, endDate).roundedDays;
          endDate = finalDate;
          startDate = addDaysToDate(startDate, -Number(diffEndDays));
        }
      }
    }
    // Ensure startDate and endDate are not before/after data bounds
    const firstDateRaw = this.data[0][this.datePropertyName];
    const firstDate = firstDateRaw instanceof Date ? firstDateRaw : new Date(firstDateRaw);
    if (startDate < firstDate) {
      startDate = firstDate;
    }
    if (endDate < this.x.domain()[1]) {
      endDate = this.x.domain()[1];
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
      case 'days': {
        axis = d3
          .axisBottom(x)
          .ticks(d3.timeDay.every(1))
          .tickFormat((d, i) => {
            const dayFormat = d3.timeFormat('%b %d');
            const yearFormat = d3.timeFormat('%Y');
            if (i === 0) return `${dayFormat(d)} ${yearFormat(d)}`;
            return i % 2 === 0 ? dayFormat(d) : '';
          });
        break;
      }
      case 'weeks': {
        const ticks = x.ticks(d3.timeDay);
        // Find the first tick that is a Monday
        let firstMonday = -1;
        for (let i = 0; i < ticks.length; i++) {
          if (ticks[i].getDay() === 1) {
            firstMonday = i;
            break;
          }
        }
        axis = d3
          .axisBottom(x)
          .ticks(d3.timeDay)
          .tickFormat((d, i) => {
            const dayFormat = d3.timeFormat('%b %d');
            const yearFormat = d3.timeFormat('%Y');
            if (i === firstMonday) return `${dayFormat(d)} ${yearFormat(d)}`;
            return d.getDay() === 1 && i > firstMonday ? dayFormat(d) : '';
          });
        break;
      }
      case 'months': {
        const ticks = x.ticks(d3.timeWeek);
        // Find the first tick that is the first week of a month
        let firstMonthWeek = -1;
        for (let i = 0; i < ticks.length; i++) {
          if (ticks[i].getDate() <= 7) {
            firstMonthWeek = i;
            break;
          }
        }
        const weeks = d3.timeWeek.range(x.domain()[0], x.domain()[1]);
        axis = d3
          .axisBottom(x)
          .ticks(d3.timeWeek)
          .tickFormat((d, i) => {
            const monthFormat = d3.timeFormat('%b');
            const yearFormat = d3.timeFormat('%Y');
            if (i === firstMonthWeek) return `${monthFormat(d)} ${yearFormat(d)}`;
            if (d.getDate() <= 7 && i > firstMonthWeek) {
              if (i > 0 && d.getFullYear() !== weeks[i - 1].getFullYear()) {
                return `${monthFormat(d)} ${yearFormat(d)}`;
              }
              return monthFormat(d);
            }
            return '';
          });
        break;
      }
      case 'bimonthly': {
        const ticks = x.ticks(d3.timeMonth);
        // Find the first tick that is the first month
        let firstQuarterMonth = -1;
        for (let i = 0; i < ticks.length; i++) {
          if (ticks[i].getMonth() % 2 === 0) {
            firstQuarterMonth = i;
            break;
          }
        }
        const months = d3.timeMonth.range(x.domain()[0], x.domain()[1]);
        axis = d3
          .axisBottom(x)
          .ticks(d3.timeMonth)
          .tickFormat((d, i) => {
            const monthFormat = d3.timeFormat('%b');
            const yearFormat = d3.timeFormat('%Y');
            if (i === firstQuarterMonth) return `${monthFormat(d)} ${yearFormat(d)}`;
            if (d.getMonth() % 2 === 0 && i > firstQuarterMonth) {
              // Show year if year changes from previous quarter tick
              const prevQuarterIndex = (() => {
                for (let j = i - 1; j >= 0; j--) {
                  if (months[j].getMonth() % 2 === 0) return j;
                }
                return -1;
              })();
              if (prevQuarterIndex >= 0 && d.getFullYear() !== months[prevQuarterIndex].getFullYear()) {
                return `${monthFormat(d)} ${yearFormat(d)}`;
              }
              return monthFormat(d);
            }
            return '';
          });
        break;
      }
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
  changeTimeInterval(isManualUpdate) {
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
        case 'bimonthly':
          this.timeInterval = 'weeks';
          break;
        default:
          this.timeInterval = 'weeks';
      }
    } else {
      this.timeInterval = this.determineTheAppropriateAxisLabels();
    }

    this.eventBus?.emitEvents(`change-time-interval-${this.chartName}`, this.timeInterval);
  }

  determineTheAppropriateAxisLabels(noOfDays = this.reportingRangeDays) {
    if (noOfDays <= 31) {
      return 'days';
    }
    if (noOfDays > 31 && noOfDays <= 150) {
      return 'weeks';
    }
    if (noOfDays > 150 && noOfDays <= 750) {
      return 'months';
    }
    return 'bimonthly';
  }

  /**
   * Abstract method to render the brush. Must be implemented in subclasses.
   */
  renderBrush() {
    throw new Error('Method not implemented. It must be implemented in subclasses!');
  }
}
