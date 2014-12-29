/**
 * @license requirejs-proto 0.1.0 Copyright (c) 2014 Jiagang
 * see: http://github.com/jiagang/requirejs-proto for details
 */
define(['module', 'text', 'ProtoBuf'], function(module, text, ProtoBuf) {

    'use strict';

    var buildMap = {};

    var builderMap = {};

    function load(name, req, onload, requireConfig) {

        // 扩展名只支持proto和json两种
        var defaultExt = (requireConfig.proto && requireConfig.proto.ext) || 'proto';

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

            // 默认proto2json为false
            var proto2json = (requireConfig.proto && requireConfig.proto.proto2json) || false;

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
                        ext: ext,
                        data: data,
                        proto2json: proto2json,
                        protoBuf: protoBuf
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
                    builder = ProtoBuf.loadProto(data);
                } else {
                    builder = ProtoBuf.loadJson(data);
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
            deps.map(function(dep) {return '\'' + dep + '\'';}).join(',') + '], ' + content + ')';
    }

    // 将proto数据写成对应名称模块，内容为解析proto数据返回builder对象
    function generateProtoBuilderModule(moduleName, protoData, ext, proto2json, protoBuf) {

        var data = protoData;

        // 将proto格式数据转为json格式
        if (ext === 'proto') {
            if (proto2json === true) {
                var parser = new ProtoBuf.DotProto.Parser(data);
                data = JSON.stringify(parser.parse());
                ext = 'json';
            }
        } else {
            data = JSON.stringify(JSON.parse(data));
        }
        var content = 'function(ProtoBuf) {return ProtoBuf.' + (ext === 'proto' ? 'loadProto' : 'loadJson') + '(\'' + text.jsEscape(data) + '\')}';

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
                        writeFun(generateProtoBuilderModule(builderModuleName, protoBuilderModule.data, protoBuilderModule.ext, protoBuilderModule.proto2json, protoBuilderModule.protoBuf));
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