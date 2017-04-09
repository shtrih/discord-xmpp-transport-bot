"use strict";

class List {
    constructor() {
        this._list = {};
    }

    add(name) {
        this._list[name] = true
    }

    remove(name) {
        delete this._list[name]
    }

    check(name) {
        return this._list[name]
    }

    list() {
        return Object.keys(this._list)
    }
}

module.exports = List;