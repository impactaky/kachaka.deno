import { pb } from "../deps.ts";
import { WithMetadata } from "./interfaces.d.ts";

export interface CallbackOptions {
  once?: boolean;
}
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

  async *[Symbol.asyncIterator]() {
    let cursor = 0;
    while (true) {
      const response = await this.get(cursor);
      cursor = response.metadata!.cursor!;
      yield this.#pickFunction(response);
    }
  }

  async #callbackLoop() {
    let cursor = (await this.get(0)).metadata!.cursor;
    while (this.#callbackFuncitons.length > 0) {
      const response = await this.get(cursor!);
      cursor = response.metadata!.cursor!;
      this.#callbackFuncitons.forEach((cb) => cb(this.#pickFunction(response)));
    }
  }
  addListner(callback: (result: U) => void, options?: CallbackOptions) {
    const callback_ = options?.once
      ? (result: U) => {
        this.removeListner(callback_);
        callback(result);
      }
      : callback;
    const isCallbackRunning = this.#callbackFuncitons.length > 0;
    this.#callbackFuncitons.push(callback_);
    if (!isCallbackRunning) {
      this.#callbackLoop();
    }
  }
  removeListner(callback: (result: U) => void) {
    this.#callbackFuncitons = this.#callbackFuncitons.filter(
      (cb) => cb !== callback,
    );
  }
}
