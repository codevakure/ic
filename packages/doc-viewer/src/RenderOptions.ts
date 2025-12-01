/**
 */
export interface RenderOptions {
  /**
   */
  enableVar?: boolean;

  /**
   */
  data?: any;

  /**
   */
  evalVar: (
    text: string,
    data?: Object
  ) => Object | string | number | boolean | null | undefined;

  /**
   */
  debug?: boolean;

  /**
   */
  fontMapping?: Record<string, string>;
}
