import {
  assertExists,
  assertStrictEquals,
} from "https://deno.land/std/testing/asserts.ts";
import { KachakaApiClient } from "../mod.ts";
import { pb } from "../deps.ts";
import { fetchText } from "../util/util.ts";

async function createFromJson<T>(path: string): Promise<T> {
  const content = await fetchText(new URL(path, import.meta.url));
  return JSON.parse(content);
}

interface Indexable {
  [key: string]: any;
}

function assertCompareResponse<T extends Indexable | undefined>(
  lhs: T,
  rhs: T,
) {
  assertExists(lhs);
  assertExists(rhs);
  return Object.keys(lhs).every((key) =>
    assertStrictEquals(lhs[key], rhs[key])
  );
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

Deno.test("robotPose.get", async () => {
  const client = await KachakaApiClient.create("127.0.0.1");
  const v = await client.robotPose.get();
  const { pose } = await createFromJson<pb.GetRobotPoseResponse>(
    "../mock/default_value/pose.json",
  );
  assertCompareResponse(v, pose);
  await client.close();
});
