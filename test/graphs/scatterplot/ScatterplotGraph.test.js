import ScatterplotGraph from '../../../src/graphs/scatterplot/ScatterplotGraph.js';
import graphsTestData from '../../testData/GraphTestData.js';
import scatterplotGraphOutput from '../../testData/ScatterplotGraphExpectedOutput.js';

describe('ScatterplotGraph', () => {
    let scatterplotGraph;

    test('computes dataset correctly', () => {
        scatterplotGraph = new ScatterplotGraph(graphsTestData);
        const dataSet = scatterplotGraph.computeDataSet();
        const normalizeJSON = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
        expect(normalizeJSON(dataSet)).toEqual(normalizeJSON(scatterplotGraphOutput));
    });

    test('empty data computes to empty dataset', () => {
        scatterplotGraph = new ScatterplotGraph([]);
        const dataSet = scatterplotGraph.computeDataSet();
        expect(dataSet).toEqual([]);
    });

});
