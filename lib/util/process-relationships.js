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

function addToField(field, item) {
    if (!field) {
        field = item;
    } else if (!_.isArray(field)) {
        let member = field;
        field = [];
        field.push.apply(field, [member, item]);
    } else {
        field.push(item);
    }

    return field;
}

function findInField(field, identifier) {
    let result;

    if (_.isArray(field)) {
        result = _.find(field, identifier);
    } else {
        result = field;
    }

    return result;
}

module.exports = function ProcessRelationships(internal, resource, included, visited, data, cb) {
    async.auto({
        validated: function(fn) {
            let dataSchema = joi.object({
                id: joi.any().required(),
                type: joi.string().required(),
                attributes: joi.object(),
                links: joi.object(),
                meta: joi.object()
            }).unknown(false);
            let relationshipSchema = joi.object({
                data: joi.alternatives().try(
                    dataSchema,
                    joi.array().items(dataSchema)
                )
            }).unknown(true).required();
            joi.validate(resource.relationships, relationshipSchema, {}, wrapError(400, 'Invalid Relationship', fn));
        },

        deserialized: ['validated', function(fn) {

            let resourceIdentifier = {type: resource.type, id: resource.id};

            // If this resource has already been visited, do not visit it again
            // If it has not been visited, mark it as visited
            if (_.find(visited, resourceIdentifier)) {
                return fn();
            } else {
                visited.push(resourceIdentifier);
            }

            let idParam = _.get(internal.types, resource.type + '.default.id') || 'id',
                entityIdentifier = _.set({}, idParam, resource.id),
                entityData = findInField(data[resource.type], entityIdentifier);

            /*
            if (_.isArray(data[resource.type])) {
                entityData = _.find(data[resource.type], entityIdentifier);
            } else {
                entityData = data[resource.type];
            }*/

            if (!entityData) {
                data[resource.type] = addToField(data[resource.type], entityIdentifier);

                return fn();
            }

            async.eachOfSeries(resource.relationships, function(relationship, relationshipName, _fn) {

                let relationshipData = _.castArray(relationship.data);

                async.eachSeries(relationshipData, function(relationshipDatum, _fn2) {

                    let includeRelationship = _.get(internal.types, resource.type + '.default.relationships.' + relationshipName + '.include', true),
                        relationshipIdParam = _.get(internal.types, relationshipDatum.type + '.default.id', 'id'),
                        nestedData = _.set({}, relationshipIdParam, relationshipDatum.id),
                        relationshipResource = _.find(included, {type: relationshipDatum.type, id: relationshipDatum.id});

                    if (relationshipResource) {
                        ProcessRelationships(internal, relationshipResource, included, visited, data, function() {
                            if (internal.options.nestDeserializedRelationships && includeRelationship) {
                                let relatedData = findInField(data[relationshipDatum.type], nestedData);

                                /*
                                if (_.isArray(data[relationshipDatum.type])) {
                                    relatedData = _.find(data[relationshipDatum.type], nestedData);
                                } else {
                                    relatedData = data[relationshipDatum.type];
                                }*/

                                nestedData = relatedData;
                            }

                            entityData[relationshipName] = addToField(entityData[relationshipName], nestedData);

                            _fn2();
                        });
                    } else {
                        entityData[relationshipName] = addToField(entityData[relationshipName], nestedData);

                        _fn2();
                    }

                }, _fn);

            }, fn);
        }]
    }, cb);
};