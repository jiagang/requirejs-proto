define([], function() {
    describe("requirejsjs-proto", function() {
        it('load builder', function(done) {
            requirejs(['proto!test'], function(builder) {
                var pack = builder.build('pack');
                var Message1 = builder.build('pack.Message1');
                var m = new pack.Message1('test', 1);
                expect(m.prop1).to.eql('test');
                expect(m.prop2).to.eql(1);
                expect(Message1).to.eql(pack.Message1);
                done();
            });
        });
        it('load message', function(done) {
            requirejs(['proto!test::pack.Message1', 'proto!test::pack.Message2'], function(Message1, Message2) {
                var m2 = new Message2(2);
                expect(m2).to.have.property('prop2').with.length(0);
                done();
            });
        });
        it('convertFieldsToCamelCase and populateAccessors', function(done) {
            requirejs(['proto!test::pack.Message3'], function(Message3) {
                var m3 = new Message3(3);
                expect(m3).to.have.property('testProp');
                expect(m3).to.not.have.property('getTestProp');
                done();
            });
        });
    });

    describe("protobufjs", function() {

        var samples = [
            1, -1, 0x80000000|0, 0x7fffffff|0,                    // Integers
            0.1, 0.2, 1.234,                                      // Doubles
            "John",                                               // String
            true, false,                                          // Booleans
            null,                                                 // null
            [],                                                   // Array
            {},                                                   // Object
            undefined,                                            // undefined
            [                                                     // Array holding each data type
                1,
                0.1,
                "John",
                true,
                false,
                null,
                [],
                {},
                undefined
            ],
            {                                                     // Object holding each data type
                1: 1,
                0.1: 0.1,
                "John": "John",
                true: true,
                false: false,
                null: null,
                array: [],
                object: {},
                undefined: undefined
            }
        ];

        it('parse proto file', function(done) {
            requirejs(['protoify', 'proto!json.proto::js'], function(protoify, JS) {
                samples.forEach(function(sample) {
                    // Encode each sample to a Buffer
                    var buf = protoify(sample, JS);

                    // Decode the Buffer back to JSON
                    var decodedSample = protoify.parse(buf, JS);

                    // And expect that it's actually equal
                    expect(decodedSample).to.eql(sample);
                });
                done();
            });
        });

        it('parse json file', function(done) {
            requirejs(['protoify', 'proto!json.json::js'], function(protoify, JS) {
                samples.forEach(function(sample) {
                    // Encode each sample to a Buffer
                    var buf = protoify(sample, JS);

                    // Decode the Buffer back to JSON
                    var decodedSample = protoify.parse(buf, JS);

                    // And expect that it's actually equal
                    expect(decodedSample).to.eql(sample);
                });
                done();
            });
        });

        it('muitiple proto file', function(done) {
            requirejs(['proto!multiple/proto1::Message3', 'proto!multiple/proto3::Message3'], function(MessageFromProto1, MessageFromProto3) {
                var data = {
                    prop1: 'test',
                    prop2: 2
                };
                var message1 = new MessageFromProto1(data);
                var byteBuffer = message1.encode();

                var message2 = MessageFromProto3.decode(byteBuffer);

                expect(message1.toRaw()).to.eql(message2.toRaw());
                done();
            });
        });
    });
});