import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  output: {
    distPath: {
      root: "./build",
    },
    assetPrefix: '/tide/',
    copy: [
      { from: './public/favicon.ico', to: 'favicon.ico' },
      { from: './public/xgb_model.onnx', to: 'xgb_model.onnx' },
      { from: './public/logo-light.svg', to: 'logo-light.svg' },
    ],
  },
  html: {
    template: "./src/index.html",
    favicon: './public/logo-light.svg',
  },
  source: {
    entry: {
      index: "./src/index.jsx",
    },
  },
  experiments: {
    css: true,
  },
});
