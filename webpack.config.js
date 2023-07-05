const path = require('path');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'graphs-renderer.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'graphs-renderer',
        libraryTarget: 'umd',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
            {
                test: require.resolve('d3'),
                use: {
                    loader: 'imports-loader',
                    options: {
                        additionalCode: 'var thisObj = window;'
                    },
                },
            },
        ],
    },
};
