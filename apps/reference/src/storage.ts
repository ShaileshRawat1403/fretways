import { File, Paths } from "expo-file-system";

const FILE_NAME = "fretways-project.json";

function projectFile(): File {
  return new File(Paths.document, FILE_NAME);
}

export async function writeProject(json: string): Promise<void> {
  const file = projectFile();
  if (!file.exists) file.create();
  await file.write(json);
}

export async function readProject(): Promise<string | null> {
  const file = projectFile();
  if (!file.exists) return null;
  return file.text();
}
