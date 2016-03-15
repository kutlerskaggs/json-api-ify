'use strict';

var async = require('async'),
    chai = require('chai'),
    mongoose = require('mongoose'),
    Serializer = require('../index'),
    queryString = require('query-string'),
    _ = require('lodash'),
    ObjectID = require("bson-objectid");

let expect = chai.expect;

describe('basic tests', function() {
    let dataset = [{
        _id: 1,
        first: 'tim',
        last: 'tebow',
        email: 'ttebow@example.com',
        phone: {
            home: null,
            mobile: '+18001234567'
        },
        groups: [{
            name: 'admins',
            desc: 'site admins'
        },{
            name: 'users',
            desc: 'all users'
        }]
    },{
        _id: 2,
        first: 'kanye',
        last: 'west',
        email: 'kwest@example.com',
        phone: {
            home: null,
            mobile: '+18001234567'
        },
        groups: [{
            name: 'users',
            desc: 'all users'
        }]
    }];

    let serializer = new Serializer({
        baseUrl: 'https://www.example.com',
        includeSerializationTime: true,
        processResource(resource) {
            if (typeof resource.toObject === 'function') {
                resource = resource.toObject();
            } else if (resource instanceof mongoose.Types.ObjectId) {
                resource = resource.toString();
            }
            return resource;
        }
    });

    serializer.on('error', function(err) {
        console.error(err);
    });

    // configure serializer
    before(function(done) {
        async.auto({
            user: function defineDefaultUserSchema(fn) {
                serializer.define('users', {
                    id: '_id',
                    blacklist: [
                        'email',
                        'phone.home'
                    ],
                    links: {
                        self(resource, options, cb) {
                            let link = options.baseUrl + '/api/users/' + resource.id;
                            cb(null, link);
                        }
                    },
                    meta: {
                        test: function(resource, options, cb) {
                            cb(null, 'test-' + resource.id);
                        }
                    },
                    relationships: {
                        groups: {
                            type: 'groups',
                            include: true,
                            links: {
                                self(resource, options, cb) {
                                    let link = options.baseUrl + '/api/users/' + resource.id + '/groups';
                                    cb(null, link);
                                },
                                related(resource, options, cb) {
                                    let link = options.baseUrl + '/api/users/' + resource.id + '/relationships/groups';
                                    cb(null, link);
                                }
                            }
                        }
                    },
                    topLevelLinks: {
                        self(options, cb) {
                            let link = options.baseUrl + '/api/users',
                                query = _.get(options, 'request.query');
                            if (query) {
                                link += '?' + queryString.stringify(query);
                            }
                            cb(null, link);
                        },
                        next(options, cb) {
                            let link = options.baseUrl + '/api/users',
                                query = _.get(options, 'request.query') || {},
                                next = _.get(options, 'request.nextKey');
                            if (next) {
                                query['page[cursor]'] = next;
                                link += '?' + queryString.stringify(query);
                            } else {
                                link = undefined;
                            }
                            cb(null, link);
                        }
                    },
                    topLevelMeta: {
                        'api-version': 'v1.3.9',
                        total: function(options, cb) {
                            let total = _.get(options, 'request.total');
                            cb(null, total);
                        }
                    }
                }, fn);
            },

            userPublic: function definePublicUserSchema(fn) {
                serializer.define('users', 'public', {
                    whitelist: [
                        'first',
                        'last'
                    ]
                }, fn);
            },

            group: function defineDefaultGroupSchema(fn) {
                serializer.define('groups', {
                    id: 'name',
                    links: {
                        self(resource, options, cb) {
                            let link = options.baseUrl + '/api/groups/' + resource.id;
                            cb(null, link);
                        }
                    },
                    relationships: {
                        users: {
                            type: 'users',
                            schema: 'public',
                            include: true,
                            links: {
                                self(resource, options, cb) {
                                    let link = options.baseUrl + '/api/groups/' + resource.id + '/users';
                                    cb(null, link);
                                },
                                related(resource, options, cb) {
                                    let link = options.baseUrl + '/api/groups/' + resource.id + '/relationships/users';
                                    cb(null, link);
                                }
                            }
                        }
                    },
                    topLevelLinks: {
                        self(options, cb) {
                            let link = options.baseUrl + '/api/groups';
                            cb(null, link);
                        }
                    }
                }, fn);
            },
        }, done);
    });

    context('with no options', function() {
        let err, payload;

        before(function(done) {
            serializer.serialize('users', dataset, function(e, p) {
                err = e;
                payload = p;
                done(e);
            });
        });

        it('should not error', function() {
            expect(err).to.not.exist;
        });

        it('shoud return a valid payload', function() {
            expect(payload).to.be.an('object').and.contain.all.keys('links', 'data', 'included', 'meta');
        });

        it('should return the correct top level links', function() {
            expect(payload.links).to.have.property('self', 'https://www.example.com/api/users');
            expect(payload.links).to.not.have.property('next');
        });

        it('should return the correct top level meta', function() {
            expect(payload.meta).to.have.property('serializationTime').that.is.a('string');
            expect(payload.meta).to.not.have.property('total');
            expect(payload.meta).to.have.property('api-version', 'v1.3.9');
        });

        it('should include 2 serialized users', function() {
            expect(payload.data).to.have.lengthOf(2);
            expect(_.map(payload.data, 'id')).to.eql([1,2]);
            expect(_.map(payload.data, 'type')).to.eql(['users', 'users']);
            payload.data.forEach(function(resource) {
                expect(resource).to.be.an('object')
                    .and.contain.all.keys('type', 'id', 'attributes')
                    .and.contain.any.keys('meta', 'links', 'relationships');
            });
        });

        it('should include the appropriate attributes', function() {
            payload.data.forEach(function(resource) {
                expect(resource.attributes).to.contain.all.keys('first', 'last');
                expect(resource.attributes).to.have.deep.property('phone.mobile');
                expect(resource.attributes).to.not.have.property('email');
                expect(resource.attributes).to.not.have.deep.property('phone.home');
            });
        });

        it('each resource should include the correct relationships', function() {
            let tim = payload.data[0],
                kanye = payload.data[1];
            expect(tim).to.have.property('relationships').that.is.an('object').with.property('groups');
            expect(tim.relationships.groups).to.be.an('object').with.all.keys('links', 'data', 'meta');
            expect(tim.relationships.groups.data).to.have.lengthOf(2);
            tim.relationships.groups.data.forEach(function(rel) {
                expect(rel).to.be.an('object').with.all.keys('id', 'type', 'links', 'meta');
            });
            expect(_.map(tim.relationships.groups.data, 'id')).to.eql(['admins', 'users']);

            expect(kanye).to.have.property('relationships').that.is.an('object').with.property('groups');
            expect(kanye.relationships.groups).to.be.an('object').with.all.keys('links', 'data', 'meta');
            expect(kanye.relationships.groups.data).to.have.lengthOf(1);
            kanye.relationships.groups.data.forEach(function(rel) {
                expect(rel).to.be.an('object').with.all.keys('id', 'type', 'links', 'meta');
            });
            expect(_.map(kanye.relationships.groups.data, 'id')).to.eql(['users']);
        });

        it('each resource should include the correct meta', function() {
            payload.data.forEach(function(resource) {
                expect(resource).to.have.property('meta').that.is.an('object').with.keys('test');
                expect(resource.meta.test).to.equal('test-' + resource.id);
            });
        });

        it('should include the correct related resources in the `included` attribute', function() {
            expect(payload.included).to.be.an('array').with.lengthOf(2);
            expect(_.map(payload.included, 'id')).to.contain('admins').and.contain('users');
        });
    });

    context('with request options', function() {
        let err, payload;

        before(function(done) {
            serializer.serialize('users', dataset, {
                request: {
                    query: {
                        id: 'lte(20)'
                    },
                    nextKey: 10,
                    total: 1000
                }
            }, function(e, p) {
                err = e;
                payload = p;
                done(e);
            });
        });

        it('should not error', function() {
            expect(err).to.not.exist;
        });

        it('should return a valid payload', function() {
            expect(payload).to.be.an('object').and.contain.all.keys('links', 'data', 'included', 'meta');
        });

        it('should return the correct top level links', function() {
            expect(payload.links).to.have.property('self').that.contains('https://www.example.com/api/users?');
            expect(payload.links).to.have.property('next').that.contains('page').and.contains('cursor');
        });

        it('should return the correct top level meta', function() {
            expect(payload.meta).to.have.property('serializationTime').that.is.a('string');
            expect(payload.meta).to.have.property('total', 1000);
            expect(payload.meta).to.have.property('api-version', 'v1.3.9');
        });

        it('should include 2 serialized users', function() {
            expect(payload.data).to.have.lengthOf(2);
            expect(_.map(payload.data, 'id')).to.eql([1,2]);
            expect(_.map(payload.data, 'type')).to.eql(['users', 'users']);
            payload.data.forEach(function(resource) {
                expect(resource).to.be.an('object')
                    .and.contain.all.keys('type', 'id', 'attributes')
                    .and.contain.any.keys('meta', 'links', 'relationships');
            });
        });

        it('should include the appropriate attributes', function() {
            payload.data.forEach(function(resource) {
                expect(resource.attributes).to.contain.all.keys('first', 'last');
                expect(resource.attributes).to.have.deep.property('phone.mobile');
                expect(resource.attributes).to.not.have.property('email');
                expect(resource.attributes).to.not.have.deep.property('phone.home');
            });
        });

        it('each resource should include the correct relationships', function() {
            let tim = payload.data[0],
                kanye = payload.data[1];
            expect(tim).to.have.property('relationships').that.is.an('object').with.property('groups');
            expect(tim.relationships.groups).to.be.an('object').with.all.keys('links', 'data', 'meta');
            expect(tim.relationships.groups.data).to.have.lengthOf(2);
            tim.relationships.groups.data.forEach(function(rel) {
                expect(rel).to.be.an('object').with.all.keys('id', 'type', 'links', 'meta');
            });
            expect(_.map(tim.relationships.groups.data, 'id')).to.eql(['admins', 'users']);

            expect(kanye).to.have.property('relationships').that.is.an('object').with.property('groups');
            expect(kanye.relationships.groups).to.be.an('object').with.all.keys('links', 'data', 'meta');
            expect(kanye.relationships.groups.data).to.have.lengthOf(1);
            kanye.relationships.groups.data.forEach(function(rel) {
                expect(rel).to.be.an('object').with.all.keys('id', 'type', 'links', 'meta');
            });
            expect(_.map(kanye.relationships.groups.data, 'id')).to.eql(['users']);
        });

        it('each resource should include the correct meta', function() {
            payload.data.forEach(function(resource) {
                expect(resource).to.have.property('meta').that.is.an('object').with.keys('test');
                expect(resource.meta.test).to.equal('test-' + resource.id);
            });
        });

        it('should include the correct related resources in the `included` attribute', function() {
            expect(payload.included).to.be.an('array').with.lengthOf(2);
            expect(_.map(payload.included, 'id')).to.contain('admins').and.contain('users');
        });
    });

    context('with non default schema', function() {
        let err, payload;

        before(function(done) {
            serializer.serialize('users', 'public', dataset, {
                request: {
                    query: {
                        id: 'lte(20)'
                    },
                    nextKey: 10,
                    total: 1000
                }
            }, function(e, p) {
                err = e;
                payload = p;
                done(e);
            });
        });

        it('should not error', function() {
            expect(err).to.not.exist;
        });

        it('shoud return a valid payload', function() {
            expect(payload).to.be.an('object').and.contain.all.keys('links', 'data', 'included', 'meta');
        });

        it('should return the correct top level links', function() {
            expect(payload.links).to.have.property('self').that.contains('https://www.example.com/api/users?');
            expect(payload.links).to.have.property('next').that.contains('page').and.contains('cursor');
        });

        it('should return the correct top level meta', function() {
            expect(payload.meta).to.have.property('serializationTime').that.is.a('string');
            expect(payload.meta).to.have.property('total', 1000);
            expect(payload.meta).to.have.property('api-version', 'v1.3.9');
        });

        it('should include 2 serialized users', function() {
            expect(payload.data).to.have.lengthOf(2);
            expect(_.map(payload.data, 'id')).to.eql([1,2]);
            expect(_.map(payload.data, 'type')).to.eql(['users', 'users']);
            payload.data.forEach(function(resource) {
                expect(resource).to.be.an('object')
                    .and.contain.all.keys('type', 'id', 'attributes')
                    .and.contain.any.keys('meta', 'links', 'relationships');
            });
        });

        it('should blacklist the appropriate attributes', function() {
            payload.data.forEach(function(resource) {
                expect(resource.attributes).to.have.keys('first', 'last');
                expect(resource.attributes).to.not.have.deep.property('phone.mobile');
                expect(resource.attributes).to.not.have.property('email');
                expect(resource.attributes).to.not.have.deep.property('phone.home');
            });
        });

        it('each resource should include the correct relationships', function() {
            payload.data.forEach(function(resource) {
                expect(resource.relationships).to.eql({});
            });
        });

        it('each resource should include the correct meta', function() {
            payload.data.forEach(function(resource) {
                expect(resource).to.have.property('meta').that.is.an('object').with.keys('test');
                expect(resource.meta.test).to.equal('test-' + resource.id);
            });
        });

        it('should include the correct related resources in the `included` attribute', function() {
            expect(payload.included).to.be.an('array').with.lengthOf(0);
        });
    });

    context('single document', function() {
        let dataset2 = {
            name: 'users',
            desc: 'site admins',
            users: [{
                _id: 1,
                first: 'tim',
                last: 'tebow',
                email: 'ttebow@example.com',
                phone: {
                    home: null,
                    mobile: '+18001234567'
                }
            },{
                _id: 2,
                first: 'kanye',
                last: 'west',
                email: 'kwest@example.com',
                phone: {
                    home: null,
                    mobile: '+18001234567'
                },
            }]
        };

        let error, payload;
        before(function(done) {
            serializer.serialize('groups', dataset2, function(e, p) {
                error = e;
                payload = p;
                done(e);
            });
        });

        it('should not throw an error', function() {
            expect(error).to.not.exist;
        });

        it('shoud return a valid payload', function() {
            expect(payload).to.be.an('object').and.contain.all.keys('links', 'data', 'included', 'meta');
        });

        it('should return the correct top level links', function() {
            expect(payload.links).to.have.property('self', 'https://www.example.com/api/groups');
        });

        it('should return the correct top level meta', function() {
            expect(payload.meta).to.have.property('serializationTime').that.is.a('string');
        });

        it('should include 1 serialized group', function() {
            expect(payload.data).to.be.an('object')
                .with.all.keys('id', 'type', 'attributes', 'relationships', 'meta', 'links');
        });

        it('should include the appropriate attributes', function() {
            expect(payload.data.attributes).to.have.all.keys('desc');
        });

        it('each resource should include the correct relationships', function() {
            expect(payload.data.relationships).to.have.all.keys('users');
            expect(payload.data.relationships.users).to.have.all.keys('links', 'data', 'meta');
            expect(payload.data.relationships.users.data).to.be.an('array')
                .with.lengthOf(2);
            expect(_.map(payload.data.relationships.users.data, 'id')).to.eql([1, 2]);
        });

        it('each resource should include the correct meta', function() {
            expect(payload.data.meta).to.eql({});
        });

        it('should include the correct related resources in the `included` attribute', function() {
            expect(payload.included).to.be.an('array').with.lengthOf(2);
        });
    });

    context('unpopulated relationships with exotic ids', function() {
        let error, payload;
        before(function(done) {
            var mongoose = require('mongoose'),
                userSchema = new mongoose.Schema({
                    first: String,
                    last: String,
                    group: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'group'
                    },
                    groups: [{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'group'
                    }]
                }),
                User = mongoose.model('user', userSchema),
                groupSchema = new mongoose.Schema({
                    name: String
                }),
                Group = mongoose.model('group', groupSchema);

            let user = new User({
                first: 'tim',
                last: 'tebow',
                group: new ObjectID('56cd74546033f8d420bc1c11'),
                groups: [new ObjectID('56cd74546033f8d420bc1c12'), new ObjectID('56cd74546033f8d420bc1c13')]
            });

            serializer.serialize('users', user, {
              id: '_id',
              relationships: {
                group : {
                  type: 'groups',
                },
                groups : {
                  type: 'groups',
                }
              }
            }, function(e, p) {
                error = e;
                payload = p;
                done(e);
            });
        });

        it('should not throw an error', function() {
            expect(error).to.not.exist;
        });

        it('should return the correct relationships data ids', function() {
            expect(payload.data.relationships.group.data.id).to.eql('56cd74546033f8d420bc1c11');
            expect(_.map(payload.data.relationships.groups.data, 'id')).to.eql(['56cd74546033f8d420bc1c12', '56cd74546033f8d420bc1c13']);
        });
    });
});
