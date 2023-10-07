import { getClient, GrpcClient, pb, sleep } from "./deps.ts";
import { ShelfLocationResolver } from "./kachaka/layout.ts";
import { fetchText } from "./util/util.ts";
export * from "./protos/kachaka-api.d.ts";

// interface KachakaClientOption {
// }

interface WithMetadata {
  metadata?: pb.Metadata;
}
type WithoutMetadata<T extends WithMetadata> = Omit<T, "metadata">;

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

export class ValueHandler<T extends object & WithMetadata, U, V, W> {
  #getFunction;
  #setFunction;
  #pickFunction;
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
  async gett() {
    const response = await this.get(0);
    return this.#pickFunction(response);
  }
}

interface CommandOptions extends Omit<pb.StartCommandRequest, "command"> {
  waitForCompletion?: boolean;
}

export class KachakaApiClient {
  #client: GrpcClient & pb.KachakaApi;
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
    this.#client = getClient<pb.KachakaApi>({
      hostname: hostname,
      port: 26400,
      root: protoFile,
      serviceName: "KachakaApi",
    });
    this.robotSerialNumber = new ValueHandler(
      this.#client.GetRobotSerialNumber,
      extractSingleValue,
    );
    this.robotVersion = new ValueHandler(
      this.#client.GetRobotVersion,
      extractSingleValue,
    );
    this.robotPose = new ValueHandler(
      this.#client.GetRobotPose,
      extractSingleValue,
    );
    this.pngMap = new ValueHandler(
      this.#client.GetPngMap,
      extractSingleValue,
    );
    this.objectDetection = new ValueHandler(
      this.#client.GetObjectDetection,
      removeMetadata,
    );
    this.rosImu = new ValueHandler(
      this.#client.GetRosImu,
      extractSingleValue,
    );
    this.rosOdometry = new ValueHandler(
      this.#client.GetRosOdometry,
      extractSingleValue,
    );
    this.rosLaserScan = new ValueHandler(
      this.#client.GetRosLaserScan,
      extractSingleValue,
    );
    this.frontCameraRosCameraInfo = new ValueHandler(
      this.#client.GetFrontCameraRosCameraInfo,
      extractSingleValue,
    );
    this.frontCameraRosImage = new ValueHandler(
      this.#client.GetFrontCameraRosImage,
      extractSingleValue,
    );
    this.frontCameraRosCompressedImage = new ValueHandler(
      this.#client.GetFrontCameraRosCompressedImage,
      extractSingleValue,
    );
    this.commandState = new ValueHandler(
      this.#client.GetCommandState,
      removeMetadata,
    );
    this.lastCommandResult = new ValueHandler(
      this.#client.GetLastCommandResult,
      removeMetadata,
    );
    this.locations = new ValueHandler(
      this.#client.GetLocations,
      (response) => response.locations,
    );
    this.shelves = new ValueHandler(
      this.#client.GetShelves,
      extractSingleValue,
    );
    this.autoHomingEnabled = new ValueHandler(
      this.#client.GetAutoHomingEnabled,
      extractSingleValue,
      (enable: boolean) =>
        this.#client.SetAutoHomingEnabled({ enable: enable }),
    );
    this.manualControlEnabled = new ValueHandler(
      this.#client.GetManualControlEnabled,
      extractSingleValue,
      (enable: boolean) =>
        this.#client.SetAutoHomingEnabled({ enable: enable }),
    );
    this.robotVelocity = new ValueHandler(
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
    this.historyList = new ValueHandler(
      this.#client.GetHistoryList,
      extractSingleValue,
    );
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
    const protoFile = await fetchText(
      new URL("./protos/kachaka-api.proto", import.meta.url),
    );
    const client = new KachakaApiClient(hostname, protoFile);
    await client.updateResolver();
    return client;
  }

  async close() {
    this.#client.close();
    // Workaround for timeout
    await sleep(0.1);
  }

  async startCommand(
    request: pb.StartCommandRequest,
    options: CommandOptions = {},
  ): Promise<pb.Result> {
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
  ) {
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
  ) {
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

  speak(text: string, options?: CommandOptions) {
    return this.startCommand(
      { command: { speakCommand: { text: text } } },
      options,
    );
  }

  moveToPose(pose: pb.Pose, options?: CommandOptions) {
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
