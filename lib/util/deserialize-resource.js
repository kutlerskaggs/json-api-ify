'use strict';

var async = require('async'),
    joi = require('joi'),
    _ = require('lodash');

module.exports = function(internal, resource, data, cb) {
    let type;
    async.auto({
        validated: function(fn) {
            let schema = joi.object({
                id: joi.any(),
                type: joi.string().required(),
                attributes: joi.object(),
                relationships: joi.object(),
                links: joi.object(),
                meta: joi.object()
            }).required();

            joi.validate(resource, schema, {}, function(err) {
                if (err) {
                    return fn({
                        status: 400,
                        title: 'Invalid `resource` argument',
                        detail: err.message,
                        meta: {
                            resource: resource
                        }
                    });
                }
                fn();
            });
        },

        deserialize: ['validated', function(fn) {
            type = resource.type;
            let deserialized = resource.attributes || {};
            if (resource.id && _.isPlainObject(deserialized)) {
                let idParam = _.get(internal.types, type + '.default.id') || 'id';
                deserialized[idParam] = resource.id;
            }
            async.setImmediate(function() {
                fn(null, deserialized);
            });
        }],

        addToData: ['deserialize', function(fn, r) {
            if (!_.has(data, type)) {
                data[type] = r.deserialize;
            } else if (!_.isArray(data[type])) {
                let member = data[type];
                data[type] = [];
                data[type].push.apply(data[type], [member, r.deserialize]);
            } else {
                data[type].push(r.deserialize);
            }
            fn();
        }]
    }, cb);
};
