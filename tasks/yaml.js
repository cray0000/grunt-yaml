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
var IMPORT_ANCHOR_FIELD = '__grunt-yaml-specified-anchor';

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

    var includeYamlType, INCLUDE_SCHEMA;

    includeYamlType = new yaml.Type('!include', {
      loadKind: 'scalar',
      loadResolver: function (state) {
        var filename, data, parts, src, anchor, json;

        // Get a specific pointer if present
        parts = state.result.split(' *');
        src = parts[0];
        anchor = parts[1];

        // Load file with proper absolute/relative path handling
        if (src[0] === '/' || src[0] === '\\')
          filename = path.normalize( state.result.slice(1) );
        else
          filename = path.join( path.dirname(state.filename), src );

        // Add .yml/.yaml extension unless explicitly specified
        if (! /\.ya?ml/.test(filename))
          if ( grunt.file.exists(filename + '.yml') )
            filename += '.yml';
          else
            filename += '.yaml';

        data = grunt.file.read(filename, 'utf-8');

        if (anchor) {
          console.log("=================== GETTING ANCHOR " + src);
          console.log("=================== READING FILE " + filename);
          console.log(data);

          // Check whether the included file has anchor specified
          if ( ! (new RegExp(' &' + anchor + '[ \n]+')).test(data) ) {
            grunt.warn('' + filename + ' doesn\'t have anchor &'
                + anchor + '.');
            return false
          }

          data += '\n' + IMPORT_ANCHOR_FIELD + ': *' + anchor;
        }

        // Parse included file
        json = yaml.load( data, {
          schema: INCLUDE_SCHEMA,
          filename: filename
        });

        // Return the whole json result or a particular anchor if specified
        if (anchor)
          state.result = json[IMPORT_ANCHOR_FIELD];
        else
          state.result = json;

        return true;
      }
    });

    INCLUDE_SCHEMA = yaml.Schema.create([ includeYamlType ]);

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
