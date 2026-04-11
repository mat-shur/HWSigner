import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    '@ledgerhq/device-management-kit',
    '@ledgerhq/device-signer-kit-solana',
    '@ledgerhq/device-transport-kit-speculos',
  ],
  webpack: (config, { webpack }) => {
    config.resolve ??= {};
    config.resolve.fallback ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias['pino-pretty'] = false;
    config.resolve.fallback.memcpy = false;
    config.resolve.fallback.crypto = require.resolve('crypto-browserify');
    config.resolve.fallback.stream = require.resolve('stream-browserify');
    config.resolve.fallback.buffer = require.resolve('buffer/');

    config.plugins ??= [];
    config.plugins.push(new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }));

    return config;
  },
};

export default nextConfig;
