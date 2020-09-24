const path = require('path');
const fs = require('fs');
const process = require('process');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const walk = require('walk');

// var createResLists = function () {
//     var resPathList = ['./res/textures', './res/gltf'];
//     for (let k in resPathList) {
//         let path = resPathList[k];
//         let pathArr = path.split('/');
//         let outputFileName = pathArr[pathArr.length - 1] + 'List.txt';
//         let files = [];
//         let walker = walk.walk(path, { followLinks: false });
//         walker.on('file', function (root, stat, next) {
//             if (stat.name !== '.DS_Store') {
//                 files.push(root.substring(2) + '/' + stat.name);
//             }
//             next();
//         });
//         walker.on('end', function () {
//             fs.writeFile('./res/configs/' + outputFileName, JSON.stringify(files), function (err) {
//                 if (err) {
//                     return console.error(err);
//                 }
//                 fs.readFile('./res/configs/' + outputFileName, function (err, data) {
//                     if (err) {
//                         return console.error(err);
//                     }
//                     console.log(`read ${outputFileName}:${data.toString()}`);
//                 });
//             });
//         });
//     }
// };
//
// createResLists();

module.exports = {
    entry: {
        app: './src/index.js',
    },
    devtool: 'eval-source-map',
    plugins: [
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            title: 'IpWoo',
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'res',
                    to: 'res',
                    globOptions: {
                        ignore: ['**/.DS_Store'],
                    },
                },
            ],
        }),
        new webpack.DefinePlugin({
            __VERSION__: JSON.stringify(process.env.npm_package_version),
        }),
    ],
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            { test: /\.txt$/, use: 'raw-loader' },
            {
                test: /\.(png|jpg|gif)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[path][name].[ext]',
                        },
                    },
                ],
            },
        ],
    },
};
