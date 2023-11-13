import { pb } from "../deps.ts";
import { WithMetadata } from "./interfaces.d.ts";

export class ValueHandler<T extends object & WithMetadata, U, V, W> {
  #getFunction;
  #setFunction;
  #pickFunction;
  #callbackFuncitons: Array<(result: U) => void> = [];
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

  async callbackLoop() {
    let cursor = (await this.get(0)).metadata!.cursor;
    while (this.#callbackFuncitons.length > 0) {
      const response = await this.get(cursor!);
      cursor = response.metadata!.cursor!;
      this.#callbackFuncitons.forEach((cb) => cb(this.#pickFunction(response)));
    }
  }
  registerCallback(callback: (result: U) => void) {
    const isCallbackRunning = this.#callbackFuncitons.length > 0;
    this.#callbackFuncitons.push(callback);
    if (!isCallbackRunning) {
      this.callbackLoop();
    }
  }
  unregisterCallback(callback: (result: U) => void) {
    this.#callbackFuncitons = this.#callbackFuncitons.filter(
      (cb) => cb !== callback,
    );
  }
  onceNext(callback: (result: U) => void) {
    const once = (result: U) => {
      this.unregisterCallback(once);
      callback(result);
    };
    this.registerCallback(once);
  }
}
