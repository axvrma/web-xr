const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';
const pwaSourceDir = path.resolve(__dirname, 'src/pwa');

class StaticPwaAssetsPlugin {
    apply(compiler) {
        const pluginName = 'StaticPwaAssetsPlugin';
        const { RawSource } = compiler.webpack.sources;

        compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: pluginName,
                    stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
                },
                () => {
                    emitDirectory(compilation, RawSource, pwaSourceDir);
                }
            );
        });
    }
}

function emitDirectory(compilation, RawSource, directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            emitDirectory(compilation, RawSource, absolutePath);
            continue;
        }

        const relativePath = path.relative(pwaSourceDir, absolutePath).replace(/\\/g, '/');
        compilation.emitAsset(relativePath, new RawSource(fs.readFileSync(absolutePath)));
    }
}

module.exports = {
    mode: isProduction ? 'production' : 'development',
    entry: './src/index.js',
    output: {
        filename: isProduction ? 'bundle.[contenthash].js' : 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
        publicPath: '/',
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
        }),
        new StaticPwaAssetsPlugin(),
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        hot: true,
        open: true,
        server: 'https',
        host: '0.0.0.0',
        port: 8084,
        allowedHosts: 'all',
    },
};
