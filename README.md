# graphs-renderer
A javascript library that provides rendering capabilities for CFD, scatterplot and Histogram graphs.  It uses d3js for graph rendering.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Examples](#examples)

## Installation

```bash
npm install github:pfizer/graphs-renderer
```

## Usage
To use graphs-renderer in your project, follow these steps:

1. Import the graphs that you need into your Javascript file:

```javascript
import { CFDGraph, CFDRenderer } from 'graphs-renderer';
```

2. Create the html elements where the graphs are rendered:

```html
<div>
    <h2>CFD graph</h2>
    <div id="cfd"></div>
    <div id="cfd-brush"></div>
</div>
```

3. Initialize and render the graphs:

```javascript
    let data = [...]
    let cfdSelector = "#cfd";
    let cfdGraph = new CFDGraph(data)
    let cfdDataSet = cfdGraph.computeDataSet();
    let cfdRenderer = new CFDRenderer(cfdDataSet)
    cfdRenderer.drawGraph(cfdSelector)
    cfdRenderer.useBrush("#cfd-brush")
```

To see usage examples of the library and the data format for the graph refer to [Examples](#examples)

## Examples
There are some examples demonstrating the usage of `graphs-renderer` library. 
You can find the examples in the [examples](./examples) directory.
