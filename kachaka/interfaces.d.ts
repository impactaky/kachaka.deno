import { pb } from "../deps.ts";

export interface WithMetadata {
  metadata?: pb.Metadata;
}

export type WithoutMetadata<T extends WithMetadata> = Omit<T, "metadata">;

