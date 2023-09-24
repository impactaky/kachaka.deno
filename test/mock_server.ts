import { GrpcServer } from "./deps.ts";
import {
    CancelCommandResponse,
    GetAutoHomingEnabledResponse,
    GetCommandStateResponse,
    GetDynamicTransformResponse,
    GetFrontCameraRosCameraInfoResponse,
    GetFrontCameraRosCompressedImageResponse,
    GetFrontCameraRosImageResponse,
    GetHistoryListResponse,
    GetLastCommandResultResponse,
    GetLocationsResponse,
    GetManualControlEnabledResponse,
    GetObjectDetectionResponse,
    GetPngMapResponse,
    GetRequest,
    GetRobotPoseResponse,
    GetRobotSerialNumberResponse,
    GetRobotVersionResponse,
    GetRosImuResponse,
    GetRosLaserScanResponse,
    GetRosOdometryResponse,
    GetShelvesResponse,
    GetStaticTransformResponse,
    KachakaApi,
    Metadata,
    SetAutoHomingEnabledRequest,
    SetAutoHomingEnabledResponse,
    SetManualControlEnabledResponse,
    SetRobotVelocityResponse,
    StartCommandResponse,
    StartCommandRequest,
    EmptyRequest,
    Result,
} from "../protos/kachaka-api.d.ts";
import EventEmitter from "https://deno.land/x/events/mod.ts";

const port = 26400;
const server = new GrpcServer();

const protoPath = new URL("../protos/kachaka-api.proto", import.meta.url);
const protoFile = await Deno.readTextFile(protoPath);

interface WithMetadata {
  metadata?: Metadata;
}

class ResponseStore<T extends WithMetadata> extends EventEmitter {
  #value: T;
  constructor(v: T) {
    super();
    this.#value = v;
    this.#value.metadata = this.genMetadata();
  }
  genMetadata(): Metadata {
    return {cursor: Date.now()};
  }
  set value(v: T) {
    this.#value = v;
    this.#value.metadata = this.genMetadata();
    this.emit("change", v);
  }
  get value() {
    return this.#value;
  }
  async waitForCursor(request: GetRequest): Promise<T> {
    console.log(request);
    const arrived: Promise<T> = new Promise((resolve) => {
      const listener = (value: T) => {
        if (value.metadata!.cursor! > request.metadata!.cursor!) {
          this.off("change", listener);
          resolve(value);
        }
      };
      this.on("data", listener);
    });
    if (this.#value.metadata!.cursor! > request.metadata!.cursor!) {
      console.log(this.value);
      return this.#value;
    }
    return await arrived;
  }
}

function errorCommandResult(errorCode: number): StartCommandResponse {
  return { result: { success: false, errorCode: errorCode }, commandId: "xxxx" };
}

async function createFromJson<T>(path: string): Promise<T> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

