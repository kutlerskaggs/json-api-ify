'use strict';

var chai = require('chai'),
    Serializer = require('../index');

let expect = chai.expect;

describe('serializeError()', function() {
    let serializer = new Serializer();

    let errors = [
        500,
        'An error occurred',
        {random: 'This is an error'},
        {error: 'Something happened here'},
        new Error('Something unexpected'),
        {
            id: 'abdoihewoihcwwe',
            status: 403,
            title: 'ECONNECT',
            detail: 'sadlkjasldfkjalskd'
        }
    ];

    errors.forEach(function(err) {
        it('should produce a valid error document', function() {
            let payload = serializer.serializeError(err);
            expect(payload).to.be.an('object')
                .that.contains.all.keys('errors')
                .and.contains.any.keys('meta')
                .and.property('errors').that.is.an('array');
            payload.errors.forEach(function(e) {
                expect(serializer._validateError(e)).to.equal(true);
            });
        });
    });
});
