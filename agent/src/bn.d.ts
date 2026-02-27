declare module "bn.js" {
  export default class BN {
    constructor(value: number | string | number[] | Buffer | BN, base?: number);
    toNumber(): number;
    toString(base?: number): string;
    add(other: BN): BN;
    sub(other: BN): BN;
    mul(other: BN): BN;
    div(other: BN): BN;
    mod(other: BN): BN;
  }
}
