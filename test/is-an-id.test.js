'use strict';

var async = require('async'),
    expect = require('chai').expect,
    mongoose = require('mongoose'),
    Serializer = require('../index'),
    _ = require('lodash');

describe('mongoose', function() {
    let User = mongoose.model('User', new mongoose.Schema({}, {strict: false})),
        users = [
            new User({
                first: 'donald',
                last: 'trump'
            }),
            new User({
                first: 'bernie',
                last: 'sanders'
            })
        ],
        serializer;

    before(function(done) {
        serializer = new Serializer();
        serializer.define('users', {
            id: 'id',
            processResource(resource, cb) {
                if (_.isFunction(resource.toObject)) {
                    resource = resource.toObject({getters: true});
                }
                cb(null, resource);
            },
            links: {
                self(resource, options, cb) {
                    let link = 'https://www.example.com/api/users/' + resource.id;
                    cb(null, link);
                }
            },
            topLevelLinks: {
                self(options, cb) {
                    let link = 'https://www.example.com/api/users';
                    cb(null, link);
                }
            }
        }, done);
    });

    it('should correctly serialize the data', function(done) {
        serializer.serialize('users', users, function(err, payload) {
            console.log(JSON.stringify(payload));
            expect(err).to.not.exist;
            expect(payload).to.contain.all.keys('data', 'links', 'included', 'meta');
            expect(payload.data).to.be.an('array').with.lengthOf(2);
            payload.data.forEach(function(resource) {
                expect(resource).to.have.property('id').that.is.a('string');
                expect(resource).to.have.property('attributes').that.is.an('object');
                expect(resource.attributes).to.contain.all.keys('first', 'last');
            });
            done(err);
        });
    });
});
