'use strict';

var async = require('async'),
    errors = require('../errors'),
    applyLinks = require('./apply-links'),
    _ = require('lodash'),
    minimizePayload = require('./minimize-payload');

module.exports = function serializeResource(payload, data, options, cb) {
    let self = this;

    // define base resource
    let resource = {
        type: options.type,
        id: data[options.id || 'id'],
        attributes: {},
        relationships: {},
        links: {},
        meta: {}
    };

    async.auto({
        processResource: function processResource(fn) {


            if (!_.isFunction(options.processResource)) {
                return fn();
            }
            if (options.processResource.length === 1) {
                data = _.attempt(options.processResource, data);
                if (_.isError(data)) {
                    return fn(data);
                }
                return fn(null, data);
            }
            options.processResource(data, function(err, processed) {
                if (err) {
                    return fn(err);
                }
                data = processed;
                fn(null, data);
            });
        },

        // process data
        data: ['processResource', function processData(fn) {
            let isAnId = function(i) {

                    //if you have a TYPED object (e.g. of type user -> instanceof === User)
                    //this will return false and break this whole thing
                    //return !_.isPlainObject(i);

                    return !_.isObject(i);
                },
                convertToShell = function(i) {
                    i = {
                        id: i
                    };
                    if (options.id && options.id !== 'id') {
                        i[options.id] = i.id;
                        delete i.id;
                    }
                    return i;
                };
                //isAnArrayOfIds = _.isArray(data) && _(data).map(isAnId).uniq().value() == [true];
            if (isAnId(data)) {
                data = convertToShell(data);
            } /*else if (isAnArrayOfIds) {
                data = data.map(convertToShell);
            }*/

            // Remove any properties that are null or undefined
            data = _.pickBy(data, _.identity);

            fn(null, data);
        }],

        // ensure id requirement met
        id: ['data', function(fn, r) {
            let id = options.id;
            if (_.isFunction(options.id)) {
                id = options.id(r.data);
            }
            id = id || 'id';
            resource.id = data[id].toString();
            if (!resource.id) {
                return fn(errors.generateError('2001', 'Missing required `id` attribute', {options: options, data: data, id: id}));
            }
            fn(null, id);
        }],

        // serialize attributes
        attributes: ['data', function(fn, r) {
            function transform(resource, data, currentPath) {
                _.transform(data, function(result, value, key) {
                    let keyPath = _.isString(currentPath) ? [currentPath, key].join('.') : key;
                    let include = false;

                    // if not blacklisted, include
                    if (options.blacklist.indexOf(keyPath) === -1) {
                        include = true;
                    }

                    // if explicitly whitelisted, include
                    if (options.whitelist.indexOf(keyPath) !== -1) {
                        include = true;
                    } else if (options.whitelist.length) {
                        // if whitelist exists, and not specified exclude
                        include = false;
                    }

                    // ignore relationships and primary key
                    if (options.relationships[keyPath] || keyPath === r.id) {
                        include = false;
                    }

                    if (include) {
                        if (_.isPlainObject(value)) {
                            transform(result, value, keyPath);
                        } else {
                            _.set(result.attributes, keyPath, value);
                        }
                    }
                }, resource);
            }
            transform(resource, r.data);
            fn();
        }],

        // process relationships
        relationships: ['data', function(fn, r) {
            let relationshipNames = _.keys(options.relationships);
            function pickTopLevel(rresource) {
                return _.pick(rresource, 'id', 'type', 'links', 'meta');
            }

            async.each(relationshipNames, function(relationshipName, _fn) {
                // ignore if the relationship is not present
                let relationshipData = _.get(r.data, relationshipName);
                if (_.isUndefined(relationshipData)) {
                    return _fn();
                }

                let include = _.isUndefined(options.relationships[relationshipName].include) ? true : options.relationships[relationshipName].include,
                    strip = false;

                // if backlisted, exclude
                if (options.blacklist.indexOf(relationshipName) !== -1) {
                    include = false;
                    strip = true;
                }

                // if explicitly whitelisted, include
                if (options.whitelist.indexOf(relationshipName) !== -1) {
                    include = true;
                    strip = false;
                } else if (options.whitelist.length) {
                    // if whitelist exists, and not specified exclude
                    include = false;
                    strip = true;
                }

                let relationshipConfig = options.relationships[relationshipName],
                    rtype = relationshipConfig.type,
                    rschema = relationshipConfig.schema || 'default',
                    roptions = _.merge({}, _.omit(relationshipConfig, ['type', 'include', 'links', 'meta']));

                self._serialize(rtype, rschema, relationshipData, roptions, function(err, rpayload) {
                    if (err) {
                        return _fn(err);
                    }

                    if (!strip) {
                        if (_.isArray(rpayload.data)) {
                            resource.relationships[relationshipName] = {
                                links: {},
                                meta: {},
                                data: _.map(rpayload.data, pickTopLevel)
                            };
                        } else {
                            resource.relationships[relationshipName] = {
                                links: {},
                                meta: {},
                                data: pickTopLevel(rpayload.data)
                            };
                        }
                    }

                    function isPopulated(data) {
                    	return _.keys(data.attributes || {}).length > 0;
                    }

                    if (include) {
                        if (!_.isArray(rpayload.data)) {
                            rpayload.data = [rpayload.data];
                        }
                        rpayload.data = rpayload.data.filter(isPopulated);
                        payload.included.push.apply(payload.included, rpayload.data.concat(rpayload.included));
                    }

                    async.parallel([
                        function(__fn) {
                            if (!resource.relationships[relationshipName]) {
                                return __fn();
                            }
                            applyLinks(relationshipConfig.links || {}, resource.relationships[relationshipName].links, resource, options, __fn);
                        },

                        function(__fn) {
                            if (!resource.relationships[relationshipName]) {
                                return __fn();
                            }
                            applyLinks(relationshipConfig.meta || {}, resource.relationships[relationshipName].meta, resource, options, __fn);
                        }
                    ], _fn);

                    if (options.minimizePayload === true) {
                        resource.relationships[relationshipName] = minimizePayload(resource.relationships[relationshipName]);
                    }

                });
            }, fn);
        }],

        links: ['id', 'attributes', function applyResourceLinks(fn, r) {
            applyLinks(options.links, resource.links, resource, options, fn);
        }],

        meta: ['id', 'attributes', function applyResourceMeta(fn, r) {
            applyLinks(options.meta || {}, resource.meta, resource, options, fn);
        }],

        payload: ['id', 'attributes', 'relationships', 'links', 'meta', function addToPayload(fn) {
            if (options.isCollection) {
                payload.data.push(resource);
            } else {
                payload.data = resource;
            }
            fn();
        }]
    }, function(err) {

        if (options.minimizePayload === true) {
            payload.data = minimizePayload(payload.data);
        }

        cb(err);
    });
};