class KachakaApiImpl implements KachakaApi {
  #robotSerialNumber = new ResponseStore<GetRobotSerialNumberResponse>({serialNumber: "XXX12345"});
  GetRobotSerialNumber = (request: GetRequest) => this.#robotSerialNumber.waitForCursor(request);
  #robotVersion = new ResponseStore<GetRobotVersionResponse>({version: "2.1.0"});
  GetRobotVersion = (request: GetRequest) => this.#robotVersion.waitForCursor(request);
  #robotPose = new ResponseStore<GetRobotPoseResponse>({pose: {x: 0, y:0, theta:0}});
  GetRobotPose = (request: GetRequest) => this.#robotPose.waitForCursor(request);
  #pngMap = new ResponseStore<GetPngMapResponse>({});
  GetPngMap = (request: GetRequest) => this.#pngMap.waitForCursor(request);
  #objectDetection = new ResponseStore<GetObjectDetectionResponse>({});
  GetObjectDetection = (request: GetRequest) => this.#objectDetection.waitForCursor(request);
  #rosImu = new ResponseStore<GetRosImuResponse>({});
  GetRosImu = (request: GetRequest) => this.#rosImu.waitForCursor(request);
  #rosOdometry = new ResponseStore<GetRosOdometryResponse>({});
  GetRosOdometry = (request: GetRequest) => this.#rosOdometry.waitForCursor(request);
  #rosLaserScan = new ResponseStore<GetRosLaserScanResponse>({});
  GetRosLaserScan = (request: GetRequest) => this.#rosLaserScan.waitForCursor(request);
  #frontCameraRosCameraInfo = new ResponseStore<GetFrontCameraRosCameraInfoResponse>({});
  GetFrontCameraRosCameraInfo = (request: GetRequest) => this.#frontCameraRosCameraInfo.waitForCursor(request);
  #frontCameraRosImage = new ResponseStore<GetFrontCameraRosImageResponse>({});
  GetFrontCameraRosImage = (request: GetRequest) => this.#frontCameraRosImage.waitForCursor(request);
  #frontCameraRosCompressedImage = new ResponseStore<GetFrontCameraRosCompressedImageResponse>({});
  GetFrontCameraRosCompressedImage = (request: GetRequest) => this.#frontCameraRosCompressedImage.waitForCursor(request);
  StartCommand = async (request: StartCommandRequest): Promise<StartCommandResponse> => {
    if (request.command!.moveShelfCommand) {
      const {targetShelfId, destinationLocationId} = request.command!.moveShelfCommand!
      if (!targetShelfId) return errorCommandResult(10250);
      if (!destinationLocationId) return errorCommandResult(10251);
    }
    else if (request.command!.returnShelfCommand) {
    }
    else if (request.command!.undockShelfCommand) {
    }
    else if (request.command!.moveToLocationCommand) {
    }
    else if (request.command!.returnHomeCommand) {
    }
    else if (request.command!.dockShelfCommand) {
    }
    else if (request.command!.speakCommand) {
    }
    else if (request.command!.moveToPoseCommand) {
    }
    else {
      return { result: {} };
    }
    return { result: { success: true } };
  }
  // CancelCommand(request: EmptyRequest): Promise<CancelCommandResponse>;
  #commandState = new ResponseStore<GetCommandStateResponse>({});
  GetCommandState = (request: GetRequest) => this.#commandState.waitForCursor(request);
  #lastCommandResult = new ResponseStore<GetLastCommandResultResponse>({});
  GetLastCommandResult = (request: GetRequest) => this.#lastCommandResult.waitForCursor(request);
  #locations = new ResponseStore<GetLocationsResponse>({});
  GetLocations = (request: GetRequest) => this.#locations.waitForCursor(request);
  #shelves;
  GetShelves = (request: GetRequest) => this.#shelves.waitForCursor(request);
  SetAutoHomingEnabled = (request: SetAutoHomingEnabledRequest): Promise<SetAutoHomingEnabledResponse> => {
    this.#autoHomingEnabled.value = {enabled: request.enable!};
    return Promise.resolve({result: {success: true}});
  }
  #autoHomingEnabled = new ResponseStore<GetAutoHomingEnabledResponse>({});
  GetAutoHomingEnabled = (request: GetRequest) => this.#autoHomingEnabled.waitForCursor(request);
  // SetManualControlEnabled(request: SetManualControlEnabledRequest): Promise<SetManualControlEnabledResponse>;
  #manualControlEnabled = new ResponseStore<GetManualControlEnabledResponse>({});
  GetManualControlEnabled = (request: GetRequest) => this.#manualControlEnabled.waitForCursor(request);
  // SetRobotVelocity(request: SetRobotVelocityRequest): Promise<SetRobotVelocityResponse>;
  #historyList = new ResponseStore<GetHistoryListResponse>({});
  GetHistoryList = (request: GetRequest) => this.#historyList.waitForCursor(request);
  // #staticTransform = new ResponseStore<GetStaticTransformResponse>({});
  // GetStaticTransform = (request: GetRequest) => this.#staticTransform.waitForCursor(request);
  // #dynamicTransform = new ResponseStore<GetDynamicTransformResponse>({});
  // GetDynamicTransform = (request: EmptyRequest) => this.#dynamicTransform.waitForCursor(request);
  constructor(shelves: GetShelvesResponse) {
    this.#shelves = new ResponseStore<GetShelvesResponse>(shelves);
  }
}

const [shelves] = await Promise.all([
  createFromJson<GetShelvesResponse>("./shelves.json"),
]);
const mock = new KachakaApiImpl(shelves);
server.addService<KachakaApiImpl>(protoFile, mock);

console.log(`gonna listen on ${port} port`);
for await (const conn of Deno.listen({ port })) {
  server.handle(conn);
}
