export interface ColorScheme {
  /* may eventually want to explictly type these as "Color" --
     refer to this link for a start https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/color/color-tests.ts
  */
  id: number;
  name: string;
  primary: string;
  secondary: string;
}
