"use strict";
var Rx = require('rx');
var Immutable = require('immutable');
var Intent = (function () {
    function Intent(name, key, data) {
        this.key = key;
        this.name = name;
        this.data = data;
    }
    return Intent;
}());
exports.Intent = Intent;
var intentBuffer = new Array();
var publishingIntent = false;
function publishIntent(intent) {
    intentBuffer.push(intent);
    if (publishingIntent) {
        return;
    }
    publishingIntent = true;
    var bufferedIntent;
    while (bufferedIntent = intentBuffer.shift()) {
        intent$.onNext(bufferedIntent);
    }
    publishingIntent = false;
}
function createIntent(name) {
    var intentFactory = function (data) {
        var intent = new Intent(name, intentFactory, data);
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
var IDriverMap = (function () {
    function IDriverMap() {
    }
    return IDriverMap;
}());
var AttachDriverData = (function () {
    function AttachDriverData() {
    }
    return AttachDriverData;
}());
var RootDriver = function (state, intent) {
    if (intent.key === exports.attachDriver) {
        var data = intent.data;
        var fullPath = data.path.split('.');
        var path = fullPath.slice(0, -1);
        var key = fullPath[fullPath.length - 1];
        var driverState = state.getIn(path);
        var driver = driverState.get('__driver');
        if (driver === exports.CompositeDriver || driver === RootDriver) {
            var updatedDriverList = getCompositeDrivers(driverState).push({ key: key, driver: data.driver });
            var updatedDriverState = driverState.set('__drivers', updatedDriverList).setIn([key, '__driver'], driver);
            return state.setIn(path, updatedDriverState);
        }
    }
    if (intent.key === exports.__resetState__) {
        return INITIAL_STATE;
    }
    return exports.CompositeDriver(state, intent);
};
exports.attachDriver = createIntent('ATTACH DRIVER');
exports.__resetState__ = createIntent('RESET STATE');
var INITIAL_STATE = Immutable.Map({ '__driver': RootDriver });
var intent$ = new Rx.Subject();
exports.state$ = intent$.scan(RootDriver, INITIAL_STATE).replay(1);
exports.state$.connect();
