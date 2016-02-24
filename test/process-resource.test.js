'use strict';

var async = require('async'),
    chai = require('chai'),
    Serializer = require('../index'),
    _ = require('lodash');

let expect = chai.expect;

describe('[hook] processResource', function() {
    let error, payload;

    let serializer = new Serializer(),
        data = [{
            toJSON() {
                return this._attrs;
            },
            _attrs: {
                name: 'Bob',
                secret: 'abc',
                public: '123'
            }
        }];

    before(function(done) {
        async.series([
            function defineType(fn) {
                serializer.define('test', {
                    id: 'name',
                    blacklist: [
                        'secret'
                    ],
                    processResource(resource, cb) {
                        cb(null, resource.toJSON());
                    }
                }, fn);
            },

            function serializeData(fn) {
                serializer.serialize('test', data, function(e, p) {
                    error = e;
                    payload = p;
                    fn();
                });
            }
        ], done);
    });

    it('should not error', function() {
        expect(error).to.not.exist;
    });

    it('should correctly serialize the data', function() {
        expect(payload).to.have.property('data').that.is.an('array').with.lengthOf(1);
        expect(payload.data[0]).to.have.property('id', 'Bob');
        expect(payload.data[0]).to.have.property('attributes').that.is.an('object').with.all.keys('public');
    });
});
