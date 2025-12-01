/**
 */
export type AttributeType =
  | 'string'
  | 'int'
  | 'double'
  | 'boolean'
  | 'child'
  // [comment removed]
  | 'child-string'
  | 'child-int'
  | 'any';

export const ANY_KEY = '__any__';

/**
 */
export interface Attribute {
  type: AttributeType;
  /**
   */
  required?: boolean;
  /**
   */
  defaultValue?: string | number | boolean;

  /**
   */
  childAttributes?: Attributes;

  /**
   */
  childIsArray?: boolean;
}

/**
 */
export type Attributes = {
  [key: string]: Attribute;
};
