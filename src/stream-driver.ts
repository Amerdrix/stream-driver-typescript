import * as Rx from 'rx'
import * as Immutable from 'immutable'

export type State = Immutable.Map<string, any>;

interface AttachDriverData {
  path: string
  driver: Driver
}

interface DriverMapping {
  key: string
  driver: Driver
}

export interface Intent{
  tag: any
  data: any
  name: string
}

export interface Driver{
  (state: State, intent: Intent): State;
}

const publishIntent = (() =>  {
  const intentBuffer = new Array<Intent>()
  var publishingIntent = false
  return (intent: Intent) => {
    intentBuffer.push(intent)

    if (publishingIntent){
      return;
    }

    publishingIntent = true

    var bufferedIntent: Intent
    while(bufferedIntent = intentBuffer.shift()){
      INTENT$.onNext(bufferedIntent)
    }

    publishingIntent = false
  }
})()

export function createIntent<T>(name: string){
  var intentFactory = (data?: T) => {
    // this is a bit funky, we assign the factory function as ithe ID of the
    // intent
    const intent = {
      tag: intentFactory,
      name,
      data
    }
    publishIntent(intent)
  }

  return intentFactory;
}

function getOrDefault<T>(key: string, state: State, otherwise: T):T {
  return state.get(key) || otherwise
}

function getCompositeDrivers(state: State){
  return getOrDefault<Immutable.List<DriverMapping>>('__drivers', state, Immutable.List<DriverMapping>())
}

export const CompositeDriver: Driver = function(state: State, intent: Intent) {
  const drivers = getCompositeDrivers(state)
  return drivers.reduce((state, map) => {
    var innerState = state.get(map.key)
    var newState = map.driver(innerState, intent) || innerState
    return state.set(map.key, newState)
  }, state);
}

function RootDriver (state: State, intent: Intent){
  switch(intent.tag)
  {
    case attachDriver:

      const data = <AttachDriverData>intent.data
      const fullPath = data.path.split('.')
      const path = fullPath.slice(0, -1)
      const key = fullPath[fullPath.length - 1]

      const driverState = state.getIn(path)
      const driver = driverState.get('__driver')

      if(driver === CompositeDriver || driver === RootDriver){
        const updatedDriverList = getCompositeDrivers(driverState).push({key, driver: data.driver})
        const updatedDriverState = driverState.set('__drivers', updatedDriverList).setIn([key, '__driver'], data.driver);
        return state.setIn(path, updatedDriverState)
      }
      throw `cannot add driver to ${path.join('.')} as it is not a composite driver`

    case __resetState__:
      return INITIAL_STATE;

    default:
      return CompositeDriver(state, intent)
  }
}

const INITIAL_STATE = Immutable.Map<string, any>({'__driver': RootDriver})
const INTENT$ = new Rx.Subject<Intent>()

export const attachDriver = createIntent<AttachDriverData>('ATTACH DRIVER')
export const  __resetState__ = createIntent('RESET STATE')


// casting to any is a bit of a hack, but it seems the typescript definition is missing
export const state$ = (<any>INTENT$.scan(RootDriver, INITIAL_STATE)).replay(1)
state$.connect()
