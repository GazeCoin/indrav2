import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';
import commonjs from 'rollup-plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

//import pkg from './package.json';
export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'bundle/client-bundle.js',
      format: 'iife',
      name: 'Connext',
    },
  ],
/*  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ], */
  plugins: [
    resolve({
        customResolveOptions: {
            module: true,
            moduleDirectory: 'node_modules',
            browser: true,
            jsnext: true
        }
    }),
    builtins(),
    commonjs({
        include: [
          'node_modules/**',
          'node_modules/ethers/**',
          'node_modules/ethers/utils/**',
          'node_modules/ethers/constants.js',
          'node_modules/human-standard-token-abi/**',
          'node_modules/@connext/messaging/**',
          'node_modules/@connext/proxy-lock/**',
          'node_modules/@counterfactual/node/**',
        ],
        exclude: [
            'node_modules/elliptic/**',
            'node_modules/ts-nats/**',
            'node_modules/nats/**',
        ],
        namedExports: {
            'ethers': [ 'utils', 'Contract', 'providers' ],
            //'@counterfactual/node/dist/index.js': [ 'EXTENDED_PRIVATE_KEY_PATH' ]
        }
    }),
    typescript({
      typescript: require('typescript'),
      tsconfigOverride: { "compilerOptions": { "module":"ES2015" } },
      check: false,
//      exclude: [ "node_modules/@counterfactual/node/dist/index.js" ],
      rollupCommonJSResolveHack: true,

    }),
  ],
}
