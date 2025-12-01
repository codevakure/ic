/**
 */
export type CellValue = {
  row: number;
  col: number;
  /**
   */
  text: string;

  value: string | number | boolean | undefined;

  color?: string;

  isDate?: boolean;
};
