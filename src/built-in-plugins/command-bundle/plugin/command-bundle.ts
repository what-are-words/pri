import * as path from 'path';
import * as portfinder from 'portfinder';
import * as KoaMount from 'koa-mount';
import * as KoaStatic from 'koa-static';
import * as zlib from 'zlib';
import * as http from 'http';
import * as https from 'https';
import * as KoaCompress from 'koa-compress';
import * as KoaCors from '@koa/cors';
import * as Koa from 'koa';
import { componentEntry, pri, tempPath } from '../../../node';
import { logFatal } from '../../../utils/log';
import { plugin } from '../../../utils/plugins';
import { IOpts } from './interface';
import { runWebpack } from '../../../utils/webpack';
import { generateCertificate } from '../../../utils/generate-certificate';
import { runWebpackDevServer } from '../../../utils/webpack-dev-server';

export const commandBundle = async (opts: IOpts = {}) => {
  if (pri.sourceConfig.type !== 'component') {
    logFatal("Only component support 'npm run bundle', try 'npm start'!");
  }

  await pri.project.ensureProjectFiles();

  if (!opts.skipLint) {
    await pri.project.lint({
      lintAll: true,
      needFix: false,
      showBreakError: true
    });
  }

  await pri.project.checkProjectFiles();

  if (!opts.dev) {
    await runWebpack({
      mode: 'production',
      outFileName: pri.sourceConfig.bundleFileName,
      entryPath: path.join(pri.sourceRoot, path.format(componentEntry)),
      pipeConfig: async config => {
        let newConfig = { ...config };

        newConfig.output.libraryTarget = 'umd';

        newConfig = await plugin.bundleConfigPipes.reduce(async (nextConfig, fn) => {
          return fn(await nextConfig);
        }, Promise.resolve(config));

        return newConfig;
      }
    });
  } else {
    const freePort = await portfinder.getPortPromise({ port: pri.sourceConfig.devPort });

    runWebpackDevServer({
      mode: 'development',
      outFileName: pri.sourceConfig.bundleFileName,
      devServerPort: freePort,
      publicPath: '/',
      jsOnly: true,
      entryPath: path.join(pri.sourceRoot, path.format(componentEntry)),
      pipeConfig: async config => {
        let newConfig = { ...config };

        newConfig.output.libraryTarget = 'umd';

        newConfig = await plugin.bundleConfigPipes.reduce(async (nextConfig, fn) => {
          return fn(await nextConfig);
        }, Promise.resolve(config));

        return newConfig;
      }
    });
  }
};
