"use strict";

// switch to testing mode
process.env.NODE_ENV = 'testing';

var utils              = require('../../lib/utils'),
    PopIt              = require('../../lib/popit'),
    partialDatePlugin    = require('../../lib/schemas/plugins/partial-date'),
    async              = require('async'),
    _                  = require('underscore'),
    mongoose          = require('mongoose'),
    Schema            = mongoose.Schema;
    
    
    
    
var test_dates = [
  { name: '2012',       start: '2012-01-01', end: '2012-12-31', },
  { name: '2013',       start: '2013-01-01', end: '2013-12-31', },

  { name: 'Q1 2012',    start: '2012-01-01', end: '2012-03-31', },
  { name: 'Q2 2012',    start: '2012-04-01', end: '2012-06-30', },

  { name: 'Jan 2012',   start: '2012-01-01', end: '2012-01-31', },
  { name: 'Feb 2012',   start: '2012-02-01', end: '2012-02-28', },
  { name: 'Mar 2012',   start: '2012-03-01', end: '2012-03-31', },
  { name: 'Apr 2012',   start: '2012-04-01', end: '2012-04-30', },
  { name: 'May 2012',   start: '2012-05-01', end: '2012-05-31', },
                                                                
  { name: '1 Jan 2012', start: '2012-01-01', end: '2012-01-01', },
  { name: '2 Jan 2012', start: '2012-01-02', end: '2012-01-02', },
  { name: '3 Jan 2012', start: '2012-01-03', end: '2012-01-03', },

  { name: '1 Jan 2013', start: '2013-01-01', end: '2013-01-01', },
];



var TestSchema = new Schema({
    name: String,  
});
TestSchema.plugin( partialDatePlugin, {fieldName: 'theDate'} );


module.exports = {
    
  setUp: function(cb) {

    this.popit  = new PopIt();
    this.popit.set_instance('test');

    var db = this.popit.instance_db();

    var TestModel = this.test_model = db.model( 'TestModel', TestSchema );

    utils.delete_all_testing_databases(function(err) {

      if (err) return cb(err);
      
      async.forEach(
        test_dates,
        function(item, done) {

          var entry = new TestModel({
            name: item.name,
            theDate: {
              start: item.start,
              end:   item.end,
            },
          });

          entry.save(done);

        },
        cb
      );
      
    });
  },
  
  tearDown: function(cb) {
    this.popit.close_db_connections(cb);
  },
  
  "test sorting asc": function ( test ) {    
    test.expect( 2 );    

    this.test_model
      .find()
      .sort('theDate.start theDate.end')
      // .sort('theDate')
      .exec(function(err, docs) {
        test.ifError(err);
        test.deepEqual(
          _.pluck(docs, 'name'),
          [ 
            '1 Jan 2012',
            'Jan 2012',
            'Q1 2012',
            '2012',
            '2 Jan 2012',
            '3 Jan 2012',
            'Feb 2012',
            'Mar 2012',
            'Apr 2012',
            'Q2 2012',
            'May 2012',
            '1 Jan 2013',
            '2013',
          ],
          "asc sorting as expected"
        );
      test.done();
    });
  },

  "test sorting desc": function ( test ) {
    test.expect( 2 );    

    this.test_model
      .find()
      .sort('-theDate.end -theDate.start')
      // .sort('-theDate')
      .exec(function(err, docs) {
        test.ifError(err);
        test.deepEqual(
          _.pluck(docs, 'name'),
          [
            '2013',
            '1 Jan 2013',
            '2012',
            'Q2 2012',
            'May 2012',
            'Apr 2012',
            'Mar 2012',
            'Q1 2012',
            'Feb 2012',
            'Jan 2012',
            '3 Jan 2012',
            '2 Jan 2012',
            '1 Jan 2012',
          ],
          "desc sorting as expected"
        );
      test.done();
    });
  },


  "test stringification": function ( test ) {
    test.expect( 2 );    

    this.test_model
      .find()
      .sort('name')
      .exec(function(err, docs) {
        test.ifError(err);
        test.deepEqual(
          _.map(docs, function (doc) {
            return [ doc.name, doc.theDate.format ];
          }),
          [
            [ '1 Jan 2012', 'Jan 1, 2012' ],
            [ '1 Jan 2013', 'Jan 1, 2013' ],
            [ '2 Jan 2012', 'Jan 2, 2012' ],
            [ '2012',       'Jan 1 - Dec 31, 2012' ],
            [ '2013',       'Jan 1 - Dec 31, 2013' ],
            [ '3 Jan 2012', 'Jan 3, 2012' ],
            [ 'Apr 2012',   'Apr 1 - 30, 2012' ],
            [ 'Feb 2012',   'Feb 1 - 28, 2012' ],
            [ 'Jan 2012',   'Jan 1 - 31, 2012' ],
            [ 'Mar 2012',   'Mar 1 - 31, 2012' ],
            [ 'May 2012',   'May 1 - 31, 2012' ],
            [ 'Q1 2012',    'Jan 1 - Mar 31, 2012' ],
            [ 'Q2 2012',    'Apr 1 - Jun 30, 2012' ],
          ],
          "desc sorting as expected"
        );
      test.done();
    });
  },



  "test stringification with no dates": function ( test ) {
    test.expect( 1 );    

    var entry = new this.test_model({name: 'foo'});

    test.equal( entry.theDate.format, '', "No dates leads to empty string" );

    test.done();
  },



  "test validation": function ( test ) {

    var TestModel = this.test_model;

    var validation_tests = [
      {
        constructor_args: {
          name: 'test of start > end',
          theDate: {
            start: Date.parse( '2012-01-20'),
            end:   Date.parse( '2012-01-19'),
          }
        },
        error_path: 'theDate.start',
        error_type: 'start date is after end date',
      },
      {
        constructor_args: {
          name: 'start missing',
          theDate: {
            end:   Date.parse( '2012-01-19'),
          }
        },
        error_path: 'theDate.end',
        error_type: 'start date is missing',
      },      
      {
        constructor_args: {
          name: 'end missing',
          theDate: {
            start:   Date.parse( '2012-01-19'),
          }
        },
        error_path: 'theDate.start',
        error_type: 'end date is missing',
      },      
    ];



    test.expect( validation_tests.length * 2 );    

    async.forEachSeries(
      validation_tests,
      function(item, item_done) {

        var entry = new TestModel( item.constructor_args );

        entry.save( function(err) {

          // console.log(entry);
          // console.log(err);

          test.ok( err, "Got an error" );
          test.equal(
            err.errors[item.error_path].type,
            item.error_type,
            "got correct error: " + item.error_type
          );
          item_done(null);
        });        
      },
      function (err) {
        test.done();
      }
    
    );
    
  },


};