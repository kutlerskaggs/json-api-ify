
'use strict';

var async = require('async'),
    chai = require('chai'),
    Serializer = require('../index'),
    _ = require('lodash');

let expect = chai.expect,
    serializer = new Serializer({
        baseUrl: 'https://www.example.com',
        includeSerializationTime: true
    });

describe('complex tests', function() {

    before(function(done) {
        async.parallel({
            states: function(fn) {
                serializer.define('states', {
                    blacklist: ['capital'],
                    relationships: {
                        libraries: {
                            type: 'libraries',
                            include: true
                        }
                    }
                }, fn);
            },

            cities: function(fn) {
                serializer.define('cities', {
                    relationships: {
                        state: {
                            type: 'states',
                            include: true
                        }
                    }
                }, fn);
            },

            libraries: function(fn) {
                serializer.define('libraries', {
                    id: '_id',
                    blacklist: ['isbn'],
                    relationships: {
                        'address.city': {
                            type: 'cities',
                            include: true
                        },
                        'address.state': {
                            type: 'states',
                            include: true
                        },
                        books: {
                            type: 'books',
                            include: true
                        }
                    }
                }, fn);
            },

            books: function(fn) {
                serializer.define('books', {
                    id: '_id',
                    relationships: {
                        author: {
                            type: 'authors',
                            include: true
                        }
                    }
                }, fn);
            },

            authors: function(fn) {
                serializer.define('authors', {
                    id: '_id',
                    relationships: {
                        books: {
                            type: 'books',
                            include: true
                        }
                    }
                }, fn);
            }
        }, done);
    });

    context('super nested', function() {
        let dataset = [
            {
                _id: '54735750e16638ba1eee59cb',
                name: 'Lone Tree Public Library',
                address: {
                    street: '293 S. 1st St',
                    city: {
                        id: 10,
                        name: 'Denver',
                        state: 36
                    },
                    state: {
                        id: 36,
                        name: 'Colorado',
                        latitude: -38.23097398723987,
                        longitude: 101.234972349872398,
                        capital: 'Denver',
                        libraries: [
                            '54735750e16638ba1eee59cb',
                            '54735750e16638ba1eee59dd',
                            {
                                _id: '54735750e16638ba1eee59ac',
                                name: 'Denver Public Library',
                                address: {
                                    street: '1001 S. Broadway',
                                    state: 36
                                }
                            }
                        ]
                    }
                },
                books: [
                    {
                        _id: '52735730e16632ba1eee62dd',
                        title: 'Tesla, SpaceX, and the Quest for a Fantastic Future',
                        isbn: '978-0062301239',
                        author: {
                            _id: '2934f384bb824a7cb7b238b8dc194a22',
                            firstName: 'Ashlee',
                            lastName: 'Vance',
                            books: [
                                {
                                    _id: '52735730e16632ba1eee62dd',
                                    title: 'Tesla, SpaceX, and the Quest for a Fantastic Future',
                                    isbn: '978-0062301239'
                                },
                                {
                                    _id: '52735730e16632ba1eee62ce'
                                }
                            ]
                        }
                    },
                    {
                        _id: '52735780e16610ba1eee15cd',
                        title: 'Steve Jobs',
                        isbn: '978-1451648546',
                        author: {
                            _id: '5ed95269a8334d8a970a2bd9fa599288',
                            firstName: 'Walter',
                            lastName: 'Isaacson'
                        }
                    }
                ]
            }
        ];

        let error, payload;
        before(function(done) {
            serializer.serialize('libraries', dataset, function(e, p) {
                error = e;
                payload = p;
                done(e);
            });
        });

        it('should not throw an error', function() {
            expect(error).to.not.exist;
        });

        it('should include the correct related resources', function() {
            let types = _(payload.included).groupBy('type').mapValues(function(docs) {
                return docs.length;
            }).value();
            expect(types).to.have.property('books', 2);
            expect(types).to.have.property('libraries', 1);
            expect(types).to.have.property('authors', 2);
            expect(types).to.have.property('cities', 1);
            expect(types).to.have.property('states', 1);
        });
    });
});
