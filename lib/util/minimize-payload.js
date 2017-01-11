'use strict';

const _ = require('lodash');

module.exports = function(data) {

    let newData = _.clone(data);

    // Remove empty fields
    if (!_.isArray(newData)) {
        newData = _.omitBy(newData, (property) => _.isObject(property) && _.isEmpty(property));
    } else {
        newData = _.map(newData, (doc) => {
            return _.omitBy(doc, (property) => _.isObject(property) && _.isEmpty(property));
        });
    }

    return newData;
};