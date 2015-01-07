/**
 * @license requirejs-proto 0.1.0 Copyright (c) 2014 Jiagang
 * see: http://github.com/jiagang/requirejs-proto for details
 */
define(['module', 'text', 'ProtoBuf'], function(module, text, ProtoBuf) {

    'use strict';

    var buildMap = {};

    var builderMap = {};

    var options = null;

    /**
     * 初始化参数设置
     * @param requireConfig
     */
    function initOptions(requireConfig) {
        if (!options) {
            var proto = requireConfig && requireConfig.proto || {};
            options = {

                // 扩展名只支持proto和json两种，默认扩展名为proto
                ext: proto.ext || 'proto',

                // 是否在requirejs优化时转换proto文件为json格式，默认不转换
                proto2json: proto.proto2json !== undefined ? proto.proto2json : false,

                // 设置ProtobufJs的参数convertFieldsToCamelCase，控制是否转换字段名为驼峰格式，不设置按照ProtobufJs默认值
                convertFieldsToCamelCase: proto.convertFieldsToCamelCase,

                // 设置ProtobufJs的参数populateAccessors，控制是否创建字段对应访问器（get/set），不设置按照ProtobufJs默认值
                populateAccessors: proto.populateAccessors
            };
        }
        return options;
    }

    function load(name, req, onload, requireConfig) {

        var options = initOptions(requireConfig);

        var defaultExt = options.ext;

        // 解析name，取得其中的文件名称和请求的proto类型名称
        var arr = name.split('::');
        var fileName = arr[0];
        var fileNameWithExt = fileName;

        // 如果名称中不包含扩展名.proto或者.json，则添加默认扩展名
        var ext = fileName.split('.').pop();
        if (ext.toLowerCase() === 'proto' || ext.toLowerCase() === 'json') {
            ext = ext.toLowerCase();
        } else {
            fileNameWithExt = fileName + '.' + defaultExt;
            ext = defaultExt;
        }

        var className = (arr.length > 1) && arr[1];

        // 优化时请求对应文件后缓存
        if (requireConfig.isBuild) {

            var proto2json = options.proto2json;
            var protoBuf = 'ProtoBuf';

            // 如果proto2json为true并且设置了stubModules移除了'ProtoBuf'模块则加载同目录下的'ProtoBuf.noparse'模块
            // 注意如果对应的ProtoBuf.noparse.js文件不存在会报错
            if (proto2json && requireConfig.modules[0].stubModules.indexOf('ProtoBuf') >= 0) {

                // 如果paths中已经存在'ProtoBuf.noparse'这个名称的模块，则不再设置
                if (!requireConfig.paths['ProtoBuf.noparse']) {
                    requireConfig.paths['ProtoBuf.noparse'] = requireConfig.paths['ProtoBuf'] + '.noparse';
                }
                req(['ProtoBuf.noparse']);
                protoBuf = 'ProtoBuf.noparse';
            }

            var module = {
                name: name,
                className: className
            };

            if (!buildMap[fileName]) {
                text.get(req.toUrl(fileNameWithExt), function(data) {
                    buildMap[fileName] = {
                        modules: [module],
                        data: data,
                        protoBuf: protoBuf,
                        ext: ext,
                        options: options
                    };

                    onload();
                });
            } else {
                buildMap[fileName].modules.push(module);
                onload();
            }
            return;
        }

        // 缓存的builder存在则直接返回，否则异步请求文件后返回
        var builder = builderMap[fileName];
        if (!!builder) {
            if (!!className) {
                onload(builder.build(className));
            } else {
                onload(builder);
            }
        } else {
            text.get(req.toUrl(fileNameWithExt), function(data) {

                var builder = null;
                if (ext === 'proto') {
                    builder = ProtoBuf.loadProto(data, ProtoBuf.newBuilder(options));
                } else {
                    builder = ProtoBuf.loadJson(data, ProtoBuf.newBuilder(options));
                }

                builderMap[fileName] = builder;

                // 如果有类型名称参数，则返回builder编译得到指定类型，否则直接返回builder
                if (!!className) {
                    onload(builder.build(className));
                } else {
                    onload(builder);
                }
            });
        }
    }

    var written = {};

    function generateModule(moduleName, deps, content) {
        return 'define(\'' + moduleName + '\', [' +
            deps.map(function(dep) {return '\'' + dep + '\'';}).join(',') + '], ' + content + ');';
    }

    // 将proto数据写成对应名称模块，内容为解析proto数据返回builder对象
    function generateProtoBuilderModule(moduleName, protoData, protoBuf, ext, options) {

        var data = protoData;

        // 将proto格式数据转为json格式
        if (ext === 'proto') {
            if (options.proto2json === true) {
                var parser = new ProtoBuf.DotProto.Parser(data);
                data = JSON.stringify(parser.parse());
                ext = 'json';
            }
        } else {
            data = JSON.stringify(JSON.parse(data));
        }

        // 如果设置了options中的convertFieldsToCamelCase或者populateAccessors则创建builder
        var builderStr = '';
        if (options.convertFieldsToCamelCase !== undefined || options.populateAccessors !== undefined) {
            builderStr = ',ProtoBuf.newBuilder({'+
            'convertFieldsToCamelCase:' + options.convertFieldsToCamelCase+
            ',populateAccessors:' + options.populateAccessors+ '})';
        }
        var content = 'function(ProtoBuf) {return ProtoBuf.' + (ext === 'proto' ? 'loadProto' : 'loadJson') +
            '(\'' + text.jsEscape(data) + '\'' + builderStr + ');}';

        return generateModule(moduleName, [protoBuf], content);
    }

    // 生成消息类型模块，内容为依赖builder模块再build编译返回对应的消息类型
    function generateMessageModule(moduleName, builderModuleName, className) {
        var content = 'function(builder) {return builder.build(\'' + className + '\');}';
        return generateModule(moduleName, [builderModuleName], content);
    }

    function write(pluginName, moduleName, writeFun) {

        // 将模块写入文件，将proto数据的编译过程写入，移除对本身插件的依赖
        for(var fileName in buildMap) {
            var protoBuilderModule = buildMap[fileName];
            var modules = protoBuilderModule.modules;
            for (var index in modules) {
                var module = modules[index];
                if (module.name === moduleName) {
                    var builderModuleName = [pluginName, fileName].join('!');
                    if (!written[builderModuleName]) {

                        // 将buildMap中的proto数据写成对应名称模块
                        writeFun(generateProtoBuilderModule(builderModuleName, protoBuilderModule.data, protoBuilderModule.protoBuf, protoBuilderModule.ext, protoBuilderModule.options));
                        written[builderModuleName] = true;
                    }

                    // 将本身模块如果有指定消息类型名称，则生成消息类型模块
                    if (module.className) {
                        writeFun(generateMessageModule([pluginName, moduleName].join('!'), builderModuleName, module.className));
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