# json-api-ify
a `node.js v5+` framework agnostic library for serializing your data to [JSON API v1.0](http://jsonapi.org/) compliant payloads, inspired by [jsonapi-serializer](https://github.com/SeyZ/jsonapi-serializer).


## Install
```bash
npm install --save json-api-ify
```

## Getting Started
Create a new *reusable* serializer.
```javascript
var Serializer = require('json-api-ify');

let serializer = new Serializer({
    baseUrl: 'https://www.example.com/api',
    meta: {
        'api-version': 'v1.0.0'
    }
});
```


Define a type.
```javascript
serializer.define('users', {
    id: '_id',
    blacklist: [
        'password',
        'nested.secret.attribute'
    ],
    links: {
        self(resource, options, cb) {
            let link = options.baseUrl + '/users/' + resource.id;
            cb(null, link);
        }
    },
    meta: {
        nickname(resource, options, cb) {
            let nickname = 'lil ' + resource.attributes.first;
            cb(null, nickname);
        }
    },
    processResource(resource, cb) {
        return cb(null, resource.toObject());
    },
    topLevelLinks: {
        self(options, cb) {
            let link = options.baseUrl + '/users';
            cb(null, link);
        },
        next(options, cb) {
            let link = options.baseUrl + '/users';
            if (options.nextPage) {
                link += '?page=' + options.nextPage;
            }
            cb(null, link);
        }
    },
    topLevelMeta: {
        total(options, cb) {
            cb(null, options.total);
        }
    }
}, function(err) {
    // check for definition errors
})
```

Use it.
```javascript
var mongoose = require('mongoose'),
    userSchema = new mongoose.Schema({}, {strict: false}),
    User = mongoose.model('User', userSchema);

let data = [new User({
    id: '54735750e16638ba1eee59cb',
    first: 'Kendrick',
    last: 'Lamar',
    email: 'klamar@example.com',
    password: 'elkjqe0920oqhvrophepohiwveproihgqp398yr9pq8gehpqe9rf9q8er'
    phone: {
        home: '+18001234567',
        mobile: '+180045678910'
    },
    address: {
        addressLine1: '406 Madison Court',
        zipCode: '49426',
        country: 'USA'
    },
}), new User({
    id: '5490143e69e49d0c8f9fc6bc',
    first: 'Kanye',
    last: 'West',
    phone: {
        home: '+18002345678',
        mobile: '+18007890123'
    },
    address: {
        addressLine1: '361 Shady Lane',
        zipCode: '23185',
        country: 'USA'
    }
})];

serializer.serialize('users', data, function(err, payload) {
    console.log(payload);
});

// or in a route
function(req, res) {
    async.waterfall([
        function findUsers(fn) {
            User.find({})
                .limit(10)
                .skip(parseInt(req.query.page || 0) * 10)
                .exec(fn);
        },

        function serialize(users, fn) {
            serializer.serialize('users', users, {
                nextPage: (req.query.page || 0) + 1
            }, fn);
        }
    ], function(err, payload) {
        if (err) {
            return res.json(500, {errors: [{
                status: 500,
                detail: err.message
            }]});
        }
        res.json(200, payload);
    });
}
```
