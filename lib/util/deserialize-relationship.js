'use strict';

var async = require('async'),
    joi = require('joi'),
    _ = require('lodash');

function wrapError(status, title, cb) {
    return function(err) {
        if (err) {
            return cb(_.extend({
                status: status,
                title: title,
            }, {detail: _.get(err, 'message')}));
        }
        let args = [];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        cb.apply(null, args);
    };
}

module.exports = function(internal, deserialized, attr, relationship, data, cb) {
    async.auto({
        validated: function(fn) {
            let dataSchema = joi.object({
                id: joi.any(),
                type: joi.string().required(),
                attributes: joi.object()
            }).unknown(false);
            let relationshipSchema = joi.object({
                data: joi.alternatives().try(
                    dataSchema,
                    joi.array().items(dataSchema)
                )
            }).unknown(true).required();
            joi.validate(relationship, relationshipSchema, {}, wrapError(400, 'Invalid Relationship', fn));
        },

        deserialized: ['validated', function(fn) {
            let rels = relationship.data,
                isArray = _.isArray(rels);
            if (!isArray) {
                rels = [rels];
            } else {
                _.extend(deserialized, {
                    [attr]: []
                });
            }
            async.eachSeries(rels, function(rel, _fn) {
                let relType = rel.type,
                    relId = rel.id,
                    deserializedRel = rel.attributes || {};
                if (relId) {
                    let idParam = _.get(internal.types, relType + '.default.id') || 'id';
                    deserializedRel[idParam] = relId;
                }
                if (!data[relType]) {
                    data[relType] = [];
                }
                if (!_.find(data[relType], deserializedRel)) {
                    data[relType].push(deserializedRel);
                }
                if (isArray) {
                    deserialized[attr].push(deserializedRel);
                } else {
                    deserialized[attr] = deserializedRel;
                }
                _fn();
            }, fn);
        }]
    }, cb);
};
