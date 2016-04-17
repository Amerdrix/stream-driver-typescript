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

export function createIntent<T>(name: string){

  var intent = (data?: T) => {

    // this is a bit funky, we assign the factory function as ithe ID of the
    // intent
    var record = new Intent(name, intent, data)
    intent$.onNext(<Intent>(record))
  }

  return intent;
}

export class CompositeDriver implements IDriver{
  apply(state: State, intent: Intent){


    state = this.beforeApply(state, intent);

    const drivers = this.getDrivers(state)

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

  protected getDrivers(state: State) {
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

class RootDriver extends CompositeDriver {

  beforeApply(state: State, intent: Intent){
    console.log(`intent: ${intent.name}`)

    switch(intent.key){
      case attachDriver:
        var drivers = this.getDrivers(state).push({key: intent.data.key, driver: intent.data.driver})
        return this.setDrivers(state, drivers)
      case __resetState__:
        return Immutable.Map<string, any>();
      default:
        return state;
    }
  }
}

export const attachDriver = createIntent<IDriverMap>('ATTACH DRIVER')
export const  __resetState__ = createIntent('RESET STATE')

const ROOT_DRIVER = new RootDriver()
const INITIAL_STATE = Immutable.Map<string, any>()
const intent$ = new Rx.Subject<Intent>()
const state$ = intent$.scan((s, i) => ROOT_DRIVER.apply(s,i),  INITIAL_STATE).replay(1)
state$.connect()
