# json-api-ify
a `node.js` framework agnostic library for serializing your data to [JSON API v1.0](http://jsonapi.org/) compliant document, inspired by [jsonapi-serializer](https://github.com/SeyZ/jsonapi-serializer).


## Installing
```bash
npm install --save json-api-ify
```


## Getting Started
Create a new *reusable* serializer.
```javascript
var Serializer = require('json-api-ify');

let serializer = new Serializer({
    baseUrl: 'https://www.example.com/api',
    topLevelMeta: {
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
        'phone.mobile'
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

Get a hold of some data that needs to be serialized.
```javascript
let data = [new User({
    first: 'Kendrick',
    last: 'Lamar',
    email: 'klamar@example.com',
    password: 'elkjqe0920oqhvrophepohiwveproihgqp398yr9pq8gehpqe9rf9q8er',
    phone: {
        home: '+18001234567',
        mobile: '+180045678910'
    },
    address: {
        addressLine1: '406 Madison Court',
        zipCode: '49426',
        country: 'USA'
    }
}), new User({
    first: 'Kanye',
    last: 'West',
    email: 'kwest@example.com',
    password: 'asdlkj2430r3r0ghubwf9u3rbg9u3rbgi2q3oubgoubeqfnpviquberpibq',
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
```

Serialize it
```javascript
serializer.serialize('users', data, function(err, payload) {
    console.log(payload);
});
```

Or, use it in a route
```javascript
function(req, res) {
    async.auto({
        users: function findUsers(fn) {
            User.find({})
                .limit(10)
                .skip(parseInt(req.query.page || 0) * 10)
                .exec(fn);
        },

        count: function countUsers(fn) {
            User.count({}).exec(fn);
        },

        payload: ['users', 'count', function serialize(fn, results) {
            serializer.serialize('users', results.users, {
                total: results.count,
                nextPage: (req.query.page || 1) + 1
            }, fn);
        }]
    }, function(err, payload) {
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
Response body:
```json
{
    "links": {
        "self": "https://www.example.com/api/users",
        "next": "https://www.example.com/api/users?page=2"
    },
    "data": [
        {
            "type": "users",
            "id": "54735750e16638ba1eee59cb",
            "attributes": {
                "first": "Kendrick",
                "last": "Lamar",
                "email": "klamar@example.com",
                "phone": {
                    "home": "+18001234567"
                },
                "address": {
                    "addressLine1": "406 Madison Court",
                    "zipCode": "49426",
                    "country": "USA"
                }
            },
            "relationships": {},
            "links": {
                "self": "https://www.example.com/api/users/54735750e16638ba1eee59cb"
            },
            "meta": {
                "nickname": "lil Kendrick"
            }
        },
        {
            "type": "users",
            "id": "5490143e69e49d0c8f9fc6bc",
            "attributes": {
                "first": "Kanye",
                "last": "West",
                "email": "kwest@example.com",
                "phone": {
                    "home": "+18002345678"
                },
                "address": {
                    "addressLine1": "361 Shady Lane",
                    "zipCode": "23185",
                    "country": "USA"
                }
            },
            "relationships": {},
            "links": {
                "self": "https://www.example.com/api/users/5490143e69e49d0c8f9fc6bc"
            },
            "meta": {
                "nickname": "lil Kanye"
            }
        }
    ],
    "included": [],
    "meta": {
        "api-version": "v1.0.0",
        "total": 2
    }
}
```


## Schemas
A type can have multiple serialization *schemas*, which you can create by calling `define` with a schema name. Any schema options provided will augment the *default* schema.
```javascript
serializer.define('users', 'names-only', {
    whitelist: [
        'first',
        'last'
    ]
}, callback);
```
```javascript
serializer.serialize('users', 'names-only', data, function(err, payload) {
    console.log(payload);
});
```
```json
{
    "links": {
        "self": "https://www.example.com/api/users"
    },
    "data": [
        {
            "type": "users",
            "id": "54735750e16638ba1eee59cb",
            "attributes": {
                "first": "Kendrick",
                "last": "Lamar"
            },
            "relationships": {},
            "links": {
                "self": "https://www.example.com/api/users/54735750e16638ba1eee59cb"
            },
            "meta": {
                "nickname": "lil Kendrick"
            }
        },
        {
            "type": "users",
            "id": "5490143e69e49d0c8f9fc6bc",
            "attributes": {
                "first": "Kanye",
                "last": "West"
            },
            "relationships": {},
            "links": {
                "self": "https://www.example.com/api/users/5490143e69e49d0c8f9fc6bc"
            },
            "meta": {
                "nickname": "lil Kanye"
            }
        }
    ],
    "included": [],
    "meta": {
        "api-version": "v1.0.0"
    }
}
```


## Relationships
Relationships are easy as well. First, include a relationship map in your type/schema options.
```javascript
serializer.define('users', {
    // ..
    relationships: {
        groups: {
            type: 'groups',
            include: true,
            links: {
                self(resource, options, cb) {
                    let link = options.baseUrl + '/users/' + resource.id + '/relationships/groups';
                    cb(null, link);
                },
                related(resource, options, cb) {
                    let link = options.baseUrl + '/users/' + resource.id + '/groups';
                    cb(null, link);
                }
            }
        }
    }
    // ..
}, callback);
```
Lastly, define the related type.
```javascript
serializer.define('groups', {
    // ..
    relationships: {
        users: {
            type: 'users',
            include: true,
            schema: 'names-only',
            links: {
                self(resource, options, cb) {
                    let link = options.baseUrl + '/groups/' + resource.id + '/relationships/users';
                    cb(null, link);
                },
                related(resource, options, cb) {
                    let link = options.baseUrl + '/groups/' + resource.id + '/users';
                    cb(null, link);
                }
            }
        }
    }
    // ..
}, callback);
```


## API
### Constructor Summary
#### Serializer([options])
constructs a new serializer instance

###### Arguments
| Param | Type | Description |
| :---: | :---: | :--- |
| `[options]` | `{Object}` | global options. see `serialize()` options for more detail |
---


### Method Summary
#### define(type, [schema], options, callback)
defines a type serialization schema

###### Arguments
| Param | Type | Description |
| :---: | :---: | :--- |
| `type` | `{String}` | the `resource` type |
| `[schema]` | `{String}` | the serialization `schema` to use. defaults to `default` |
| `options` | `{Object}` | schema options |
| `callback(err, payload)` | `{Function}` | a function that receives any definition error. |
---


#### serialize(type, [schema], data, [options], callback)
serializes `data` into a JSON API v1.0 compliant document

###### Arguments
| Param | Type | Description |
| :---: | :---: | :--- |
| `type` | `{String}` | the `resource` type |
| `[schema]` | `{String}` | the serialization `schema` to use. defaults to `default` |
| `data` | `{*}` | the `data` to serialize |
| `[options]` | `{Object}` | single use options. these options will be merged with the global options, default schema options, and any applicable non-default schema options |
| `callback(err, payload)` | `{Function}` | a function that receives any serialization error and JSON API document. |

###### Options
```javascript
{
    // an array of string paths to omit from the resource, this option
    // includes relationships that you may wish to omit
    blacklist: [],

     // the path to the primary key on the resource
    id: 'id',

    // a map of resource links
    links: {
        self(resource, options, cb) {
            // each key can be a value to set, or asynchronous function that
            // receives the processed resource, serialization options, and
            // a callback that should pass any error and the link value
            cb(null, link);
        }
    },

    // a map of meta members
    meta: {
        self(resource, options, cb) {
            // each key can be a value to set, or asynchronous function that
            // receives the processed resource, serialization options, and
            // a callback that should pass any error and the meta value
            cb(null, meta);
        }
    },

    // relationship configuration
    relationships: {
        // each key represents a resource path that points to a
        // nested resource or collection of nested resources
        'groups': {
            // the type of resource
            type: 'groups',

            // whether or not to include the nested resource(s)
            include: true,

            // optionally specify a non-default schema to use
            schema: 'my-schema',

            // a map of links to define on the relationship object
            links: {
                self(resource, options, cb) {

                },
                related(resource, options, cb) {

                }
            }
        }
    },

    // a map of top-level links
    topLevelLinks: {
        self(options, cb) {

        }
    },

    // a map of top-level meta members
    meta: {
        total(options, cb) {

        }
    },

    // an array of string paths to pick from the resource. this option
    // overrides any specified blacklist and also includes relationships
    whitelist: [],
}
```
---

#### serializeError(error, [meta], [defaultStatusCode]) => {object} document
serializes any `error` into a JSON API v1.0 compliant error document. error can be anything, this method will attempt to intelligently construct a valid JSON API error object. the return document will contain a top level `meta` member with a `status` attribute that represents the status code with the greatest frequency.

###### Arguments
| Param | Type | Description |
| :---: | :---: | :--- |
| `error` | `{*}` | the `error` data to serialize |
| `[meta]` | `{Object}` | any top level meta information |
| `[defaultStatusCode]` | `{Number|String}` | a default status code to apply to any error object(s) without a specified `status` |

###### Example
```javascript
function(req, res) {
    async.waterfall([
        // ..
    ], function(err, payload) {
        let status = 200;
        if (err) {
            payload = serializer.serializeError(err);
            status = payload.meta.status;
        }
        res.json(status, payload);
    });
}
```


## Events
The `serializer` inherits from node's `EventEmitter`. Below is a summary of the events exposed by this library.

#### error
The global error event.

###### Arguments
| Param | Type | Description |
| :---: | :---: | :--- |
| `error` | `{Object}` | the error object |

###### Example
```javascript
serializer.on('error', function(error) {
    bugsnag.notify(error);
});
```


## To Do
- [ ] implement `jsonapi` top-level member
- [ ] implement `deserialize` method
- [x] implement support for unpopulated relationships (an id, or array of ids)
- [ ] implement *templates*
- [ ] *ADD MORE TESTS!*


## Testing
run tests
```bash
npm test
```


## Contributing
1. [Fork it](https://github.com/kutlerskaggs/json-api-ify/fork)
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request


## License
Copyright (c) 2016 Chris Ludden.  
Licensed under the [MIT license](LICENSE.md).
