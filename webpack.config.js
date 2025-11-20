const webpack = require('webpack');
const path = require('path');

module.exports = {
  // ...your existing config...
  resolve: {
    // alias: {
    //   '@signalapp/libsignal-client': false
    // },
    fallback: {
      path: require.resolve('path-browserify'),
      os: require.resolve('os-browserify/browser'),
      fs: false, // no browser polyfill for fs (set false so bundler doesn't try to include it)
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser')
    }
  },
  plugins: [
    // add to existing plugin array
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    // Ignore binary .node files so webpack doesn't try to load them
    new webpack.IgnorePlugin({ resourceRegExp: /\.node$/ })
  ]
};