class MovingRangeGraph {
  dataSet = [];
  constructor(data) {
    this.data = data;
  }

  computeDataSet() {
    this.data.sort((t1, t2) => t1.deliveredDate - t2.deliveredDate || t1.ticketId.localeCompare(t2.ticketId));
    this.dataSet = [];
    if (this.data.length >= 2) {
      for (let i = 1; i < this.data.length; i++) {
        this.dataSet.push({
          fromDate: new Date(this.data[i - 1].deliveredDate),
          deliveredDate: new Date(this.data[i].deliveredTimestamp * 1000),
          // leadTime: Math.floor(Math.abs(Number(this.data[i].exactLeadTime) - Number(this.data[i - 1].exactLeadTime))),
          leadTime: Math.floor(Math.abs(Number(this.data[i].leadTime) - Number(this.data[i - 1].leadTime))),
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
