
module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({

        // clean
        // ---------------
        // Clean away the old generated file to make sure we can generate a new.
        clean: {
            optimized: ['test/build']
        },

        copy: {
            build: {
                expand: true,
                cwd: 'test/dev',
                src: ['index.html'],
                dest: 'test/build'
            }
        },

        // requirejs
        // ---------------
        requirejs: {
            build: {
                options: {
                    //optimize: 'none',
                    almond: true,
                    baseUrl: 'test/dev',
                    mainConfigFile: 'test/dev/main.js',
                    out: 'test/build/main.js',
                    name: 'main',
                    proto: {
                        proto2json: true // 优化时是否将proto文件编译为json文件
                    },
                    stubModules: ['text', 'proto', 'ProtoBuf'],
                    findNestedDependencies: true
                }
            }
        },

        usemin: {
            html: ['test/build/*.html']
        },

        connect: {
            tests: {
                options: {
                    port: 8080,
                    base: '.'
                }
            }
        },

        // mocha
        // ---------
        mocha: {
            dev: {
                options: {
                    urls: ['http://localhost:8080/test/dev/']
                }
            }
        },

        jshint: {
            options: {
                curly: true,
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: true,
                unused: true,
                boss: true,
                eqnull: true,
                browser: true,
                globals: {
                    define: true,
                    require: true,
                    module: true,
                    console: true
                }
            },
            gruntfile: {
                src: 'Gruntfile.js'
            },
            plugin: {
                src: ['proto.js']
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-requirejs');
    grunt.loadNpmTasks('grunt-mocha');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-usemin');

    // grunt-mocha使用phantomjs不支持Function.prototype.bind
    // grunt.registerTask('test', ['jshint', 'connect', 'mocha']);
    grunt.registerTask('build', ['jshint', 'clean', 'copy', 'requirejs', 'usemin']);

};
