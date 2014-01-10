/*
 * grunt-yaml
 * https://github.com/shiwano/grunt-yaml
 *
 * Copyright (c) 2012 Shogo Iwano
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path');
var yaml = require('js-yaml');
var async = require('async');

module.exports = function(grunt) {
  grunt.registerMultiTask('yaml', 'Compile YAML to JSON', function() {
    var options = this.options({
      constructors: {},
      ignored: null,
      space: 2,
      middleware: function(){},
      disableDest: false
    });
    var taskDone = this.async();

    Object.keys(options.constructors).forEach(function(tag) {
      var constructor = options.constructors[tag];

      yaml.addConstructor(tag, function(node) {
        return constructor.call(this, node, yaml);
      });
    });

    var includeYamlType = new yaml.Type('!include', {
      loadKind: 'scalar',
      loadResolver: function (state) {
        var filename, file;
        if (state.result[0] === '/')
          filename = state.result.slice(1);
        else
          filename = path.join( path.dirname(state.filename), state.result );
        file = grunt.file.read(filename, 'utf-8');
        state.result = yaml.load( file );
        return true;
      }
    });

    var INCLUDE_SCHEMA = yaml.Schema.create([ includeYamlType ]);

    async.forEach(this.files, function(filePair, done) {
      filePair.src.forEach(function(src) {
        if (grunt.file.isDir(src) || (options.ignored && path.basename(src).match(options.ignored))) {
          return done();
        }

        var dest = filePair.dest.replace(/\.ya?ml$/, '.json');
        var data = grunt.file.read(src);

        yaml.loadAll(data, function(result) {
          var json = JSON.stringify(result, null, options.space);
          if(typeof options.middleware === 'function'){
            options.middleware(result, json, src, dest);
          }
          if(!options.disableDest){
            grunt.file.write(dest, json);
            grunt.log.writeln('Compiled ' + src.cyan + ' -> ' + dest.cyan);
          }
          done();
        }, { schema: INCLUDE_SCHEMA, filename: src });
      });
    }, function(err) {
      if (err) {
        grunt.log.error(err);
        return taskDone(false);
      }

      taskDone();
    });
  });
};
