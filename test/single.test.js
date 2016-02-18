'use strict';

var JsonApiIfy = require('../index');

let json = new JsonApiIfy({
    baseUrl: 'http://localhost:8080'
});

json.define('states', {
    blacklist: ['capital'],
    relationships: {
        libraries: {
            type: 'libraries',
            include: false
        }
    }
});

json.define('cities', {
    relationships: {
        state: {
            type: 'state',
            include: false
        }
    }
});

json.define('libraries', {
    blacklist: ['isbn'],
    relationships: {
        'address.city': {
            type: 'cities',
            include: false
        },
        'address.state': {
            type: 'states',
            include: true
        }
    }
});

json.define('books', {
    relationships: {
        author: {
            type: 'authors',
            include: true
        }
    }
});

json.define('authors', {
    relationships: {
        books: {
            type: 'books',
            include: false
        }
    }
});

var dataSet = [
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
                    '54735750e16638ba1eee59ac'
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
                            _id: '52735730e16632ba1eee62ce',
                            title: 'Tesla, SpaceX, and the Quest for a Fantastic Future',
                            isbn: '978-9384932991'
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

json.serialize('libraries', dataSet, {}, function(err, payload) {

});
