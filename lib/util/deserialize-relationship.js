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

module.exports = function(deserialized, attr, relationship, data, cb) {
    async.auto({
        validated: function(fn) {
            let dataSchema = joi.object({
                id: joi.any().required(),
                type: joi.string().required()
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
                    relId = rel.id;
                if (!data[relType]) {
                    data[relType] = [];
                }
                if (data[relType].indexOf(relId) === -1) {
                    data[relType].push(relId);
                }
                if (isArray) {
                    if (!deserialized[attr]) {
                        deserialized[attr] = [];
                    }
                    deserialized[attr].push(relId);
                } else {
                    deserialized[attr] = relId;
                }
                _fn();
            }, fn);
        }]
    }, cb);
};
