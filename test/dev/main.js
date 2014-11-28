require.config({
    baseUrl: '.',
    paths: {
        'Long': '../../bower_components/long/dist/Long',
        'ByteBuffer': '../../bower_components/byteBuffer/dist/ByteBufferAB',
        'ProtoBuf': '../../bower_components/protobuf/dist/ProtoBuf',
        'text': '../../bower_components/requirejs-text/text',
        'proto': '../../proto'
    }
});

require(['test'], function() {
    mocha.globals([]).run();
});