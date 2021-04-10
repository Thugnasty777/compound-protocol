import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { VTokenMethods, VTokenScenarioMethods } from './VToken';

interface CErc20DelegateMethods extends VTokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface CErc20DelegateScenarioMethods extends VTokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface CErc20Delegate extends Contract {
  methods: CErc20DelegateMethods;
  name: string;
}

export interface CErc20DelegateScenario extends Contract {
  methods: CErc20DelegateScenarioMethods;
  name: string;
}
