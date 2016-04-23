import * as Rx from 'rx';
import * as Immutable from 'immutable'
import * as StreamDriver from './stream-driver'
import {expect} from 'chai'
const testIntent = StreamDriver.createIntent('test');

describe("Attach", () => {
  var state$: Rx.Observable<StreamDriver.State> = null
  beforeEach(() => {
    StreamDriver.__resetState__();
    state$ = StreamDriver.state$.takeUntilWithTime(15); // Some tests require async calls - so this is a tuning problem
  })

  it("Calls attached drivers", () => {
    var driverApplyCalled = false
    var driver = (s) => { driverApplyCalled = true;  return s}

    StreamDriver.attachDriver({path: "tests", driver: driver})
    testIntent()

    expect(driverApplyCalled).to.be.true
  })


  it("provides the intent to 'apply'", () => {
    var intentMatch = false
    var driver = (s, i) => { intentMatch = i.key === testIntent;  return s}

    StreamDriver.attachDriver({path: "tests", driver: driver})
    testIntent()

    expect(intentMatch).to.be.true
  })

  it("updates state as per the returned state ", (done) => {
    var driver = (state) => {
        state = state || Immutable.Map<string, any>()
        return state.set('StateUpdated', true)
    }

    StreamDriver.attachDriver({path: "tests", driver: driver})
    testIntent()

    state$.last().subscribe(state => {
      expect(state.getIn(['tests','StateUpdated'])).to.be.true
      done()
    })
  })

  it("can nest composite drivers", () => {
    var driverApplyCalled = false
    var testDriver = (s) => { driverApplyCalled = true;  return s}

    StreamDriver.attachDriver({path: "Parent", driver: StreamDriver.CompositeDriver})
    StreamDriver.attachDriver({path: "Parent.tests", driver: testDriver})

    testIntent()

    expect(driverApplyCalled).to.be.true
  })

  it("can nest to multiple levels composite drivers", () => {
    var driverApplyCalled = false
    var testDriver = (s) => { driverApplyCalled = true;  return s}

    StreamDriver.attachDriver({path: "Parent", driver: StreamDriver.CompositeDriver})
    StreamDriver.attachDriver({path: "Parent.child", driver: StreamDriver.CompositeDriver})
    StreamDriver.attachDriver({path: "Parent.child.tests", driver: testDriver})

    testIntent()

    expect(driverApplyCalled).to.be.true
  })

  it("handles intents published within a driver", (done) => {
    var secondIntentCalled = false
    var secondIntent = StreamDriver.createIntent<any>("second intent")
    var testDriver = (state, intent) => {
      switch(intent.key){
        case secondIntent:
          return state.set('secondIntentResult', 'second')
        case testIntent:
          secondIntent({})
          return state.set('firstIntentResult', 'first')
      }
      return state;
    }

    StreamDriver.attachDriver({path: "tests", driver: testDriver})

    testIntent()

    state$.last().subscribe(state => {
      expect(state.getIn(['tests','firstIntentResult'])).to.be.eq('first')
      expect(state.getIn(['tests','secondIntentResult'])).to.be.eq('second')
      done()
    })
  })


});
