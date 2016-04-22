import * as Rx from 'rx'
import * as Immutable from 'immutable'

export type State = Immutable.Map<string, any>;

export class Intent{
  constructor(name: string, key: any, data: any){
    this.key = key
    this.name = name
    this.data = data
  }

  key: any
  data: any
  name: string
}

export interface IDriver{
  apply(state: State, intent: Intent): State
}

const intentBuffer = new Array<Intent>()
var publishingIntent = false
function publishIntent(intent: Intent){
  intentBuffer.push(intent)

  if (publishingIntent){
    return;
  }

  publishingIntent = true

  var bufferedIntent: Intent
  while(bufferedIntent = intentBuffer.shift()){
    intent$.onNext(bufferedIntent)
  }

  publishingIntent = false
}

export function createIntent<T>(name: string){
  var intentFactory = (data?: T) => {
    // this is a bit funky, we assign the factory function as ithe ID of the
    // intent
    const intent = new Intent(name, intentFactory, data)
    publishIntent(intent)
  }

  return intentFactory;
}

class _CompositeDriver implements IDriver{
  apply(state: State, intent: Intent){
    state = this.beforeApply(state, intent);

    const drivers = this.getChildDrivers(state)

    state = drivers.reduce((state, driver) => {
      var innerState = state.get(driver.key)
      var newState = driver.driver.apply(innerState, intent) || innerState
      return state.set(driver.key, newState)
    }, state);


    return this.afterApply(state, intent)
  }

  protected beforeApply(state: State, intent: Intent){
    return state;
  }

  protected afterApply(state: State, intent: Intent){
    return state;
  }

  protected getChildDrivers(state: State) {
    return <Immutable.List<IDriverMap>>state.get('__drivers')
                        || Immutable.List<IDriverMap>();
  }

  protected setDrivers(state: State,  drivers: Immutable.List<IDriverMap>) {
    return state.set('__drivers', drivers)
  }
}

class IDriverMap {
  key: string
  driver: IDriver
}

class AttachDriverData {
  path: string
  driver: IDriver
}

class RootDriver extends _CompositeDriver {

  beforeApply(state: State, intent: Intent){
    switch(intent.key){
      case attachDriver:

        const data = <AttachDriverData>intent.data
        const fullPath = data.path.split('.')
        const path = fullPath.slice(0, -1)
        const key = fullPath[fullPath.length - 1]


        const driverState = state.getIn(path)
        const driver = driverState.get('__driver')

        if(driver instanceof _CompositeDriver){
          const updatedDriverList = driver.getChildDrivers(driverState).push({key: key, driver: data.driver})

          const updatedDriverState = driver.setDrivers(driverState, updatedDriverList).setIn([key, '__driver'], driver);
          return state.setIn(path, updatedDriverState)
        }

        throw `${path} is not a composite driver`

      case __resetState__:
        return INITIAL_STATE
      default:
        return state;
    }
  }
}


export const attachDriver = createIntent<AttachDriverData>('ATTACH DRIVER')
export const  __resetState__ = createIntent('RESET STATE')

export const CompositeDriver = new _CompositeDriver()
const ROOT_DRIVER = new RootDriver()
const INITIAL_STATE = Immutable.Map<string, any>({'__driver': ROOT_DRIVER})
const intent$ = new Rx.Subject<Intent>()
export const state$ = intent$.scan((s, i) => ROOT_DRIVER.apply(s,i),  INITIAL_STATE).replay(1)
state$.connect()
