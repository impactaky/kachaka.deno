import { GrpcServer } from "./deps.ts";
import { pb } from "../deps.ts";
import EventEmitter from "https://deno.land/x/events/mod.ts";
import { dirname, fromFileUrl } from "https://deno.land/std/path/mod.ts";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));

const port = 26400;
const server = new GrpcServer();

const protoPath = new URL("../protos/kachaka-api.proto", import.meta.url);
const protoFile = await Deno.readTextFile(protoPath);

interface WithMetadata {
  metadata?: pb.Metadata;
}

class ResponseStore<T extends WithMetadata> extends EventEmitter {
  #value: T;
  constructor(v: T) {
    super();
    this.#value = v;
    this.#value.metadata = this.genMetadata();
  }
  genMetadata(): pb.Metadata {
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
  async waitForCursor(request: pb.GetRequest): Promise<T> {
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
      return this.#value;
    }
    return await arrived;
  }
}

function errorCommandResult(errorCode: number): pb.StartCommandResponse {
  return { result: { success: false, errorCode: errorCode }, commandId: "xxxx" };
}

async function createFromJson<T>(path: string): Promise<T> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

class KachakaApiImpl implements pb.KachakaApi {
  #robotSerialNumber = new ResponseStore<pb.GetRobotSerialNumberResponse>({serialNumber: "XXX12345"});
  GetRobotSerialNumber = (request: pb.GetRequest) => this.#robotSerialNumber.waitForCursor(request);
  #robotVersion = new ResponseStore<pb.GetRobotVersionResponse>({version: "2.1.0"});
  GetRobotVersion = (request: pb.GetRequest) => this.#robotVersion.waitForCursor(request);
  #robotPose;
  GetRobotPose = (request: pb.GetRequest) => this.#robotPose.waitForCursor(request);
  #pngMap = new ResponseStore<pb.GetPngMapResponse>({});
  GetPngMap = (request: pb.GetRequest) => this.#pngMap.waitForCursor(request);
  #objectDetection = new ResponseStore<pb.GetObjectDetectionResponse>({});
  GetObjectDetection = (request: pb.GetRequest) => this.#objectDetection.waitForCursor(request);
  #rosImu = new ResponseStore<pb.GetRosImuResponse>({});
  GetRosImu = (request: pb.GetRequest) => this.#rosImu.waitForCursor(request);
  #rosOdometry = new ResponseStore<pb.GetRosOdometryResponse>({});
  GetRosOdometry = (request: pb.GetRequest) => this.#rosOdometry.waitForCursor(request);
  #rosLaserScan = new ResponseStore<pb.GetRosLaserScanResponse>({});
  GetRosLaserScan = (request: pb.GetRequest) => this.#rosLaserScan.waitForCursor(request);
  #frontCameraRosCameraInfo = new ResponseStore<pb.GetFrontCameraRosCameraInfoResponse>({});
  GetFrontCameraRosCameraInfo = (request: pb.GetRequest) => this.#frontCameraRosCameraInfo.waitForCursor(request);
  #frontCameraRosImage = new ResponseStore<pb.GetFrontCameraRosImageResponse>({});
  GetFrontCameraRosImage = (request: pb.GetRequest) => this.#frontCameraRosImage.waitForCursor(request);
  #frontCameraRosCompressedImage = new ResponseStore<pb.GetFrontCameraRosCompressedImageResponse>({});
  GetFrontCameraRosCompressedImage = (request: pb.GetRequest) => this.#frontCameraRosCompressedImage.waitForCursor(request);
  StartCommand = async (request: pb.StartCommandRequest): Promise<pb.StartCommandResponse> => {
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
  #commandState = new ResponseStore<pb.GetCommandStateResponse>({});
  GetCommandState = (request: pb.GetRequest) => this.#commandState.waitForCursor(request);
  #lastCommandResult = new ResponseStore<pb.GetLastCommandResultResponse>({});
  GetLastCommandResult = (request: pb.GetRequest) => this.#lastCommandResult.waitForCursor(request);
  #locations;
  GetLocations = (request: pb.GetRequest) => this.#locations.waitForCursor(request);
  #shelves;
  GetShelves = (request: pb.GetRequest) => this.#shelves.waitForCursor(request);
  #autoHomingEnabled = new ResponseStore<pb.GetAutoHomingEnabledResponse>({});
  SetAutoHomingEnabled = (request: pb.SetAutoHomingEnabledRequest): Promise<pb.SetAutoHomingEnabledResponse> => {
    this.#autoHomingEnabled.value = {enabled: request.enable!};
    return Promise.resolve({result: {success: true}});
  }
  GetAutoHomingEnabled = (request: pb.GetRequest) => this.#autoHomingEnabled.waitForCursor(request);
  #manualControlEnabled = new ResponseStore<pb.GetManualControlEnabledResponse>({});
  SetManualControlEnabled = (request: pb.SetManualControlEnabledRequest): Promise<pb.SetManualControlEnabledResponse> => {
    this.#manualControlEnabled.value = {enabled: request.enable!};
    return Promise.resolve({result: {success: true}});
  }
  GetManualControlEnabled = (request: pb.GetRequest) => this.#manualControlEnabled.waitForCursor(request);
  // SetRobotVelocity(request: SetRobotVelocityRequest): Promise<SetRobotVelocityResponse>;
  #historyList = new ResponseStore<pb.GetHistoryListResponse>({});
  GetHistoryList = (request: pb.GetRequest) => this.#historyList.waitForCursor(request);
  // #staticTransform = new ResponseStore<pb.GetStaticTransformResponse>({});
  // GetStaticTransform = (request: pb.GetRequest) => this.#staticTransform.waitForCursor(request);
  // #dynamicTransform = new ResponseStore<pb.GetDynamicTransformResponse>({});
  // GetDynamicTransform = (request: EmptyRequest) => this.#dynamicTransform.waitForCursor(request);
  constructor(
    locations: pb.GetLocationsResponse,
    pose: pb.GetRobotPoseResponse,
    shelves: pb.GetShelvesResponse
  ) {
    this.#shelves = new ResponseStore<pb.GetShelvesResponse>(shelves);
    this.#robotPose = new ResponseStore<pb.GetRobotPoseResponse>(pose);
    this.#locations = new ResponseStore<pb.GetLocationsResponse>(locations);
  }
}

const [
  locations,
  pose,
  shelves,
] = await Promise.all([
  createFromJson<pb.GetLocationsResponse>(`${SCRIPT_DIR}/default_value/locations.json`),
  createFromJson<pb.GetRobotPoseResponse>(`${SCRIPT_DIR}/default_value/pose.json`),
  createFromJson<pb.GetShelvesResponse>(`${SCRIPT_DIR}/default_value/shelves.json`),
]);
const mock = new KachakaApiImpl(
  locations,
  pose,
  shelves
);
server.addService<KachakaApiImpl>(protoFile, mock);

console.log(`gonna listen on ${port} port`);
for await (const conn of Deno.listen({ port })) {
  server.handle(conn);
}
