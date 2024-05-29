const metricsOutput = {
    "currentState": "delivered",
    "wip": 1,
    "cycleTimesByState": {
        "delivered": 0,
        "verification_start": 0,
        "dev_complete": 0,
        "in_progress": 2,
        "analysis_done": 0,
        "analysis_active": 0
    },
    "biggestCycleTime": 2,
    "averageLeadTime": 3,
    "throughput": 3,
    "metricLinesData": {
        "averageCycleTime": null,
        "averageLeadTime": 3,
        "leadTimeDateBefore": "2023-04-05T21:00:00.000Z",
        "cycleTimeDateBefore": null,
        "currentDate": "2023-04-09T00:00:00.000Z",
        "currentStateCumulativeCount": null,
        "currentDataEntry": {
            "date": "2023-04-08T21:00:00.000Z",
            "analysis_active": 0,
            "analysis_done": 0,
            "in_progress": 1,
            "dev_complete": 0,
            "verification_start": 0,
            "delivered": 5
        }
    }
}


export default metricsOutput
