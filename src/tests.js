"use strict";
var Immutable = require('immutable');
var StreamDriver = require('./stream-driver');
var chai_1 = require('chai');
var testIntent = StreamDriver.createIntent('test');
function getLastInStream(stream) {
    return stream.takeUntilWithTime(0).last();
}
describe("StreamDriver", function () {
    var state$ = null;
    beforeEach(function () {
        StreamDriver.__resetState__();
        state$ = getLastInStream(StreamDriver.state$);
    });
    it("Calls attached drivers", function () {
        var driverApplyCalled = false;
        var driver = function (s) { driverApplyCalled = true; return s; };
        StreamDriver.attachDriver({ path: "tests", driver: driver });
        testIntent();
        chai_1.expect(driverApplyCalled).to.be.true;
    });
    it("provides the intent to 'apply'", function () {
        var intentMatch = false;
        var driver = function (state, intent) {
            intentMatch = intent.tag === testIntent;
            return state;
        };
        StreamDriver.attachDriver({ path: "tests", driver: driver });
        testIntent();
        chai_1.expect(intentMatch).to.be.true;
    });
    it("updates state as per the returned state ", function (done) {
        var driver = function (state) {
            state = state || Immutable.Map();
            return state.set('StateUpdated', true);
        };
        StreamDriver.attachDriver({ path: "tests", driver: driver });
        testIntent();
        state$.subscribe(function (state) {
            chai_1.expect(state.getIn(['tests', 'StateUpdated'])).to.be.true;
            done();
        });
    });
    it("can nest composite drivers", function () {
        var driverApplyCalled = false;
        var testDriver = function (s) { driverApplyCalled = true; return s; };
        StreamDriver.attachDriver({ path: "Parent", driver: StreamDriver.DynamicCompositeDriver });
        StreamDriver.attachDriver({ path: "Parent.tests", driver: testDriver });
        testIntent();
        chai_1.expect(driverApplyCalled).to.be.true;
    });
    it("can nest to multiple levels composite drivers", function () {
        var driverApplyCalled = false;
        var testDriver = function (s) { driverApplyCalled = true; return s; };
        StreamDriver.attachDriver({ path: "Parent", driver: StreamDriver.DynamicCompositeDriver });
        StreamDriver.attachDriver({ path: "Parent.child", driver: StreamDriver.DynamicCompositeDriver });
        StreamDriver.attachDriver({ path: "Parent.child.tests", driver: testDriver });
        testIntent();
        chai_1.expect(driverApplyCalled).to.be.true;
    });
    it("handles intents published within a driver", function (done) {
        var secondIntentCalled = false;
        var secondIntent = StreamDriver.createIntent("second intent");
        var testDriver = function (state, intent) {
            if (state === void 0) { state = Immutable.Map(); }
            switch (intent.tag) {
                case secondIntent:
                    return state.set('secondIntentResult', 'second');
                case testIntent:
                    secondIntent();
                    return state.set('firstIntentResult', 'first');
            }
            return state;
        };
        StreamDriver.attachDriver({ path: "test", driver: testDriver });
        testIntent();
        state$.subscribe(function (state) {
            chai_1.expect(state.getIn(['test', 'firstIntentResult'])).to.be.eq('first');
            chai_1.expect(state.getIn(['test', 'secondIntentResult'])).to.be.eq('second');
            done();
        });
    });
    it("returns a stream of states within a nested driver", function (done) {
        var testDriver = function (state, intent) {
            if (state === void 0) { state = false; }
            switch (intent.tag) {
                case testIntent:
                    return true;
            }
            return state;
        };
        StreamDriver.attachDriver({ path: "Parent", driver: StreamDriver.DynamicCompositeDriver });
        StreamDriver.attachDriver({ path: "Parent.child", driver: StreamDriver.DynamicCompositeDriver });
        var testState$ = StreamDriver.attachDriver({ path: "Parent.child.tests", driver: testDriver });
        testIntent();
        getLastInStream(testState$).subscribe(function (state) {
            chai_1.expect(state).to.be.true;
            done();
        });
    });
});
