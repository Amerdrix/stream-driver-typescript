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
    var completedState$ = null;
    beforeEach(function () {
        StreamDriver.__resetState__();
        completedState$ = StreamDriver.state$.takeUntilWithTime(15);
    });
    it("Calls attached drivers", function () {
        var driverApplyCalled = false;
        var driver = new TestDriver(function (s) { driverApplyCalled = true; return s; });
        StreamDriver.attachDriver({ path: "tests", driver: driver });
        testIntent();
        chai_1.expect(driverApplyCalled).to.be.true;
    });
    it("updates state as per the returned state ", function (done) {
        var driver = new TestDriver(function (state) {
            state = state || Immutable.Map();
            return state.set('StateUpdated', true);
        });
        StreamDriver.attachDriver({ path: "tests", driver: driver });
        testIntent();
        completedState$.last().subscribe(function (state) {
            chai_1.expect(state.getIn(['tests', 'StateUpdated'])).to.be.true;
            done();
        });
    });
    it("can nest composite drivers", function () {
        var driverApplyCalled = false;
        var testDriver = new TestDriver(function (s) { driverApplyCalled = true; return s; });
        try {
            StreamDriver.attachDriver({ path: "Parent", driver: StreamDriver.CompositeDriver });
            StreamDriver.attachDriver({ path: "Parent.tests", driver: testDriver });
        }
        catch (e) {
            console.log("errro" + e);
        }
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
});
