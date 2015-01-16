/** nodejs环境下测试脚本 */

global.requirejs = require('requirejs');
global.define = require('amdefine')(module);

requirejs.config({
    baseUrl: __dirname,
    paths: {
        'Long': '../../bower_components/long/dist/Long',
        'ByteBuffer': '../../bower_components/byteBuffer/dist/ByteBufferAB',
        'ProtoBuf': '../../bower_components/protobuf/dist/ProtoBuf',
        'text': '../../bower_components/requirejs-text/text',
        'proto': '../../proto'
    },
    proto: {
        ext: 'proto',
        convertFieldsToCamelCase: true,
        populateAccessors: false
    },
    nodeRequire: require
});

global.expect = require('chai').expect;

var Mocha = require('mocha');
var mocha = new Mocha();

mocha.files = [__dirname + '/test.js'];
mocha.run(process.exit);
