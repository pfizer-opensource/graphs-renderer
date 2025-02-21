const path = require('path');
const { version } = require('./package.json');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
    const isDevelopment = argv.mode === 'development';
    return {
        optimization: {
            minimize: true,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        mangle: {
                            // This ensures class names are preserved.
                            keep_classnames: true,
                        },
                        keep_fnames: true,
                    },
                }),
            ],
        },
        entry: './src/index.js',
        devtool: isDevelopment ? 'source-map' : false,
        experiments: {
            outputModule: true
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.env.VERSION': JSON.stringify(version)
            })
        ],
        watchOptions: {
            ignored: /node_modules/,
            aggregateTimeout: 600, // Process changes only every 600ms
            poll: 1000 // Check for changes every second
        },
        output: {
            filename: 'graphs-renderer.js',
            // eslint-disable-next-line no-undef
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
};
