const path = require('path');

module.exports = {
    entry: './src/index.js',
    experiments: {
        outputModule: true
    },
    output: {
        filename: 'graphs-renderer.js',
        path: path.resolve(__dirname, 'dist'),
        // library: 'graphs-renderer',
        libraryTarget: 'module',
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
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                localIdentName: '[name]__[local]--[hash:base64:5]'
                            }
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                exclude: /\.module\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ],
    },
};
