import { readJsonFile } from '../utils/utils.js';
import Renderer from './Renderer.js';

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
    this.reportingRangeDays = localStorage.getItem('reportingRangeDays') || this.reportingRangeDays;
    this.timeInterval = localStorage.getItem('rangeIncrementUnits') || this.timeInterval;
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
    this.rangeIncrementUnitsElement = document.querySelector(timeIntervalSelector);
    this.rangeIncrementUnitsElement.value = this.timeInterval;
    this.rangeIncrementUnitsElement.addEventListener('change', (event) => {
      this.timeInterval = event.target.value;
      this.drawXAxis(this.gx, this.x.copy().domain(this.selectedTimeRange), this.timeInterval);
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
        localStorage.setItem('rangeIncrementUnits', this.timeInterval);
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
      localStorage.removeItem('rangeIncrementUnits');
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
    this.reportingRangeDays = reportingRangeDays;
    if (this.reportingRangeDaysInput) {
      this.reportingRangeDaysInput.value = Math.floor(this.reportingRangeDays);
    }
  }

  /**
   * Sets the time interval for the chart.
   * @param {string} rangeIncrementUnits - Time interval units (days, weeks, months).
   */
  setTimeInterval(rangeIncrementUnits) {
    this.timeInterval = rangeIncrementUnits;
    if (this.rangeIncrementUnitsElement) {
      const option = Array.from(this.rangeIncrementUnitsElement.options).find((o) => o.value === rangeIncrementUnits);
      option.selected = true;
    }
  }

  /**
   * Abstract method to render the brush. Must be implemented in subclasses.
   */
  renderBrush() {
    throw new Error('Method not implemented. It must be implemented in subclasses!');
  }
}
