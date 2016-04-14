'use strict';

const async = require('async');
const expect = require('chai').expect;
const Serializer = require('../index');

describe('synchronous hooks', function() {
    let serializer = new Serializer({
        baseUrl: 'https://www.example.com',
        links: {
            self(resource, options) {
                return options.baseUrl + options.requestPath + '/' + resource.id;
            }
        },
        meta: {
            nickname(resource, options) {
                return 'lil ' + resource.attributes.first;
            }
        },
        topLevelLinks: {
            self(options) {
                return options.baseUrl + options.requestPath;
            }
        },
        topLevelMeta: {
            random(options) {
                return Math.random();
            }
        }
    });

    before(function(done) {
        let types = {
            user: {
                requestPath: '/api/users'
            }
        };
        async.each(Object.keys(types), function(type, fn) {
            let config = types[type];
            serializer.define(type, config, fn);
        }, done);
    });

    it('should allow hooks to be synchronous', function(done) {
        let data = [{
            id: 1,
            first: 'bob',
            last: 'smith',
            email: 'bsmith@example.com'
        }, {
            id: 2,
            first: 'susan',
            last: 'jones',
            email: 'sjones@example.com'
        }];
        serializer.serialize('user', data, function(err, serialized) {
            expect(err).to.not.exist;
            expect(serialized).to.be.an('object');
            expect(serialized).to.have.property('meta').that.is.an('object').with.property('random').that.is.a('number');
            expect(serialized).to.have.property('links').that.is.an('object').with.property('self', 'https://www.example.com/api/users');
            expect(serialized).to.have.property('data').that.is.an('array').with.lengthOf(2);
            serialized.data.forEach(function(user) {
                expect(user).to.be.an('object');
                expect(user).to.have.property('type', 'user');
                expect(user).to.have.property('attributes').that.is.an('object');
                expect(user).to.have.property('links').that.is.an('object').with.property('self', `https://www.example.com/api/users/${user.id}`);
                expect(user).to.have.property('meta').that.is.an('object').with.property('nickname', `lil ${user.attributes.first}`);
            });
            done();
        });
    });
});
