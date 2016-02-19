'use strict';

var errors = require('../errors'),
    joi = require('joi');

module.exports = function validateOptions(options, cb) {
    let optionsSchema = joi.object({
        blacklist: joi.array().items(joi.string()).single().default([]),
        id: joi.alternatives().try(
            joi.string(),
            joi.func()
        ),
        processCollection: joi.func(),
        processResource: joi.func(),
        relationships: joi.object().pattern(/.+/, joi.object({
            type: joi.string().required(),
            include: joi.boolean().default(true)
        })).default({}).description('the relationships definition for this resource type'),
        topLevelLinks: joi.object().default({}),
        topLevelMeta: joi.object().default({}),
        whitelist: joi.array().items(joi.string()).single().default([])
    }).required();

    joi.validate(options, optionsSchema, {allowUnknown: true, convert: true}, function(err, validated) {
        if (err) {
            return cb(errors.generateError('1003', err.message, {error: err}));
        }
        cb(null, validated);
    });
};
