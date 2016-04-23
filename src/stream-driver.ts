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

export interface Driver{
  (state: State, intent: Intent): State;
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

function getOrDefault<T>(key: string, state: State, otherwise: T):T {
  return state.get(key) || otherwise
}

function getCompositeDrivers(state: State){
  return getOrDefault<Immutable.List<IDriverMap>>('__drivers', state, Immutable.List<IDriverMap>())
}

export const CompositeDriver: Driver = function(state: State, intent: Intent) {
  const drivers = getCompositeDrivers(state)
  return drivers.reduce((state, map) => {
    var innerState = state.get(map.key)
    var newState = map.driver(innerState, intent) || innerState
    return state.set(map.key, newState)
  }, state);
}


class IDriverMap {
  key: string
  driver: Driver
}

class AttachDriverData {
  path: string
  driver: Driver
}

const RootDriver : Driver = function(state: State, intent: Intent){

  if(intent.key === attachDriver){

    const data = <AttachDriverData>intent.data
    const fullPath = data.path.split('.')
    const path = fullPath.slice(0, -1)
    const key = fullPath[fullPath.length - 1]

    const driverState = state.getIn(path)
    const driver = driverState.get('__driver')

    if(driver === CompositeDriver || driver === RootDriver){
      const updatedDriverList = getCompositeDrivers(driverState).push({key: key, driver: data.driver})
      const updatedDriverState = driverState.set('__drivers', updatedDriverList).setIn([key, '__driver'], driver);
      return state.setIn(path, updatedDriverState)
    }

  }

  if(intent.key === __resetState__) {
    return INITIAL_STATE;
  }

  return CompositeDriver(state, intent)
}


export const attachDriver = createIntent<AttachDriverData>('ATTACH DRIVER')
export const  __resetState__ = createIntent('RESET STATE')

//export const CompositeDriver = new _CompositeDriver()
const INITIAL_STATE = Immutable.Map<string, any>({'__driver': RootDriver})
const intent$ = new Rx.Subject<Intent>()
export const state$ = intent$.scan(RootDriver, INITIAL_STATE).replay(1)
state$.connect()
