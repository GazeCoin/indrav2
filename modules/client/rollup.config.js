import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import inject from 'rollup-plugin-inject';

export default {
    input: 'dist/index.js',
    output: {
        file: 'bundle/client-bundle.min.js',
        format: 'iife',
        sourcemap: 'inline'
    },
    plugins: [
        resolve({
            customResolveOptions: {
                module: true,
                moduleDirectory: 'node_modules',
                browser: true,
                jsnext: true
            }
        }),
        commonjs({
            include: 'node_modules/**',
        }),
        inject({
            include: '**/*.js',
            exclude: 'node_modules/**',
            $: 'jquery',
            Cookies: 'js-cookie',
            moment: 'moment'
        })
    ]
};
