import { pb } from "../deps.ts";

export class ShelfLocationResolver {
  constructor(
    public locations: pb.Location[] = [],
    public shelves: pb.Shelf[] = [],
  ) {}

  shelfName(id: string) {
    for (const shelf of this.shelves) {
      if (shelf.id === id) return shelf.name;
    }
    return id;
  }

  shelfId(name: string) {
    for (const shelf of this.shelves) {
      if (shelf.name === name) return shelf.id;
    }
    return name;
  }

  locationName(id: string) {
    for (const location of this.locations) {
      if (location.id === id) return location.name;
    }
    return id;
  }

  locationId(name: string) {
    for (const location of this.locations) {
      if (location.name === name) return location.id;
    }
    return name;
  }
}
