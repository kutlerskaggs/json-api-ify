'use strict';

var async = require('async'),
    expect = require('chai').expect,
    mongoose = require('mongoose'),
    ObjectId = require('mongodb').ObjectId,
    Serializer = require('../index'),
    _ = require('lodash');

describe('mongoose', function() {
    let User = mongoose.model('User', new mongoose.Schema({}, {strict: false})),
        users = [
            new User({
                first: 'donald',
                last: 'trump',
                comments: [
                    new ObjectId(),
                    new ObjectId()
                ]
            }),
            new User({
                first: 'bernie',
                last: 'sanders'
            })
        ],
        serializer;

    before(function(done) {
        serializer = new Serializer();
        serializer.on('error', function(err) {
            console.error(err);
        });
        async.parallel({
            users: function(fn) {
                serializer.define('users', {
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
                    relationships: {
                        comments: {
                            type: 'comments',
                            include: true
                        }
                    },
                    topLevelLinks: {
                        self(options, cb) {
                            let link = 'https://www.example.com/api/users';
                            cb(null, link);
                        }
                    }
                }, fn);
            },
            comments: function(fn) {
                serializer.define('comments', {
                    processResource(resource, cb) {
                        if (_.isFunction(resource.toObject)) {
                            resource = resource.toObject({getters: true});
                        }
                        cb(null, resource);
                    },
                    links: {
                        self(resource, options, cb) {
                            let link = 'https://www.example.com/api/comments/' + resource.id;
                            cb(null, link);
                        }
                    },
                    relationships: {
                        author: {
                            type: 'comments',
                            include: true
                        }
                    },
                    topLevelLinks: {
                        self(options, cb) {
                            let link = 'https://www.example.com/api/comments';
                            cb(null, link);
                        }
                    }
                }, fn);
            }
        }, done);

    });

    it('should correctly serialize the data', function(done) {
        serializer.serialize('users', users, function(err, payload) {
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
