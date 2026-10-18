import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chooseSavedText, PROJECT_BACKUP, PROJECT_FILE, PROJECT_TEMP, saveWithBackup, type ProjectStore } from "../src/projectStore";

function memoryStore(): ProjectStore & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    async exists(name) {
      return files.has(name);
    },
    async read(name) {
      return files.get(name) ?? null;
    },
    async write(name, text) {
      files.set(name, text);
    },
    async move(from, to) {
      const text = files.get(from);
      if (text == null) throw new Error(`Missing ${from}.`);
      if (files.has(to)) throw new Error(`${to} already exists.`);
      files.set(to, text);
      files.delete(from);
    },
    async remove(name) {
      files.delete(name);
    },
  };
}

describe("project backup", () => {
  it("leaves the current file alone when the temporary write fails", async () => {
    const store = memoryStore();
    store.files.set(PROJECT_FILE, "old");
    store.write = async (name) => {
      if (name === PROJECT_TEMP) throw new Error("disk");
    };
    await assert.rejects(() => saveWithBackup(store, "new"));
    assert.equal(store.files.get(PROJECT_FILE), "old");
    assert.equal(store.files.has(PROJECT_BACKUP), false);
  });

  it("restores the backup when the final move fails", async () => {
    const store = memoryStore();
    store.files.set(PROJECT_FILE, "old");
    const move = store.move.bind(store);
    let movedToMain = 0;
    store.move = async (from, to) => {
      if (to === PROJECT_FILE) {
        movedToMain += 1;
        if (movedToMain === 1) throw new Error("move");
      }
      await move(from, to);
    };
    await assert.rejects(() => saveWithBackup(store, "new"));
    assert.equal(store.files.get(PROJECT_FILE), "old");
  });

  it("replaces the project and prefers a readable backup when the main file is corrupt", async () => {
    const store = memoryStore();
    store.files.set(PROJECT_FILE, "old");
    await saveWithBackup(store, "new");
    assert.equal(store.files.get(PROJECT_FILE), "new");
    assert.equal(store.files.get(PROJECT_BACKUP), "old");
    assert.equal(store.files.has(PROJECT_TEMP), false);
    assert.equal(chooseSavedText("{", "good", (text) => text === "good"), "good");
  });
});
