const path = require('path');
//const nodeExternals = require('webpack-node-externals');

module.exports = {
  devtool: 'source-map',
  entry: './src/index.ts',
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.js?$/,
        exclude: /node_modules\/ethers\/dist\/ethers\/ethers.min.js$/,
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        options: {
            presets: ['env', 'react', 'es2015'],
            plugins: ['transform-class-properties']
        }
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: './wp-bundle.js',
    path: path.resolve(__dirname, 'bundle'),
    libraryTarget: 'var',
    library: 'ConnextClient',
  },
  externals: [  ],
  target: 'web',
  node: { fs: 'empty', net: 'empty', tls: 'empty', child_process: 'empty', XMLHttpRequest: 'empty', ethers: 'empty' },
  optimization: { minimize: false },
};