module.exports = function () {
    "use strict";

    const list = {};
    return {
        add: function (name) {
            list[name] = true
        },
        remove: function (name) {
            delete list[name]
        },
        check: function (name) {
            return list[name]
        },
        list: function () {
            return Object.keys(list)
        }
    };
}