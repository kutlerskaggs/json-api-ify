'use strict';

var async = require('async'),
    errors = require('./errors'),
    EventEmitter = require('events').EventEmitter,
    joi = require('joi'),
    util = require('./util'),
    _ = require('lodash');

var JsonApiProvider = module.exports = function(options) {
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
            payload.included = _.uniqBy(payload.included, function(item) {
                return item.type + item.id;
            });
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
                payload = {
                    errors: [err]
                };
                return cb(payload);
            }
            cb(null, payload);
        });
    };

    return this;
};
