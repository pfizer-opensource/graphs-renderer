import CFDGraph from '../../../src/graphs/cfd/CFDGraph.js';
import graphsTestData from '../../testData/GraphTestData.js';
import cfdGraphOutput from '../../testData/CFDGraphExpectedOutput.js';

describe('CFDGraph', () => {
    let cfdGraph;

    test('computes dataset correctly', () => {
        cfdGraph = new CFDGraph(graphsTestData);
        const dataSet = cfdGraph.computeDataSet();
        const normalizeJSON = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
        expect(normalizeJSON(dataSet)).toEqual(normalizeJSON(cfdGraphOutput));
    });

    test('empty data computes to empty dataset', () => {
        cfdGraph = new CFDGraph([]);
        const dataSet = cfdGraph.computeDataSet();
        expect(dataSet).toEqual([]);
    });

});
