# graphs-renderer
A javascript library that provides rendering capabilities for CFD, scatterplot and Histogram graphs. It uses d3js for graph rendering.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Examples](#examples)


## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/)
- [npm](https://npmjs.com/)

## Installation
To install `graphs-renderer`, run the following command in your project directory:

```bash
npm install github:pfizer/graphs-renderer
```

### Peer Dependencies

`graphs-renderer` is designed to work alongside certain tools that you're likely to have in your project. To avoid version conflicts and ensure compatibility, we list these tools as peer dependencies:

- `style-loader`: Automates the process of injecting CSS into your application.
- `css-loader`: Interprets `@import` and `url()` like `import/require()` and resolves them.

#### Installing Peer Dependencies

If you don't already have these dependencies in your project, you'll need to install them. Here's how:

```bash
npm install style-loader@^3.3.3 css-loader@^6.8.1 --save-dev
```

This command ensures you're installing versions compatible with graphs-renderer. Adjust the versions according to the peer dependencies specified in the graphs-renderer package.

## Usage
To use graphs-renderer in your project, follow these steps:

The steps are specified only for the CFD graphs usage scenario!

1. Import the graphs that you need into your Javascript file:

```javascript
import { CFDGraph, CFDRenderer } from 'graphs-renderer';
```

2. Create the html elements where the graphs are rendered:

```html
<div>
    <h2>CFD graph</h2>
    <div id="cfd-area-div"></div>
    <div id="cfd-brush-div"></div>
</div>
```

3. Initialize and render the graphs:

```javascript
// The data for the graphs
let data = [...]
//The cfd area chart and brush window elements css selectors
const cfdGraphElementSelector = "#cfd-area-div";
const cfdBrushElementSelector = "#cfd-brush-div";
//Declare the states array for the cfd graph data
const states = ['analysis_active', 'analysis_done', 'in_progress', 'dev_complete', 'verification_start', 'delivered'];
//Declare the states in  reversed order for the CFD (stacked area chart) to render correctly the areas
const reversedStates = [...states].reverse();
//Create a CFDGraph
const cfdGraph = new CFDGraph(data, states);
//Compute the dataset for the cfd graph
const cfdGraphDataSet = cfdGraph.computeDataSet();
//Create a CFDRenderer with the reversed states array
const cfdRenderer = new CFDRenderer(cfdGraphDataSet, reversedStates);
//Render the cfd graph and brush window
cfdRenderer.renderGraph(cfdGraphElementSelector)
cfdRenderer.setupBrush(cfdBrushElementSelector)
```

To see usage examples of the library and the data format for the graph refer to [Examples](#examples)

## Examples
There are some examples demonstrating the usage of `graphs-renderer` library. 
You can find the examples in the [examples](examples) directory.
