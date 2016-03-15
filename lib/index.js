'use strict';

var async = require('async'),
    errors = require('./errors'),
    EventEmitter = require('events').EventEmitter,
    joi = require('joi'),
    util = require('./util'),
    nodeUtil = require('util'),
    _ = require('lodash');

function Serializer(options) {
    let self = this;
    EventEmitter.call(self);

    let internal = {
        /**
         * Global options
         * @type {Object}
         */
        options: _.isPlainObject(options) ? _.cloneDeep(options) : {},

        /**
         * Type storage
         * @type {Object}
         */
        types: {}
    };


    self.define = function(type, schemaName, options, cb) {
        if (_.isObject(schemaName)) {
            cb = options;
            options = schemaName;
            schemaName = 'default';
        }

        util.validateOptions(options, function(err, validated) {
            if (err) {
                self.emit('error', err);
                return cb(err);
            }
            _.extend(validated, {
                type: type,
                schema: schemaName
            });
            _.set(internal.types, [type, schemaName].join('.'), validated);
            cb();
        });
    };


    self.deserialize = function(payload, cb) {
        let data = {};
        async.auto({
            validate: function validatePayload(fn) {
                let schema = joi.object({
                    meta: joi.object(),
                    links: joi.object(),
                    data: joi.alternatives().try(
                        joi.object(),
                        joi.array().items(joi.object())
                    ).allow(null).required()
                }).required();
                joi.validate(payload, schema, {}, function(err) {
                    if (err) {
                        return cb({
                            status: 400,
                            title: 'Invalid `payload` provided to #deserialize()',
                            meta: {
                                payload: payload
                            }
                        });
                    }
                    fn();
                });
            },

            deserialize: ['validate', function deserializeData(fn) {
                if (_.isPlainObject(payload.data)) {
                    payload.data = [payload.data];
                }
                async.eachSeries(payload.data, function(resource, _fn) {
                    util.deserializeResource(internal, resource, data, _fn);
                }, fn);
            }]
        }, function(err) {
            if (err) {
                return cb(err);
            }
            cb(null, data);
        });
    };


    self.serialize = function(type, schemaName, data, options, cb) {
        var start = process.hrtime();

        function getElapsedTime() {
            var precision = 3; // 3 decimal places
            var elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
            return process.hrtime(start)[0] + "s, " + elapsed.toFixed(precision) + "ms";
        }

        // process function signature
        let args = util.handleOptionalArguments(schemaName, data, options, cb);
        schemaName = args.schemaName;
        data = args.data;
        options = args.options;
        cb = args.cb;

        self._serialize(type, schemaName, data, options, function(err, payload) {
            if (err) {
                _.set(err, 'meta.serializationTime', getElapsedTime());
                return cb(err);
            }
            /*
            payload.included = _.uniqBy(payload.included, function(item) {
                return item.type + item.id;
            });
            */
            payload.included = _.reduce(payload.included, function(memo, includedResource, i) {
                let ii = _.findIndex(memo, {type: includedResource.type, id: includedResource.id});
                if (ii === -1) {
                    if (includedResource.type === type) {
                        if (_.isArray(payload.data)) {
                            if (_.find(payload.data, {id: includedResource.id})) {
                                return memo;
                            }
                        } else if (payload.data.id === includedResource.id) {
                            return memo;
                        }
                    }
                    memo.push(includedResource);
                    return memo;
                }
                let alreadyIncludedResource = memo[ii];
                _.extend(alreadyIncludedResource, includedResource);
                memo[ii] = alreadyIncludedResource;
                return memo;
            }, []);
            if (internal.options.includeSerializationTime === true || options.includeSerializationTime === true) {
                _.set(payload, 'meta.serializationTime', getElapsedTime());
            }

            return cb(null, payload);
        });
    };

    self._serialize = function(type, schemaName, data, options, cb) {
        // ensure the type and schema are defined
        let typePath = [type, schemaName].join('.'),
            schemaOptions = _.get(internal.types, typePath);
        if (!schemaOptions) {
            cb(errors.generateError('1002', 'No type defined for `' + typePath + '`', {options: options}));
        }

        // merge schema options with default options if available
        if (schemaName !== 'default') {
            let defaultPath = [type, 'default'].join('.'),
                defaulSchemaOptions = _.get(internal.types, defaultPath);
            if (defaulSchemaOptions) {
                schemaOptions = _.merge({}, defaulSchemaOptions, schemaOptions);
            }
        }

        // define initial payload and options
        let payload = {
            links: {},
            data: null,
            included: [],
            meta: {}
        };

        // define options for this request
        options = _.omit(options, ['type', 'schema']);
        options = _.merge({}, internal.options, schemaOptions, options);

        async.auto({
            options: function validateOptions(fn) {
                util.validateOptions(options, function(err, validated) {
                    if (err) {
                        return fn(err);
                    }
                    options = validated;
                    fn();
                });
            },

            // allow for preproccessing of a collection
            data: ['options', function processData(fn) {
                if (_.isArray(data) && _.isFunction(options.processCollection)) {
                    return options.processCollection(data, options, fn);
                }
                fn(null, data);
            }],

            // serialize the data
            serialized: ['data', function serializeData(fn, r) {
                if (!_.isArray(r.data)) {
                    options.isCollection = false;
                    return util.serializeResource.call(self, payload, r.data, options, fn);
                }
                payload.data = [];
                options.isCollection = true;
                async.each(r.data, function(doc, _fn) {
                    util.serializeResource.call(self, payload, doc, options, _fn);
                }, fn);
            }],

            topLevelLinks: ['data', function applyTopLevelLinks(fn) {
                util.applyLinks(options.topLevelLinks, payload.links, options, fn);
            }],

            meta: ['data', function applyTopLevelMeta(fn) {
                util.applyLinks(options.topLevelMeta, payload.meta, options, fn);
            }]
        }, function(err, results) {
            if (err) {
                payload = self.serializeError(err);
                self.emit('error', err);
                return cb(payload);
            }
            cb(null, payload);
        });
    };

    self.serializeError = function(err, meta, statusCode) {
        if (_.isNumber(meta)) {
            statusCode = meta;
            meta = {};
        }
        if (!_.isPlainObject(meta)) {
            meta = {};
        }
        statusCode = _.isNumber(statusCode) ? statusCode : 500;
        statusCode = statusCode.toString();
        let payload = {
            errors: []
        };

        function convertToJsonApiError(err) {
            if (!(err instanceof Error)) {
                let errorSchema = joi.object({
                    id: joi.alternatives().try(joi.string(), joi.number()),
                    links: joi.object({
                        about: joi.alternatives().try(
                            joi.string(),
                            joi.object({
                                href: joi.string(),
                                meta: joi.object()
                            })
                        )
                    }),
                    status: joi.alternatives().try(joi.string(), joi.number().integer()),
                    code: joi.string(),
                    title: joi.string(),
                    detail: joi.string(),
                    source: joi.object({
                        pointer: joi.string(),
                        parameter: joi.string()
                    }),
                    meta: joi.object()
                }).required();

                let result = joi.validate(err, errorSchema, {convert: true});
                if (!result.error) {
                    result.value.status = result.value.status.toString();
                    return result.value;
                }
            } else {
                err = err.toString();
            }

            let error = {
                status: statusCode,
                detail: err.message || 'Undefined error occurred',
                meta: _.merge(meta, {
                    error: err
                })
            };

            return error;
        }

        if (_.isPlainObject(err) && _.isArray(err.errors)) {
            err.errors = err.errors.map(convertToJsonApiError);
            payload = err;
        } else {
            err = convertToJsonApiError(err);
            payload.errors.push(err);
        }

        // determine appropriate status
        let statuses = payload.errors.map(function(e) {
                return parseInt(e.status || 500);
            }),
            sortFunction = function(pair, pair2) {
                return _.lte(pair[1], pair2[1]);
            };

        statuses = _(statuses).groupBy(function(value) {
            return value;
        }).mapValues(function(value) {
            return value.length;
        }).toPairs().value();

        let status = parseInt(_.first(statuses.sort(_.lte))[0]);

        payload.meta = {
            status: _.isInteger(status) ? status : 500
        };
        return payload;
    };

    self._validateError = function(err) {
        try {
            let errorSchema = joi.object({
                id: joi.alternatives().try(joi.string(), joi.number()),
                links: joi.object({
                    about: joi.alternatives().try(
                        joi.string(),
                        joi.object({
                            href: joi.string(),
                            meta: joi.object()
                        })
                    )
                }),
                status: joi.string(),
                code: joi.string(),
                title: joi.string(),
                detail: joi.string(),
                source: joi.object({
                    pointer: joi.string(),
                    parameter: joi.string()
                }),
                meta: joi.object()
            }).required();
            joi.assert(err, errorSchema);
            return true;
        } catch (e) {
            return false;
        }
    };

    return self;
}

nodeUtil.inherits(Serializer, EventEmitter);

module.exports = Serializer;
