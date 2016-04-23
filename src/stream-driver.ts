import * as Rx from 'rx'
import * as Immutable from 'immutable'

export type State = Immutable.Map<string, any>;

export interface Intent{
  tag: any
  data: any
  name: string
}

export interface Driver<T>{
  (state: T, intent: Intent): T;
}

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

export const DynamicCompositeDriver: Driver<State> = function(state: State, intent: Intent) {
  const drivers = getDynamicCompositeDrivers(state)

  return drivers.reduce((state, driver, key) => {
    var innerState = state.get(key)
    var newState = driver(innerState, intent)
    return state.set(key, newState)
  }, state);
}

const INITIAL_STATE = Immutable.Map<string, any>({'__drivers': Immutable.Map<string, Driver<State>>()})
const INTENT$ = new Rx.Subject<Intent>()


const _attachDriver = createIntent<AttachDriverData>('ATTACH DRIVER')
export const attachDriver = (data: AttachDriverData) => {
  _attachDriver(data)

  const [path, key] = splitPath(data.path)

  return state$
    .select(root => root.getIn(path))
    .where(parentNode => parentNode && parentNode.has(key))
    .select(parentNode => parentNode.get(key))
}

export const  __resetState__ = createIntent('RESET STATE')

// casting to any is a bit of a hack, but it seems the typescript definition is missing
export const state$ = (<any>INTENT$.scan(RootDriver, INITIAL_STATE)).replay(1)
state$.connect()

// --------------- Private ---------------------

interface AttachDriverData {
  path: string
  driver: Driver<any>
}

function getOrDefault<T>(key: string, state: State, otherwise: T):T {
  return state.get(key) || otherwise
}

function getDynamicCompositeDrivers(state: State){
  return getOrDefault<Immutable.Map<string, Driver<State>>>('__drivers', state, Immutable.Map<string, Driver<State>>())
}

function splitPath(inputPath: string):[Array<string>, string]{
  const fullPath = inputPath.split('.')
  const path = fullPath.slice(0, -1)
  const key = fullPath[fullPath.length - 1]

  return [path, key]
}

const publishIntent = (() =>  {
  const intentBuffer = new Array<Intent>()
  var publishingIntent = false
  return function (intent: Intent) {
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

function RootDriver (state: State, intent: Intent){
  switch(intent.tag)
  {
    case _attachDriver:
      const data = <AttachDriverData>intent.data
      const [path, key] = splitPath(intent.data.path)

      const pathState = state.getIn(path)
      const driverList = getDynamicCompositeDrivers(pathState)
      if(driverList)
      {
        var updatePathState = pathState.set('__drivers',  driverList.set(key, data.driver))

        if(data.driver === DynamicCompositeDriver){
          updatePathState = updatePathState.setIn([key, '__drivers'], Immutable.Map<string, Driver<State>>());
        }

        return state.setIn(path, updatePathState)
      }
      throw `cannot add driver to ${path.join('.')} as it is not a composite driver`

    case __resetState__:
      return INITIAL_STATE;

    default:
      return DynamicCompositeDriver(state, intent)
  }
}
