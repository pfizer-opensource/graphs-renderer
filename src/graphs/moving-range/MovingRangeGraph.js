import * as d3 from 'd3';

class MovingRangeGraph {
  dataSet = [];
  constructor(data) {
    this.data = data;
  }

  computeDataSet() {
    // Step 1: Group data by date
    const grouped = d3.group(this.data, (d) => d.deliveredDate.toDateString());

    const groupedArray = Array.from(grouped, ([key, value]) => ({
      date: key,
      value: Math.ceil(value.map((v) => v.leadTime).reduce((acc, cur) => acc + cur, 0) / value.length),
    }));

    // Sort the groupedArray by date to ensure correct ordering for difference calculation
    groupedArray.sort((a, b) => new Date(a.date) - new Date(b.date));
    this.dataSet = [];
    if (groupedArray.length >= 2) {
      // Step 3: Calculate absolute differences
      for (let i = 1; i < groupedArray.length; i++) {
        const prev = groupedArray[i - 1];
        const current = groupedArray[i];
        const difference = Math.abs(current.value - prev.value);

        this.dataSet.push({
          fromDate: new Date(prev.date),
          deliveredDate: new Date(current.date),
          leadTime: difference,
        });
      }
    }
    return this.dataSet;
  }

  getAvgMovingRange() {
    if (this.dataSet.length <= 0) {
      throw new Error('Data set is empty');
    }
    return Math.ceil(this.dataSet.reduce((acc, curr) => acc + curr.leadTime, 0) / this.dataSet.length);
  }
}

export default MovingRangeGraph;
