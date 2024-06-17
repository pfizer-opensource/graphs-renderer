import * as d3 from 'd3';
class MovingRangeGraph {
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
    // console.table(groupedArray);
    // Step 3: Calculate absolute differences
    const avgLeadTimes = [];
    for (let i = 1; i < groupedArray.length; i++) {
      const prev = groupedArray[i - 1];
      const current = groupedArray[i];
      const difference = Math.abs(current.value - prev.value);

      avgLeadTimes.push({
        fromDate: new Date(prev.date),
        deliveredDate: new Date(current.date),
        leadTime: difference,
      });
    }

    return avgLeadTimes;
  }
}

export default MovingRangeGraph;
