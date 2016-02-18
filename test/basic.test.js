'use strict';

var async = require('async'),
    chai = require('chai'),
    JsonApiIfy = require('../index'),
    _ = require('lodash');

let expect = chai.expect;

describe('basic tests', function() {
    let dataset = [{
        _id: 1,
        first: 'tim',
        last: 'tebow',
        email: 'ttebow@example.com',
        phone: {
            home: null,
            cell: '+18001234567'
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
            cell: '+18001234567'
        },
        groups: [{
            name: 'users',
            desc: 'all users'
        }]
    }];

    let json = new JsonApiIfy({
        baseUrl: 'http://localhost:8080'
    });

    before(function(done) {
        async.parallel([
            function(fn) {
                json.define('users', {
                    id: '_id',
                    blacklist: [
                        'email',
                        'phone.home'
                    ],
                    relationships: {
                        groups: {
                            type: 'groups',
                            include: true
                        }
                    }
                }, fn);
            },

            function(fn) {
                json.define('users', 'public', {
                    whitelist: [
                        'first',
                        'last'
                    ]
                }, fn);
            },

            function(fn) {
                json.define('groups', {
                    id: 'name',
                    relationships: {
                        users: {
                            type: 'users',
                            schema: 'public',
                            include: true
                        }
                    }
                }, fn);
            }
        ], done);
    });

    it('should blacklist the appropriate items', function(done) {
        json.serialize('users', dataset, function(err, payload) {
            console.log(JSON.stringify(err), JSON.stringify(payload));
            expect(err).to.not.exist;
            expect(payload).to.have.property('data');
            expect(payload.data).to.have.lengthOf(2);
            payload.data.forEach(function(resource) {
                expect(resource.id).to.be.a('number');
                expect(resource.type).to.equal('users');
                expect(resource.attributes).to.have.all.keys('first', 'last', 'phone');
                expect(resource.attributes.phone).to.not.have.keys('home');
            });
            done();
        });
    });
});
