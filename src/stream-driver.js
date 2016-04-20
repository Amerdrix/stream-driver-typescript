"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
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
function createIntent(name) {
    var intent = function (data) {
        var record = new Intent(name, intent, data);
        intent$.onNext((record));
    };
    return intent;
}
exports.createIntent = createIntent;
var _CompositeDriver = (function () {
    function _CompositeDriver() {
    }
    _CompositeDriver.prototype.apply = function (state, intent) {
        state = this.beforeApply(state, intent);
        var drivers = this.getDrivers(state);
        state = drivers.reduce(function (state, driver) {
            var innerState = state.get(driver.key);
            var newState = driver.driver.apply(innerState, intent) || innerState;
            return state.set(driver.key, newState);
        }, state);
        return this.afterApply(state, intent);
    };
    _CompositeDriver.prototype.beforeApply = function (state, intent) {
        return state;
    };
    _CompositeDriver.prototype.afterApply = function (state, intent) {
        return state;
    };
    _CompositeDriver.prototype.getDrivers = function (state) {
        return state.get('__drivers')
            || Immutable.List();
    };
    _CompositeDriver.prototype.setDrivers = function (state, drivers) {
        return state.set('__drivers', drivers);
    };
    return _CompositeDriver;
}());
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
var RootDriver = (function (_super) {
    __extends(RootDriver, _super);
    function RootDriver() {
        _super.apply(this, arguments);
    }
    RootDriver.prototype.beforeApply = function (state, intent) {
        switch (intent.key) {
            case exports.attachDriver:
                var data = intent.data;
                var path = data.path.split('.');
                var parentState = state.getIn(path.slice(0, -1));
                var driver = parentState.get('__driver');
                console.log(path, parentState);
                if (driver instanceof _CompositeDriver) {
                    var key = path[path.length - 1];
                    var updatedDriverList = driver.getDrivers(parentState).push({ key: key, driver: data.driver });
                    var updatedState = driver.setDrivers(parentState, updatedDriverList).setIn([key, '__driver'], driver);
                    return updatedState;
                }
                throw path.slice[0, -1] + " is not a composite driver";
            case exports.__resetState__:
                return INITIAL_STATE;
            default:
                return state;
        }
    };
    return RootDriver;
}(_CompositeDriver));
exports.attachDriver = createIntent('ATTACH DRIVER');
exports.__resetState__ = createIntent('RESET STATE');
exports.CompositeDriver = new _CompositeDriver();
var ROOT_DRIVER = new RootDriver();
var INITIAL_STATE = Immutable.Map({ '__driver': ROOT_DRIVER });
var intent$ = new Rx.Subject();
exports.state$ = intent$.scan(function (s, i) { return ROOT_DRIVER.apply(s, i); }, INITIAL_STATE).replay(1);
exports.state$.connect();
