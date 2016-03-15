'use strict';

var async = require('async'),
    deserializeRelationship = require('./deserialize-relationship'),
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
            let deserialized = resource.attributes;
            if (resource.id) {
                let idParam = _.get(internal.types, type + '.default') || 'id';
                deserialized[idParam] = resource.id;
            }
            async.setImmediate(function() {
                fn(null, deserialized);
            });
        }],

        relationships: ['deserialize', function(fn, r) {
            if (!_.has(resource, 'relationships')) {
                return fn();
            }
            let relationships = Object.keys(resource.relationships);
            async.eachSeries(relationships, function(rel, _fn) {
                let relationship = resource.relationships[rel];
                deserializeRelationship(r.deserialize, rel, relationship, data, _fn);
            }, fn);
        }],

        addToData: ['relationships', function(fn, r) {
            console.log(JSON.stringify(r.deserialize));
            if (!_.has(data, type)) {
                data[type] = r.deserialize;
            } else if (_.isPlainObject(data[type])) {
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
