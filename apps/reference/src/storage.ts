import { File, Paths } from "expo-file-system";

import { parseProject } from "./project";
import { chooseSavedText, PROJECT_BACKUP, PROJECT_FILE, saveWithBackup, type ProjectStore } from "./projectStore";

function file(name: string): File {
  return new File(Paths.document, name);
}

const expoStore: ProjectStore = {
  async exists(name) {
    return file(name).exists;
  },
  async read(name) {
    const item = file(name);
    if (!item.exists) return null;
    return item.text();
  },
  async write(name, text) {
    const item = file(name);
    if (!item.exists) item.create();
    await item.write(text);
  },
  async move(from, to) {
    const source = file(from);
    const destination = file(to);
    if (destination.exists) destination.delete();
    await source.move(destination);
  },
  async remove(name) {
    const item = file(name);
    if (item.exists) item.delete();
  },
};

export async function writeProject(json: string): Promise<void> {
  await saveWithBackup(expoStore, json);
}

export async function readProject(): Promise<string | null> {
  const main = await expoStore.read(PROJECT_FILE);
  const backup = await expoStore.read(PROJECT_BACKUP);
  return chooseSavedText(main, backup, (text) => parseProject(text).ok);
}
