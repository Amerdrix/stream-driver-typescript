"use strict";
var Rx = require('rx');
var Immutable = require('immutable');
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
function getOrDefault(key, state, otherwise) {
    return state.get(key) || otherwise;
}
function getCompositeDrivers(state) {
    return getOrDefault('__drivers', state, Immutable.List());
}
exports.CompositeDriver = function (state, intent) {
    var drivers = getCompositeDrivers(state);
    return drivers.reduce(function (state, map) {
        var innerState = state.get(map.key);
        var newState = map.driver(innerState, intent) || innerState;
        return state.set(map.key, newState);
    }, state);
};
function RootDriver(state, intent) {
    switch (intent.tag) {
        case exports.attachDriver:
            var data = intent.data;
            var fullPath = data.path.split('.');
            var path = fullPath.slice(0, -1);
            var key = fullPath[fullPath.length - 1];
            var driverState = state.getIn(path);
            var driver = driverState.get('__driver');
            if (driver === exports.CompositeDriver || driver === RootDriver) {
                var updatedDriverList = getCompositeDrivers(driverState).push({ key: key, driver: data.driver });
                var updatedDriverState = driverState.set('__drivers', updatedDriverList).setIn([key, '__driver'], data.driver);
                return state.setIn(path, updatedDriverState);
            }
            throw "cannot add driver to " + path.join('.') + " as it is not a composite driver";
        case exports.__resetState__:
            return INITIAL_STATE;
        default:
            return exports.CompositeDriver(state, intent);
    }
}
var INITIAL_STATE = Immutable.Map({ '__driver': RootDriver });
var INTENT$ = new Rx.Subject();
exports.attachDriver = createIntent('ATTACH DRIVER');
exports.__resetState__ = createIntent('RESET STATE');
exports.state$ = INTENT$.scan(RootDriver, INITIAL_STATE).replay(1);
exports.state$.connect();
