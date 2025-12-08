import { Cards } from "nextra/components";
import { ReactElement, JSXElementConstructor } from "react";

type CardProps = {
  arrow?: boolean;
  title: string;
  children: React.ReactNode;
  icon?: ReactElement<any, string | JSXElementConstructor<any>>;
  href: string;
};
export const Card: React.FC<CardProps> = ({
  arrow = true,
  ...props
}) => {
  return <Cards.Card arrow={arrow} {...props} />;
};
