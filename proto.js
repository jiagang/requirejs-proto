/**
 * @license requirejs-proto 0.1.0 Copyright (c) 2014 Jiagang
 * see: http://github.com/jiagang/requirejs-proto for details
 */
define(['module', 'text', 'ProtoBuf'], function(module, text) {

    'use strict';

    var buildMap = {};

    var builderMap = {};

    function load(name, req, onload, requireConfig) {

        // 扩展名只支持proto和json两种
        var defaultExt = (requireConfig.proto && requireConfig.proto.ext) || 'proto';

        // 解析name，取得其中的文件名称和请求的proto类型名称
        var arr = name.split('::');
        var fileName = arr[0];

        // 如果名称中不包含扩展名.proto或者.json，则添加默认扩展名
        var ext = fileName.split('.').pop();
        if (ext.toLowerCase() === 'proto' || ext.toLowerCase() === 'json') {
            ext = ext.toLowerCase();
        } else {
            fileName = fileName + '.' + defaultExt;
            ext = defaultExt;
        }

        var clazzName = (arr.length > 1) && arr[1];

        // 优化时请求对应文件后缓存
        if (requireConfig.isBuild) {

            // 默认proto2json为false
            var proto2json = (requireConfig.proto && requireConfig.proto.proto2json) || false;

            if (!buildMap[fileName]) {
                text.get(req.toUrl(fileName), function(data) {
                    buildMap[fileName] = {
                        moduleNames: [name],
                        ext: ext,
                        data: data,
                        proto2json: proto2json
                    };
                    onload();
                });
            } else {
                buildMap[fileName].moduleNames.push(name);
                onload();
            }
            return;
        }

        // 缓存的builder存在则直接返回，否则异步请求proto后返回
        var builder = builderMap[fileName];
        if (!!builder) {
            if (!!clazzName) {
                onload(builder.build(clazzName));
            } else {
                onload(builder);
            }
        } else {

            // 请求指定文件
            // 如果text存在则使用text请求文件（优化前），否则使用req直接请求模块（优化后）
            var requestFun = function(callback) {
                return text && text.get ? text.get(req.toUrl(fileName), callback) : req([fileName], callback);
            };

            var callback = function(loadFun, data) {

                // 使用ProtoBufjs加载proto定义
                var builder = loadFun(data);

                builderMap[fileName] = builder;

                // 如果有类型名称参数，则返回builder编译得到指定类型，否则直接返回builder
                if (!!clazzName) {
                    onload(builder.build(clazzName));
                } else {
                    onload(builder);
                }
            };

            requestFun(function(data) {

                // 如果请求到的数据是object则一定为json格式（优化转换过）
                if (typeof data === 'object') {
                    require(['ProtoBuf.noparse'], function(ProtoBufNoparse) {
                        callback(ProtoBufNoparse.loadJson, data);
                    });
                } else if (ext === 'proto') {
                    require(['ProtoBuf'], function(ProtoBuf) {
                        callback(ProtoBuf.loadProto, data);
                    });
                } else {
                    require(['ProtoBuf'], function(ProtoBuf) {
                        if (ProtoBuf.loadJson) {
                            callback(ProtoBuf.loadJson, data);
                        } else {
                            require(['ProtoBuf.noparse'], function(ProtoBufNoparse) {
                                callback(ProtoBufNoparse.loadJson, data);
                            });
                        }
                    });
                }
            });
        }
    }

    // 生成需要写入文件的数据
    function generateWriteFileData(fileName, buildConfig) {

        var data = buildConfig.data;

        // 如果proto2json选项设置为true则将proto数据编译为json数据再写模块
        if (buildConfig.ext === 'proto' && buildConfig.proto2json === true) {
            var ProtoBuf = require('ProtoBuf');
            var parser = new ProtoBuf.DotProto.Parser(buildConfig.data);
            data = JSON.stringify(parser.parse());
            return 'define(\'' + fileName + '\', function() { return ' + data + '})';
        }

        // 不转json的话，则直接将数据模块
        var content = text.jsEscape(data); // 转换字符串中的特殊字符
        return 'define(\'' + fileName + '\', function() { return \'' + content + '\';});';
    }

    var written = {};

    // 优化过程将缓存的文本以模块定义的格式写到输出文件
    function write(pluginName, moduleName, writeFun) {

        // 将缓存的数据写进文件
        for(var fileName in buildMap) {
            var moduleNames = buildMap[fileName].moduleNames;
            for (var index in moduleNames) {
                var name = moduleNames[index];
                if (name === moduleName) {
                    if (!written[fileName]) {
                        writeFun.asModule(fileName, generateWriteFileData(fileName, buildMap[fileName]));
                        written[fileName] = true;
                    }
                    return;
                }
            }
        }
    }

    // expose public functions
    return {
        load: load,
        write: write
    };
});