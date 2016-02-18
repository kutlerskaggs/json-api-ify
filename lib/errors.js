'use strict';

var errors = {
    '1': {
        status: 500,
        title: 'An undefined error occured'
    },
    '1001': {
        status: 500,
        title: 'Invalid `processDocument` hook'
    },
    '1002': {
        status: 500,
        title: 'Invalid `type` specified'
    },
    '1003': {
        status: 500,
        title: 'Invalid `options` specified'
    },
    '2001': {
        status: 500,
        title: 'Invalid data passed to serializer'
    }
};

module.exports = {
    generateError(code, detail, meta) {
        let err = errors[code] || errors['1'];
        err.detail = detail || 'No detail provided';
        err.meta = meta;
        return err;
    }
};
