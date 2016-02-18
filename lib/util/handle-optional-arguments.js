'use strict';

var _ = require('lodash');

/**
 * Handle various signatures
 * - {String} schemaName, {Object|Object[]} data, {Object} options, {Function} cb
 * - {String} schemaName, {Object|Object[]} data, {Function} cb
 * - {Object|Object[]} data, {Object} options, {Function} cb
 * - {Object|Object[]} data, {Function} cb
 * @param  {[type]}   schemaName [description]
 * @param  {[type]}   obj        [description]
 * @param  {[type]}   options    [description]
 * @param  {Function} cb         [description]
 * @return {[type]}              [description]
 */
module.exports = function handleOptionalArguments(schemaName, data, options, cb) {
    if (_.isString(schemaName)) {
        if (_.isFunction(options)) {
            // signature 2 (schemaName, data, cb)
            cb = options;
            options = {};
        }
    } else {
        if (_.isFunction(data)) {
            // signature 4 (data, cb)
            cb = data;
            data = schemaName;
            options = {};
            schemaName = 'default';
        } else {
            // signature 3 (data, options, cb)
            cb = options;
            options = data;
            data = schemaName;
            schemaName = 'default';
        }
    }
    return {
        schemaName: schemaName,
        data: data,
        options: options,
        cb: cb
    };
};
