import * as StreamDriver from './stream-driver'
import {expect} from 'chai'
const testIntent = StreamDriver.createIntent('test');

class TestDriver implements StreamDriver.IDriver{
  constructor(apply: (state: StreamDriver.State, intent: StreamDriver.Intent) => StreamDriver.State) {

    this.apply = apply
  }

  apply: (state: StreamDriver.State, intent: StreamDriver.Intent) => StreamDriver.State
}

describe("Attach", () => {
  beforeEach(() => {
    StreamDriver.__resetState__();
  })

  it("Calls attached drivers", () => {
    var driverApplyCalled = false
    var driver = new TestDriver((s) => { driverApplyCalled = true; } )

    StreamDriver.attachDriver({key: "tests", driver: driver})
    testIntent()

    expect(driverApplyCalled).to.be.true
  })

  it("Calls attached drivers", () => {
    var driverApplyCalled = false
    var driver = new TestDriver((s) => { driverApplyCalled = true; } )

    StreamDriver.attachDriver({key: "tests", driver: driver})
    testIntent()

    expect(driverApplyCalled).to.be.true

  })
});
