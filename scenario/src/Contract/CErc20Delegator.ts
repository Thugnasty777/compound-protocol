import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { VTokenMethods } from './VToken';
import { encodedNumber } from '../Encoding';

interface CErc20DelegatorMethods extends VTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

interface CErc20DelegatorScenarioMethods extends CErc20DelegatorMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

export interface CErc20Delegator extends Contract {
  methods: CErc20DelegatorMethods;
  name: string;
}

export interface CErc20DelegatorScenario extends Contract {
  methods: CErc20DelegatorMethods;
  name: string;
}
