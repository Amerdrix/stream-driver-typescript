import * as Rx from 'rx';
import * as Immutable from 'immutable'
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
  var completedState$: Rx.Observable<StreamDriver.State> = null
  beforeEach(() => {
    StreamDriver.__resetState__();
    completedState$ = StreamDriver.state$.takeUntilWithTime(15); // Some tests require async calls - so this is a tuning problem
  })

  it("Calls attached drivers", () => {
    var driverApplyCalled = false
    var driver = new TestDriver((s) => { driverApplyCalled = true;  return s} )

    StreamDriver.attachDriver({path: "tests", driver: driver})
    testIntent()

    expect(driverApplyCalled).to.be.true
  })

  it("updates state as per the returned state ", (done) => {
    var driver = new TestDriver(state => {
        state = state || Immutable.Map<string, any>()
        return state.set('StateUpdated', true)
    } )

    StreamDriver.attachDriver({path: "tests", driver: driver})
    testIntent()

    completedState$.last().subscribe(state => {
      expect(state.getIn(['tests','StateUpdated'])).to.be.true
      done()
    })
  })

  it("can nest composite drivers", () => {
    var driverApplyCalled = false
    var testDriver = new TestDriver((s) => { driverApplyCalled = true;  return s} )
    try {
      StreamDriver.attachDriver({path: "Parent", driver: StreamDriver.CompositeDriver})
      StreamDriver.attachDriver({path: "Parent.tests", driver: testDriver})
      }catch(e ){
        console.log("errro"  + e)
      }

    testIntent()

    expect(driverApplyCalled).to.be.true
  })

  it("can nest to multiple levels composite drivers", () => {
    var driverApplyCalled = false
    var testDriver = new TestDriver((s) => { driverApplyCalled = true;  return s} )
    try {
      StreamDriver.attachDriver({path: "Parent", driver: StreamDriver.CompositeDriver})
      StreamDriver.attachDriver({path: "Parent.child", driver: StreamDriver.CompositeDriver})
      StreamDriver.attachDriver({path: "Parent.child.tests", driver: testDriver})
      }catch(e ){
        console.log("errro"  + e)
      }

    testIntent()

    expect(driverApplyCalled).to.be.true
  })


});
