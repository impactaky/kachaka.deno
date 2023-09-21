import {
  getClient,
  GetRequest,
  GrpcClient,
  KachakaApi,
  Metadata,
  Pose,
  Result,
  SetRobotVelocityRequest,
  StartCommandRequest,
} from "./deps.ts";
import { ShelfLocationResolver } from "./kachaka/layout.ts";
export * from "./protos/kachaka-api.d.ts";

// interface KachakaClientOption {
// }

// type OnlyOneKey<T extends object> = {
//   [K in keyof T]: (Exclude<keyof T, K> extends never ? T[K] : T)
// }[keyof T];

interface WithMetadata {
  metadata?: Metadata;
}
type WithoutMetadata<T extends WithMetadata> = Omit<T, "metadata">;

type SingleKey<T> = {
  [K in keyof T]: (Pick<T, K> extends T ? K : never);
}[keyof T];
type IfSingleThenValue<T> = T extends Record<SingleKey<T>, infer U> ? U : T;

function removeMetadata<T extends object & WithMetadata>(
  response: T,
): WithoutMetadata<T> {
  const { metadata, ...rest } = response;
  return rest;
}

function extractSingleValue<T extends object & WithMetadata>(response: T) {
  const rest = removeMetadata(response);
  const keys = Object.keys(rest) as Array<keyof WithoutMetadata<T>>;
  return rest[keys[0]];
}

export class ResponseHandler<T extends object & WithMetadata, U, V, W> {
  #getFunction;
  #setFunction;
  #pickFunction;
  constructor(
    getFunction: (request: GetRequest) => Promise<T>,
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
  async gett() {
    const response = await this.get(0);
    return this.#pickFunction(response);
  }
}

interface CommandOptions extends Omit<StartCommandRequest, "command"> {
  waitForCompletion?: boolean;
}

export class KachakaApiClient {
  #client: GrpcClient & KachakaApi;
  #nameResolver = new ShelfLocationResolver();
  robotSerialNumber;
  robotVersion;
  robotPose;
  pngMap;
  objectDetection;
  rosImu;
  rosOdometry;
  rosLaserScan;
  frontCameraRosCameraInfo;
  frontCameraRosImage;
  frontCameraRosCompressedImage;
  commandState;
  lastCommandResult;
  locations;
  shelves;
  autoHomingEnabled;
  manualControlEnabled;
  robotVelocity;
  historyList;

