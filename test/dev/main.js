require.config({
    baseUrl: '.',
    paths: {
        'Long': '../../bower_components/long/dist/Long',
        'ByteBuffer': '../../bower_components/byteBuffer/dist/ByteBufferAB',
        'ProtoBuf': '../../bower_components/protobuf/dist/ProtoBuf',
        'text': '../../bower_components/requirejs-text/text',
        'proto': '../../proto',
        'proto2': '../../proto2'
    },
    proto: {
        ext: 'proto',
        convertFieldsToCamelCase: true,
        populateAccessors: false
    }
});

require(['test'], function() {
    mocha.globals([]).run();
});

//require(['proto2!test.proto'], function(text) {
//    console.log(text);
//});