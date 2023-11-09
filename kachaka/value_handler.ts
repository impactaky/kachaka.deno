import { pb } from "../deps.ts";
import { WithMetadata } from "./interfaces.d.ts";

export class ValueHandler<T extends object & WithMetadata, U, V, W> {
  #getFunction;
  #setFunction;
  #pickFunction;
  #callbackFuncitons = [];
  constructor(
    getFunction: (request: pb.GetRequest) => Promise<T>,
    pickFunction: (response: T) => U,
    setFunction?: (request: V) => Promise<W>,
  ) {
    this.#getFunction = getFunction;
    this.#pickFunction = pickFunction;
    this.#setFunction = setFunction;
  }
  async get(): Promise<U>;
  async get(cursor: number): Promise<T>;
  async get(cursor?: number) {
    if (cursor === undefined) {
      const response = await this.#getFunction({ metadata: { cursor: 0 } });
      return this.#pickFunction(response);
    }
    return await this.#getFunction({ metadata: { cursor: cursor } });
  }
  set(request: V) {
    return this.#setFunction!(request);
  }
}

