import { assertStrictEquals } from "https://deno.land/std/testing/asserts.ts";
import { KachakaApiClient } from "../mod.ts";
import { pb } from "../deps.ts";

async function createFromJson<T>(path: string): Promise<T> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

Deno.test("robotSerialNumber.get", async () => {
  const client = await KachakaApiClient.create("127.0.0.1");
  const v = await client.robotSerialNumber.get(); 
  assertStrictEquals(v, "XXX12345");
  await client.close();
});

Deno.test("robotVersion.get", async () => {
  const client = await KachakaApiClient.create("127.0.0.1");
  const v = await client.robotVersion.get(); 
  assertStrictEquals(v, "2.1.0");
  await client.close();
});

// Deno.test("robotPose.get", async () => {
//   const client = await KachakaApiClient.create("127.0.0.1");
//   const v = await client.robotPose.get(); 
//   const pose: pb.GetRobotPoseResponse = (await createFromJson<pb.GetRobotPoseResponse>("./mock/default_value/pose.json")).pose;
//   assertStrictEquals(v, pose);
//   client.close();
// });

