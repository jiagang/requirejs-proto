protobuf的requirejs插件
==================================

提供直接读取proto格式文件生成builder的方法，并且支持requirejs优化时将proto文件转换为json格式

使用方法

    // require配置
    require.config({
        paths: {
            'Long': '../../bower_components/long/dist/Long',
            'ByteBuffer': '../../bower_components/byteBuffer/dist/ByteBufferAB',
            'ProtoBuf': '../../bower_components/protobuf/dist/ProtoBuf',
            'text': '../../bower_components/requirejs-text/text',
            'proto': '../../bower_components/requirejs-proto/proto'
        },
        proto: {
            ext: 'proto', // 加载proto文件的扩展名以及文件格式，只支持proto/json，默认为proto
            convertFieldsToCamelCase: false, // 是否转换字段名，默认false
            populateAccessors: true // 是否创建字段访问器，默认true
        }
    });

    // 加载test.proto文件，得到对应的builder
    require(['proto!test'], function(builder) {
        var pack = builder.build('pack');
        var Message1 = builder.build('pack.Message1');
    });

    // 直接加载test.proto，并得到其中指定类型pack.Message1和pack.Message2
    require(['proto!test::pack.Message1', 'proto!test::pack.Message2'], function(Message1, Message2) {
        ...
    });

编译优化时设置proto2json为true，可以将原依赖的proto文件编译为json格式生成对应的模块写入文件

    proto: {
        proto2json: true // 优化时是否将proto文件编译为json文件
    },
    stubModules: ['text', 'proto', 'ProtoBuf'], // 优化的文件中不再text和proto插件本身，ProtoBuf也移除的话则会自动依赖同目录的ProtoBuf.noparse模块
    findNestedDependencies: true
