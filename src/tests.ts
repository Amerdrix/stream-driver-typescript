import * as Rx from 'rx';
import * as Immutable from 'immutable'
import * as StreamDriver from './stream-driver'
import {expect} from 'chai'
const testIntent = StreamDriver.createIntent('test');

function getLastInStream (stream){
  return stream.takeUntilWithTime(0).last();
}

describe("StreamDriver", () => {
  var state$: Rx.Observable<StreamDriver.State> = null
  beforeEach(() => {
    StreamDriver.__resetState__();
    state$ = getLastInStream(StreamDriver.state$)
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
    var driver = (state, intent) => {
        intentMatch = intent.tag === testIntent;
        return state
      }

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

    state$.subscribe(state => {
      expect(state.getIn(['tests','StateUpdated'])).to.be.true
      done()
    })
  })

  it("can nest composite drivers", () => {
    var driverApplyCalled = false
    var testDriver = (s) => { driverApplyCalled = true;  return s}

    StreamDriver.attachDriver({path: "Parent", driver: StreamDriver.DynamicCompositeDriver})
    StreamDriver.attachDriver({path: "Parent.tests", driver: testDriver})

    testIntent()

    expect(driverApplyCalled).to.be.true
  })

  it("can nest to multiple levels composite drivers", () => {
    var driverApplyCalled = false
    var testDriver = (s) => { driverApplyCalled = true;  return s}

    StreamDriver.attachDriver({path: "Parent", driver: StreamDriver.DynamicCompositeDriver})
    StreamDriver.attachDriver({path: "Parent.child", driver: StreamDriver.DynamicCompositeDriver})
    StreamDriver.attachDriver({path: "Parent.child.tests", driver: testDriver})

    testIntent()

    expect(driverApplyCalled).to.be.true
  })

  it("handles intents published within a driver", (done) => {
    var secondIntentCalled = false
    var secondIntent = StreamDriver.createIntent<any>("second intent")
    var testDriver = (state = Immutable.Map<string, any>(), intent) => {
      switch(intent.tag){
        case secondIntent:
          return state.set('secondIntentResult', 'second')
        case testIntent:
          secondIntent()
          return state.set('firstIntentResult', 'first')
      }
      return state;
    }

    StreamDriver.attachDriver({path: "test", driver: testDriver})

    testIntent()

    state$.subscribe(state => {
      expect(state.getIn(['test','firstIntentResult'])).to.be.eq('first')
      expect(state.getIn(['test','secondIntentResult'])).to.be.eq('second')
      done()
    })
  })

  it("returns a stream of states within a nested driver", (done) => {

    var testDriver = (state = false, intent) => {
      switch(intent.tag){
        case testIntent:
          return true
      }
      return state;
    }

    StreamDriver.attachDriver({path: "Parent", driver: StreamDriver.DynamicCompositeDriver})
    StreamDriver.attachDriver({path: "Parent.child", driver: StreamDriver.DynamicCompositeDriver})
    const testState$ = StreamDriver.attachDriver({path: "Parent.child.tests", driver: testDriver})



    testIntent()

    getLastInStream(testState$).subscribe(state => {
      expect(state).to.be.true
      done()
    })
  })


});
