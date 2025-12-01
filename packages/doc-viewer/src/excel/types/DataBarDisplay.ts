/**
 */

import {X14DataBar} from './X14CF/X14DataBar';

export type DataBarDisplay = {
  /**
   */
  showValue: boolean;

  /**
   */
  percent: number;

  /**
   */
  color: string;

  /**
   */
  border: boolean;

  /**
   */
  gradient: boolean;

  /**
   */
  colorGradient: string;

  /**
   */
  borderColor: string;

  /**
   */
  negativeFillColor: string;

  /**
   */
  negativeFillColorGradient: string;

  /**
   */
  negativeBorderColor: string;

  /**
   */
  axisColor: string;

  /**
   */
  direction: X14DataBar['direction'];

  /**
   */
  biDirectional: boolean;
};
