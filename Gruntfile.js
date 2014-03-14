module.exports = function(grunt) {
    grunt.initConfig({
            pkg: grunt.file.readJSON('package.json')
          , clean: {
                src: ['coverage.html']
            }
          , jshint: {
              , src: {
                    options: {
                        jshintrc: '.jshintrc'
                    }
                  , src: ['*.js']
                }
            }
          , watch: {
                jshint: {
                    files: '<%= jshint.src.src %>'
                    tasks: ['jshint:src']
                }
            }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['cleant', 'jshint', 'watch'])
}
