import {CFDRenderer} from '../../../src/graphs/cfd/CFDRenderer.js';
import cfdGraphOutput from '../../testData/CFDGraphExpectedOutput.js';
import metricsOutput from '../../testData/CFDRendererExpectedOutput.js';

describe('CFDRenderer', () => {
    let cfdRenderer;

    test('computes metrics correctly', () => {
        //Arrange
        const states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered'];
        const reversedStates = [...states].reverse();
        cfdGraphOutput.forEach(d=>d.date = new Date(d.date))
        cfdRenderer = new CFDRenderer(cfdGraphOutput, reversedStates);
        const date = new Date("2023-04-09T21:00:00.000Z")
        const cumulativeCount = 4
        //Act
        const metrics = cfdRenderer.computeMetrics(date,cumulativeCount);
        //Assert
        const normalizeJSON = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
        expect(normalizeJSON(metrics)).toEqual(normalizeJSON(metricsOutput));
    });
});
