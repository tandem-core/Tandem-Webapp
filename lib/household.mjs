// Owner and trusted helpers. A fixture for now; becomes the owner's contacts
// once there are accounts.
import { readFile } from "node:fs/promises";

export async function getHousehold() {
  return JSON.parse(await readFile("fixtures/household.json", "utf8"));
}

export async function getHelper(id) {
  const { helpers } = await getHousehold();
  return helpers.find((h) => h.id === id) ?? null;
}
