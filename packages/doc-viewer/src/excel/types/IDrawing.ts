import {
  CT_AbsoluteAnchor,
  CT_AnchorClientData,
  CT_OneCellAnchor,
  CT_Picture,
  CT_Shape,
  CT_ShapeProperties,
  CT_TwoCellAnchor
} from '../../openxml/ExcelTypes';
import {OutLine} from '../../openxml/drawing/ShapeProperties';
import {IChartSpace} from './IChartSpace';
import {RichText} from './RichText';

export type IPicture = CT_Picture & {
  /**
   */
  imgURL?: string;

  /**
   */
  gid: string;
};

export type StyleColor = {
  lnRefColor?: string;
  fillRefColor?: string;
  effectRefColor?: string;
  fontRefColor?: string;
};

export type IShapeProperties = CT_ShapeProperties & {
  /**
   */
  outline?: OutLine;
  fillColor?: string;
};

export type IShape = CT_Shape & {
  spPr?: IShapeProperties;
  /**
   */
  styleColor?: StyleColor;
  /**
   */
  richText?: RichText;
};

export type IAnchorCommon = {
  pic?: IPicture;
  shape?: IShape;
  chartSpace?: IChartSpace;
};

export type ITwoCellAnchor = CT_TwoCellAnchor & IAnchorCommon;

export type IAbsoluteAnchor = CT_AbsoluteAnchor & IAnchorCommon;

export type IOneCellAnchor = CT_OneCellAnchor & IAnchorCommon;

export type IDrawing = {
  oneCellAnchors: IOneCellAnchor[];
  twoCellAnchors: ITwoCellAnchor[];
  absoluteAnchors: IAbsoluteAnchor[];
};
