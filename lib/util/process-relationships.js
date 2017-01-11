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

        if (!_.matches(item)(field)) {
            let member = field;
            field = [];
            field.push.apply(field, [member, item]);
        }
    } else {
        if (!_.find(field, item)) {
            field.push(item);
        }
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
                ).allow(null)
            }).unknown(true).required();
            let relationshipsSchema = joi.object().pattern(/^\w+$/, relationshipSchema);

            if (resource.relationships && !_.isEmpty(resource.relationships)) {
                joi.validate(resource.relationships, relationshipsSchema, {}, wrapError(400, 'Invalid Relationship', fn));
            } else {
                fn();
            }
        },

        deserialized: ['validated', function(fn) {

            let resourceIdentifier;

            if (!_.isUndefined(resource.id)) {
                resourceIdentifier = {type: resource.type, id: resource.id};
            } else {
                resourceIdentifier = {type: resource.type, id: resource.attributes};
            }

            // If this resource has already been visited, do not visit it again
            // If it has not been visited, mark it as visited
            if (_.find(visited, resourceIdentifier)) {
                return fn();
            } else {
                visited.push(resourceIdentifier);
            }

            let idParam = _.get(internal.types, resource.type + '.default.id') || 'id',
                entityIdentifier = _.set({}, idParam, resource.id),
                //entityIdentifier = resource.id,
                entityData;

            if (!_.isUndefined(resource.id)) {
                entityData = findInField(data[resource.type], entityIdentifier);
            } else {
                entityData= findInField(data[resource.type], resource.attributes);
            }

            // If the entity data couldn't be found at all, add it
            if (!entityData) {
                data[resource.type] = addToField(data[resource.type], entityIdentifier);

                return fn();
            }

            async.eachOfSeries(resource.relationships, function(relationship, relationshipName, _fn) {


                async.eachSeries(_.castArray(relationship.data), function(relationshipData, _fn2) {

                    if (relationshipData) {
                        let includeRelationship = _.get(internal.types, resource.type + '.default.relationships.' + relationshipName + '.include', true),
                            relationshipIdParam = _.get(internal.types, relationshipData.type + '.default.id', 'id'),
                            nestedData = _.set({}, relationshipIdParam, relationshipData.id),
                            //nestedData = relationshipData.id,
                            relationshipResource = _.find(included, {
                                type: relationshipData.type,
                                id: relationshipData.id
                            });

                        if (relationshipResource) {
                            ProcessRelationships(internal, relationshipResource, included, visited, data, function () {
                                if (internal.options.nestDeserializedRelationships && includeRelationship) {
                                    nestedData = findInField(data[relationshipData.type], nestedData);
                                }

                                entityData[relationshipName] = addToField(entityData[relationshipName], nestedData);

                                _fn2();
                            });
                        } else {
                            entityData[relationshipName] = addToField(entityData[relationshipName], nestedData);
                            data[relationshipData.type] = addToField(data[relationshipData.type], nestedData);

                            _fn2();
                        }
                    } else {
                        _fn2();
                    }

                }, _fn);

            }, fn);
        }]
    }, cb);
};