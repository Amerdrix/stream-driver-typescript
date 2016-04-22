"use strict";
var Immutable = require('immutable');
var StreamDriver = require('./stream-driver');
var chai_1 = require('chai');
var testIntent = StreamDriver.createIntent('test');
var TestDriver = (function () {
    function TestDriver(apply) {
        this.apply = apply;
    }
    return TestDriver;
}());
describe("Attach", function () {
    var state$ = null;
    beforeEach(function () {
        StreamDriver.__resetState__();
        state$ = StreamDriver.state$.takeUntilWithTime(15);
    });
    it("Calls attached drivers", function () {
        var driverApplyCalled = false;
        var driver = new TestDriver(function (s) { driverApplyCalled = true; return s; });
        StreamDriver.attachDriver({ path: "tests", driver: driver });
        testIntent();
        chai_1.expect(driverApplyCalled).to.be.true;
    });
    it("provides the intent to 'apply'", function () {
        var intentMatch = false;
        var driver = new TestDriver(function (s, i) { intentMatch = i.key === testIntent; return s; });
        StreamDriver.attachDriver({ path: "tests", driver: driver });
        testIntent();
        chai_1.expect(intentMatch).to.be.true;
    });
    it("updates state as per the returned state ", function (done) {
        var driver = new TestDriver(function (state) {
            state = state || Immutable.Map();
            return state.set('StateUpdated', true);
        });
        StreamDriver.attachDriver({ path: "tests", driver: driver });
        testIntent();
        state$.last().subscribe(function (state) {
            chai_1.expect(state.getIn(['tests', 'StateUpdated'])).to.be.true;
            done();
        });
    });
    it("can nest composite drivers", function () {
        var driverApplyCalled = false;
        var testDriver = new TestDriver(function (s) { driverApplyCalled = true; return s; });
        StreamDriver.attachDriver({ path: "Parent", driver: StreamDriver.CompositeDriver });
        StreamDriver.attachDriver({ path: "Parent.tests", driver: testDriver });
        testIntent();
        chai_1.expect(driverApplyCalled).to.be.true;
    });
    it("can nest to multiple levels composite drivers", function () {
        var driverApplyCalled = false;
        var testDriver = new TestDriver(function (s) { driverApplyCalled = true; return s; });
        StreamDriver.attachDriver({ path: "Parent", driver: StreamDriver.CompositeDriver });
        StreamDriver.attachDriver({ path: "Parent.child", driver: StreamDriver.CompositeDriver });
        StreamDriver.attachDriver({ path: "Parent.child.tests", driver: testDriver });
        testIntent();
        chai_1.expect(driverApplyCalled).to.be.true;
    });
    it("handles intents published within a driver", function (done) {
        var secondIntentCalled = false;
        var secondIntent = StreamDriver.createIntent("second intent");
        var testDriver = new TestDriver(function (state, intent) {
            switch (intent.key) {
                case secondIntent:
                    return state.set('secondIntentResult', 'second');
                case testIntent:
                    secondIntent({});
                    return state.set('firstIntentResult', 'first');
            }
            return state;
        });
        StreamDriver.attachDriver({ path: "tests", driver: testDriver });
        testIntent();
        state$.last().subscribe(function (state) {
            chai_1.expect(state.getIn(['tests', 'firstIntentResult'])).to.be.eq('first');
            chai_1.expect(state.getIn(['tests', 'secondIntentResult'])).to.be.eq('second');
            done();
        });
    });
});
