/**
 * @license requirejs-proto 0.1.0 Copyright (c) 2014 Jiagang
 * see: http://github.com/jiagang/requirejs-proto for details
 */

/** 在nodejs环境中使用amdefine模块添加requirejs的define方法支持 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(['module', 'text', 'ProtoBuf'], function(module, text, ProtoBuf) {

    'use strict';

    var buildMap = {};

    var builderMap = {};

    var options = null;

    var filesCache = {};

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

    function extend(Child, Parent, properties) {
        var F = function(){};
        F.prototype = Parent.prototype;
        var prototype = Child.prototype = new F();
        if (typeof properties === 'object') {
            var keys = Object.keys(properties);
            keys.forEach(function(key) {
                prototype[key] = properties[key];
            });
        }
        prototype.constructor = Child;
        Child.uber = Parent.prototype;
    }

    function WrapperBuilder(options, req, ext, isBuild) {

        ProtoBuf.Builder.call(this, options);
        this.req = req;
        this.ext = ext;
        this.isBuild = isBuild;
    }

    extend(WrapperBuilder, ProtoBuf.Builder, {

        // 得到指定文件的文本内容
        fetchText: function(filename, callback) {

            // build时使用text.get方法取得文件内容，并且将内容缓存下待write时写入压缩文件
            if (this.isBuild) {
                var content = filesCache[filename];
                if (content) {
                    callback(content);
                } else {
                    text.get(this.req.toUrl(filename), function(content) {
                        filesCache[filename] = content;
                        callback(content);
                    });
                }
            } else {

                // 直接使用text插件方式加载文本内容
                this.req(['text!' + filename], function(content) {
                    callback(content);
                });
            }
        },

        // 加载指定文件，解析为json对象后导入到builder中，其中有imports则提出了递归导入
        load: function(filename, done) {

            var files = this.files;
            if (files.hasOwnProperty(filename)) {
                return;
            }
            files[filename] = false;

            var builder = this;
            this.fetchText(filename, function(content) {

                var json;

                if (builder.ext !== 'proto') {
                    json = JSON.parse(content);
                } else {
                    var parser = new ProtoBuf.DotProto.Parser(content);
                    json = parser.parse();
                }

                // 有import文件则递归导入
                if (json['imports'] && json['imports'].length > 0) {

                    var importRoot, delim = '/';

                    if (filename.indexOf("/") >= 0) { // Unix
                        importRoot = filename.replace(/\/[^\/]*$/, "");
                        if (/* /file.proto */ importRoot === "") {
                            importRoot = "/";
                        }
                    } else if (filename.indexOf("\\") >= 0) { // Windows
                        importRoot = filename.replace(/\\[^\\]*$/, "");
                        delim = '\\';
                    } else {
                        importRoot = ".";
                    }
                    json['imports'].forEach(function(eachFileName) {
                        var importFilename = importRoot + delim + eachFileName;
                        builder.load(importFilename, done);
                    });
                    json['imports'] = [];
                }
                builder['import'](json, filename);
                files[filename] = true;

                // 判断所有依赖的file都导入完成了则调用done返回
                var fileNames = Object.keys(files);
                var finish = fileNames.every(function(fileName) {
                    return files[fileName] === true;
                });
                if (finish === true) {
                    builder.resolveAll();
                    done(builder);
                }
            });
        }
    });

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

        var builder;

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
                builder = new WrapperBuilder(options, req, ext, requireConfig.isBuild);
                builder.load(fileNameWithExt, function() {
                    buildMap[fileName] = {
                        modules: [module],
                        files: Object.keys(builder.files),
                        //data: data,
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
        builder = builderMap[fileName];
        if (!!builder) {
            if (!!className) {
                onload(builder.build(className));
            } else {
                onload(builder);
            }
        } else {

            builder = new WrapperBuilder(options, req, ext, requireConfig.isBuild);
            builder.load(fileNameWithExt, function() {
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

    // 生成指定文件名称的文本模块
    function generateProtoTextModule(filename, ext, proto2json) {

        // 指定文件没有写入过
        if (!written[filename]) {

            written[filename] = true;
            var content = filesCache[filename];
            if (ext === 'proto') {
                if (proto2json === true) {
                    var parser = new ProtoBuf.DotProto.Parser(content);
                    content = JSON.stringify(parser.parse());
                }
            } else {
                content = JSON.stringify(JSON.parse(content));
            }

            content = text.jsEscape(content);
            return generateModule('text!' + filename, [], 'function() {return \'' + content + '\';}') + '\n';
        }
        return '';
    }

    // 将proto数据写成对应名称模块，内容为解析proto数据返回builder对象
    function generateProtoBuilderModule(moduleName, files, protoBuf, ext, options) {

        var result = '';

        // 生成依赖的文件模块
        files.forEach(function(filename) {
            result += generateProtoTextModule(filename, ext, options.proto2json);
        });
        ext = (options.proto2json === true ? 'json' : ext);

        var content = 'function(ProtoBuf) {var builder = ProtoBuf.newBuilder({'+
        'convertFieldsToCamelCase:' + options.convertFieldsToCamelCase+
        ',populateAccessors:' + options.populateAccessors+ '});' +
        'var contents = Array.prototype.slice.call(arguments, 1);contents.forEach(function(content) {' +
        (ext === 'proto' ? 'var json = new ProtoBuf.DotProto.Parser(content).parse();' : 'var json = JSON.parse(content);') +
        'delete json[\'imports\'];' +
        'builder[\'import\'](json);});' +
        'builder.resolveAll();return builder;}';

        var deps = files.map(function(file) {
            return 'text!' + file;
        });
        deps.unshift(protoBuf);
        return result + generateModule(moduleName, deps, content);
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
                        writeFun(generateProtoBuilderModule(builderModuleName, protoBuilderModule.files, protoBuilderModule.protoBuf, protoBuilderModule.ext, protoBuilderModule.options));
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