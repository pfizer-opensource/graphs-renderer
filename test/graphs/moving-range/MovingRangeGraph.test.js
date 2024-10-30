import ScatterplotGraph from '../../../src/graphs/scatterplot/ScatterplotGraph.js';
import MovingRangeGraph from '../../../src/graphs/moving-range/MovingRangeGraph.js';
import graphsTestData from '../../testData/GraphTestData.js';
import movingRangeGraphOutput from '../../testData/MovingRangeGraphExpectedOutput.js';

describe('MovingRangeGraph', () => {
  let scatterplotGraph, movingRangeGraph;

  test('computes dataset correctly', () => {
    scatterplotGraph = new ScatterplotGraph(graphsTestData);
    const scatterplotDataSet = scatterplotGraph.computeDataSet();
    movingRangeGraph = new MovingRangeGraph(scatterplotDataSet);
    const movingRangeGraphDataSet = movingRangeGraph.computeDataSet();
    console.log(movingRangeGraphDataSet);
    const normalizeJSON = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
    expect(normalizeJSON(movingRangeGraphDataSet)).toEqual(normalizeJSON(movingRangeGraphOutput));
  });

  test('computes moving range correctly', () => {
    scatterplotGraph = new ScatterplotGraph(graphsTestData);
    const scatterplotDataSet = scatterplotGraph.computeDataSet();
    movingRangeGraph = new MovingRangeGraph(scatterplotDataSet);
    movingRangeGraph.computeDataSet();
    const startDate = new Date('2023-04-03');
    const endDate = new Date('2023-04-05');
    const avgMovingRange = movingRangeGraph.getAvgMovingRange(startDate, endDate);
    expect(avgMovingRange).toEqual(24);
  });

  test('empty data computes to empty dataset', () => {
    scatterplotGraph = new ScatterplotGraph([]);
    const scatterplotDataSet = scatterplotGraph.computeDataSet();
    movingRangeGraph = new MovingRangeGraph(scatterplotDataSet);
    const movingRangeGraphDataSet = movingRangeGraph.computeDataSet();
    expect(movingRangeGraphDataSet).toEqual([]);
  });
});
