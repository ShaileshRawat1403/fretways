export const PROJECT_FILE = "fretways-project.json";
export const PROJECT_TEMP = "fretways-project.json.tmp";
export const PROJECT_BACKUP = "fretways-project.json.bak";

export type ProjectStore = {
  exists(name: string): Promise<boolean>;
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  remove(name: string): Promise<void>;
};

export async function saveWithBackup(store: ProjectStore, json: string): Promise<void> {
  await store.write(PROJECT_TEMP, json);
  if (await store.exists(PROJECT_BACKUP)) await store.remove(PROJECT_BACKUP);
  if (await store.exists(PROJECT_FILE)) await store.move(PROJECT_FILE, PROJECT_BACKUP);
  try {
    await store.move(PROJECT_TEMP, PROJECT_FILE);
  } catch (error) {
    if ((await store.exists(PROJECT_BACKUP)) && !(await store.exists(PROJECT_FILE))) {
      await store.move(PROJECT_BACKUP, PROJECT_FILE);
    }
    throw error;
  }
}

export function chooseSavedText(main: string | null, backup: string | null, readable: (text: string) => boolean): string | null {
  if (main && readable(main)) return main;
  if (backup && readable(backup)) return backup;
  return main ?? backup;
}
