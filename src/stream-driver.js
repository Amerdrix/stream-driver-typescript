"use strict";
var Rx = require('rx');
var Immutable = require('immutable');
function createIntent(name) {
    var intentFactory = function (data) {
        var intent = {
            tag: intentFactory,
            name: name,
            data: data
        };
        publishIntent(intent);
    };
    return intentFactory;
}
exports.createIntent = createIntent;
exports.DynamicCompositeDriver = function (state, intent) {
    var drivers = getDynamicCompositeDrivers(state);
    return drivers.reduce(function (state, driver, key) {
        var innerState = state.get(key);
        var newState = driver(innerState, intent);
        return state.set(key, newState);
    }, state);
};
var INITIAL_STATE = Immutable.Map({ '__drivers': Immutable.Map() });
var INTENT$ = new Rx.Subject();
var _attachDriver = createIntent('ATTACH DRIVER');
exports.attachDriver = function (data) {
    _attachDriver(data);
    var _a = splitPath(data.path), path = _a[0], key = _a[1];
    return exports.state$
        .select(function (root) { return root.getIn(path); })
        .where(function (parentNode) { return parentNode && parentNode.has(key); })
        .select(function (parentNode) { return parentNode.get(key); });
};
exports.__resetState__ = createIntent('RESET STATE');
exports.state$ = INTENT$.scan(RootDriver, INITIAL_STATE).replay(1);
exports.state$.connect();
function getOrDefault(key, state, otherwise) {
    return state.get(key) || otherwise;
}
function getDynamicCompositeDrivers(state) {
    return getOrDefault('__drivers', state, Immutable.Map());
}
function splitPath(inputPath) {
    var fullPath = inputPath.split('.');
    var path = fullPath.slice(0, -1);
    var key = fullPath[fullPath.length - 1];
    return [path, key];
}
var publishIntent = (function () {
    var intentBuffer = new Array();
    var publishingIntent = false;
    return function (intent) {
        intentBuffer.push(intent);
        if (publishingIntent) {
            return;
        }
        publishingIntent = true;
        var bufferedIntent;
        while (bufferedIntent = intentBuffer.shift()) {
            INTENT$.onNext(bufferedIntent);
        }
        publishingIntent = false;
    };
})();
function RootDriver(state, intent) {
    switch (intent.tag) {
        case _attachDriver:
            var data = intent.data;
            var _a = splitPath(intent.data.path), path = _a[0], key = _a[1];
            var pathState = state.getIn(path);
            var driverList = getDynamicCompositeDrivers(pathState);
            if (driverList) {
                var updatePathState = pathState.set('__drivers', driverList.set(key, data.driver));
                if (data.driver === exports.DynamicCompositeDriver) {
                    updatePathState = updatePathState.setIn([key, '__drivers'], Immutable.Map());
                }
                return state.setIn(path, updatePathState);
            }
            throw "cannot add driver to " + path.join('.') + " as it is not a composite driver";
        case exports.__resetState__:
            return INITIAL_STATE;
        default:
            return exports.DynamicCompositeDriver(state, intent);
    }
}