  constructor(hostname: string, protoFile: string) {
    this.#client = getClient<KachakaApi>({
      hostname: hostname,
      port: 26400,
      root: protoFile,
      serviceName: "KachakaApi",
    });
    this.robotSerialNumber = new ResponseHandler(
      this.#client.GetRobotSerialNumber,
      extractSingleValue,
    );
    this.robotVersion = new ResponseHandler(
      this.#client.GetRobotVersion,
      extractSingleValue,
    );
    this.robotPose = new ResponseHandler(
      this.#client.GetRobotPose,
      extractSingleValue,
    );
    this.pngMap = new ResponseHandler(
      this.#client.GetPngMap,
      extractSingleValue,
    );
    this.objectDetection = new ResponseHandler(
      this.#client.GetObjectDetection,
      removeMetadata,
    );
    this.rosImu = new ResponseHandler(
      this.#client.GetRosImu,
      extractSingleValue,
    );
    this.rosOdometry = new ResponseHandler(
      this.#client.GetRosOdometry,
      extractSingleValue,
    );
    this.rosLaserScan = new ResponseHandler(
      this.#client.GetRosLaserScan,
      extractSingleValue,
    );
    this.frontCameraRosCameraInfo = new ResponseHandler(
      this.#client.GetFrontCameraRosCameraInfo,
      extractSingleValue,
    );
    this.frontCameraRosImage = new ResponseHandler(
      this.#client.GetFrontCameraRosImage,
      extractSingleValue,
    );
    this.frontCameraRosCompressedImage = new ResponseHandler(
      this.#client.GetFrontCameraRosCompressedImage,
      extractSingleValue,
    );
    this.commandState = new ResponseHandler(
      this.#client.GetCommandState,
      removeMetadata,
    );
    this.lastCommandResult = new ResponseHandler(
      this.#client.GetLastCommandResult,
      removeMetadata,
    );
    this.locations = new ResponseHandler(
      this.#client.GetLocations,
      (response) => response.locations,
    );
    this.shelves = new ResponseHandler(
      this.#client.GetShelves,
      extractSingleValue,
    );
    this.autoHomingEnabled = new ResponseHandler(
      this.#client.GetAutoHomingEnabled,
      extractSingleValue,
      (enable: boolean) =>
        this.#client.SetAutoHomingEnabled({ enable: enable }),
    );
    this.manualControlEnabled = new ResponseHandler(
      this.#client.GetManualControlEnabled,
      extractSingleValue,
      (enable: boolean) =>
        this.#client.SetAutoHomingEnabled({ enable: enable }),
    );
    this.robotVelocity = new ResponseHandler(
      async (request) => {
        const { metadata, odometry } = await this.#client.GetRosOdometry(
          request,
        );
        const { linear, angular } = odometry!.twist!.twist!;
        return { metadata: metadata, linear: linear!.x, angular: angular!.z };
      },
      removeMetadata,
      this.#client.SetRobotVelocity,
    );
    this.historyList = new ResponseHandler(
      this.#client.GetHistoryList,
      extractSingleValue,
    );
  }

  destructor() {
    this.#client.close();
  }

  client() {
    return this.#client;
  }

  async updateResolver() {
    const [shelves, locations] = await Promise.all([
      this.shelves.get(),
      this.locations.get(),
    ]);
    this.#nameResolver.shelves = shelves!;
    this.#nameResolver.locations = locations!;
  }

  static async create(hostname: string) {
    const protoPath = new URL("./protos/kachaka-api.proto", import.meta.url);
    const protoFile = await Deno.readTextFile(protoPath);
    const client = new KachakaApiClient(hostname, protoFile);
    await client.updateResolver();
    return client;
  }

  close() {
    return this.#client.close();
  }

  async startCommand(
    request: StartCommandRequest,
    options: CommandOptions = {},
  ): Promise<Result> {
    const { waitForCompletion = true } = options;
    let { cursor } = (await this.commandState.get(0)).metadata!;
    request.cancelAll = options.cancelAll;
    request.ttsOnSuccess = options.ttsOnSuccess;
    request.title = options.title;
    const { result } = await this.#client.StartCommand(request);
    if (!result!.success || !waitForCompletion) {
      return result!;
    }
    while (true) {
      const { metadata, state } = await this.commandState.get(cursor!);
      // FIXME
      if (state === 1) break;
      cursor = metadata!.cursor;
    }
    return (await this.lastCommandResult.get()).result!;
  }

  moveShelf(
    shelf: string,
    location: string,
    options?: CommandOptions,
  ): Promise<Result> {
    const shelfId = this.#nameResolver.shelfId(shelf);
    const locationId = this.#nameResolver.locationId(location);
    return this.startCommand(
      {
        command: {
          moveShelfCommand: {
            targetShelfId: shelfId,
            destinationLocationId: locationId,
          },
        },
      },
      options,
    );
  }

  returnShelf(shelf: string, options?: CommandOptions) {
    const shelfId = this.#nameResolver.shelfId(shelf);
    return this.startCommand(
      { command: { returnShelfCommand: { targetShelfId: shelfId } } },
      options,
    );
  }

  undockShelf(options?: CommandOptions) {
    return this.startCommand(
      { command: { undockShelfCommand: {} } },
      options,
    );
  }

  moveToLocation(
    location: string,
    options?: CommandOptions,
  ): Promise<Result> {
    const locationId = this.#nameResolver.locationId(location);
    return this.startCommand({
      command: { moveToLocationCommand: { targetLocationId: locationId } },
    }, options);
  }

  returnHome(options?: CommandOptions) {
    return this.startCommand(
      { command: { returnHomeCommand: {} } },
      options,
    );
  }

  dockShelf(options?: CommandOptions) {
    return this.startCommand(
      { command: { dockShelfCommand: {} } },
      options,
    );
  }

  speak(text: string, options?: CommandOptions): Promise<Result> {
    return this.startCommand(
      { command: { speakCommand: { text: text } } },
      options,
    );
  }

  moveToPose(pose: Pose, options?: CommandOptions) {
    return this.startCommand(
      {
        command: {
          moveToPoseCommand: { x: pose.x, y: pose.y, yaw: pose.theta },
        },
      },
      options,
    );
  }
}
