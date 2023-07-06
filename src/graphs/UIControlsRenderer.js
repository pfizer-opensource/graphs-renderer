import { readJsonFile } from '../utils/utils.js';
import Renderer from './Renderer.js';

export default class UIControlsRenderer extends Renderer {
  currentSelectionDomain;
  defaultSelectionDomain;
  #defaultReportingRangeDays = 90;
  #defaultRangeIncrementUnits = 'weeks';
  reportingRangeDays = this.#defaultReportingRangeDays;
  rangeIncrementUnits = this.#defaultRangeIncrementUnits;
  gBrush;
  brush;
  isUserBrushEvent = true;

  constructor(data) {
    super(data);
    this.reportingRangeDays = localStorage.getItem('reportingRangeDays') || this.reportingRangeDays;
    this.rangeIncrementUnits = localStorage.getItem('rangeIncrementUnits') || this.rangeIncrementUnits;
  }

  useBrush(brushElementSelector) {
    this.brushSelector = brushElementSelector;
    this.defaultSelectionDomain = this.getReportingDomain(this.reportingRangeDays);
    this.currentSelectionDomain ||= Array.from(this.defaultSelectionDomain);
    this.drawBrush();
  }

  updateBrush(newSelectionDomain) {
    if (newSelectionDomain) {
      this.isUserBrushEvent = false;
      this.currentSelectionDomain = newSelectionDomain;
      this.gBrush?.call(this.brush)?.call(
        this.brush.move,
        newSelectionDomain?.map((d) => this.x(d))
      );
    }
  }

  useControls(reportingRangeDaysSelector, rangeIncrementUnits) {
    this.reportingRangeDaysElement = document.querySelector(reportingRangeDaysSelector);
    this.reportingRangeDaysElement.value = this.reportingRangeDays;
    this.currentSelectionDomain ||= this.getReportingDomain(this.reportingRangeDays);
    this.reportingRangeDaysElement.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.reportingRangeDays = event.target.value;
        this.currentSelectionDomain = this.getReportingDomain(this.reportingRangeDays);
        this.brushSelector ? this.drawBrush() : this.updateChart(this.currentSelectionDomain);
      }
    });

    this.rangeIncrementUnitsElement = document.querySelector(rangeIncrementUnits);
    this.rangeIncrementUnitsElement.value = this.rangeIncrementUnits;
    this.rangeIncrementUnitsElement.addEventListener('change', (event) => {
      this.rangeIncrementUnits = event.target.value;
      this.drawXAxis(this.gx, this.x.copy().domain(this.currentSelectionDomain), this.rangeIncrementUnits);
    });
    this.brushSelector ? this.drawBrush() : this.updateChart(this.currentSelectionDomain);
  }

  useConfigLoading(loadConfigInputSelector, resetConfigInputSelector) {
    this.loadConfigButton = document.querySelector(loadConfigInputSelector);
    const fileChosenElement = document.querySelector('#config-file-chosen');
    this.loadConfigButton.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      try {
        const jsonConfig = await readJsonFile(file);
        fileChosenElement.textContent = file.name;
        this.reportingRangeDays = jsonConfig.reportingRangeDays || this.reportingRangeDays;
        this.rangeIncrementUnits = jsonConfig.rangeIncrementUnits || this.rangeIncrementUnits;
        localStorage.setItem('reportingRangeDays', this.reportingRangeDays);
        localStorage.setItem('rangeIncrementUnits', this.rangeIncrementUnits);
        this.currentSelectionDomain = this.getReportingDomain(this.reportingRangeDays);
        this.brushSelector ? this.drawBrush() : this.updateChart(this.currentSelectionDomain);
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
      this.rangeIncrementUnits = this.#defaultRangeIncrementUnits;
      this.currentSelectionDomain = this.getReportingDomain(this.reportingRangeDays);
      this.brushSelector ? this.drawBrush() : this.updateChart(this.currentSelectionDomain);
    });
  }

  setReportingRangeDays(reportingRangeDays) {
    this.reportingRangeDays = reportingRangeDays;
    if (this.reportingRangeDaysElement) {
      this.reportingRangeDaysElement.value = Math.floor(this.reportingRangeDays);
    }
  }

  setRangeIncrementUnits(rangeIncrementUnits) {
    this.rangeIncrementUnits = rangeIncrementUnits;
    if (this.rangeIncrementUnitsElement) {
      const option = Array.from(this.rangeIncrementUnitsElement.options).find((o) => o.value === rangeIncrementUnits);
      option.selected = true;
    }
  }

  drawBrush() {
    throw new Error('Method not implemented!');
  }
}
