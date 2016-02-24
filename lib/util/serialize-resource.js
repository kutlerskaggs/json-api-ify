'use strict';

var async = require('async'),
    errors = require('../errors'),
    applyLinks = require('./apply-links'),
    _ = require('lodash');

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
        // process data
        data: function processData(fn) {
            let isAnId = function(i) {
                    return !_.isPlainObject(i);
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
                },
                isAnArrayOfIds = _.isArray(data) && _(data).map(isAnId).uniq().value() == [true];
            if (isAnId(data)) {
                data = convertToShell(data);
            } else if (isAnArrayOfIds) {
                data = data.map(convertToShell);
            }
            if (options.processResource) {
                return options.processResource(data, function(err, processed) {
                    if (err) {
                        return fn(err);
                    }
                    if (!_.isPlainObject(processed)) {
                        return fn({
                            title: 'Serialize Resource Error',
                            detail: 'Invalid resource returned from user defined #processResource handler. The hook must return a plain object.'
                        });
                    }
                    data = processed;
                    fn(null, data);
                });
            }
            fn(null, data);
        },

        // ensure id requirement met
        id: ['data', function(fn, r) {
            let id = options.id;
            if (_.isFunction(options.id)) {
                id = options.id(r.data);
            }
            id = id || 'id';
            resource.id = data[id];
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

                let include = options.relationships[relationshipName].include || true,
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
                    roptions = _.merge({}, _.omit(relationshipConfig, ['type', 'include', 'links']));

                self._serialize(rtype, rschema, relationshipData, roptions, function(err, rpayload) {
                    if (err) {
                        return _fn(err);
                    }

                    if (!strip) {
                        if (_.isArray(rpayload.data)) {
                            resource.relationships[relationshipName] = _.extend({
                                links: {},
                                meta: {},
                                data: _.map(rpayload.data, pickTopLevel)
                            }, _.pick(rpayload, ['links', 'meta']));
                        } else {
                            resource.relationships[relationshipName] = _.extend({
                                links: {},
                                meta: {},
                                data: pickTopLevel(rpayload.data)
                            }, _.pick(rpayload, ['links', 'meta']));
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

                });
            }, fn);
        }],

        links: ['id', 'attributes', function applyResourceLinks(fn, r) {
            applyLinks(options.links, resource.links, resource, options, fn);
        }],

        meta: ['id', 'attributes', function applyResourceMeta(fn, r) {
            applyLinks(options.meta || {}, resource.meta, resource, options, fn);
        }],

        payload: ['id', 'attributes', function addToPayload(fn) {
            if (options.isCollection) {
                payload.data.push(resource);
            } else {
                payload.data = resource;
            }
            fn();
        }]
    }, function(err) {
        cb(err);
    });
};
