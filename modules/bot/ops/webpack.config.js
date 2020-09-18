const CopyPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = {
  mode: "development",
  target: "node",

  entry: path.join(__dirname, "../src/index.ts"),

  externals: {
    "sequelize": "commonjs2 sequelize",
    "sqlite3": "commonjs2 sqlite3",
  },

  node: {
    __filename: false,
    __dirname: false,
  },

  resolve: {
    mainFields: ["main", "module"],
    extensions: [".js", ".wasm", ".ts", ".json"],
    symlinks: false,
  },

  output: {
    path: path.join(__dirname, "../dist"),
    filename: `cli.js`,
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/env"],
          },
        },
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.join(__dirname, "../tsconfig.json"),
          },
        },
      },
      {
        test: /\.wasm$/,
        type: "javascript/auto",
        loaders: ["wasm-loader"],
      },
    ],
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.join(__dirname, "../../../node_modules/@connext/pure-evm-wasm/pure-evm_bg.wasm"),
          to: path.join(__dirname, "../dist/pure-evm_bg.wasm"),
        },
      ],
    }),
  ],

  stats: { warnings: false },
};
