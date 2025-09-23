export class MovingRangeGraph {
  dataSet = [];

  constructor(data) {
    this.data = data;
  }

  computeDataSet() {
    this.data.sort((t1, t2) => t1.deliveredDate - t2.deliveredDate || t1.sourceId.localeCompare(t2.sourceId));
    this.dataSet = [];
    if (this.data.length >= 2) {
      for (let i = 1; i < this.data.length; i++) {
        this.dataSet.push({
          fromDate: new Date(this.data[i - 1].deliveredDate),
          deliveredDate: new Date(this.data[i].deliveredTimestamp * 1000),
          value: Math.abs(Number(this.data[i].value) - Number(this.data[i - 1].value)),
          workItem1: this.data[i - 1].sourceId,
          workItem2: this.data[i].sourceId,
        });
      }
    }
    return this.dataSet;
  }

  getAvgMovingRange(startDate, endDate) {
    if (this.dataSet.length <= 0) {
      throw new Error('Data set is empty');
    }
    const filteredData = this.dataSet.filter((d) => d.deliveredDate >= startDate && d.deliveredDate <= endDate);
    return Math.ceil(filteredData.reduce((acc, curr) => acc + curr.value, 0) / filteredData.length);
  }
}
