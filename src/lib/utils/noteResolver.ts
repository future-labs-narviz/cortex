import type { VaultFile } from "@/lib/types";

/**
 * Flatten a nested VaultFile tree into a flat array of non-directory files.
 */
export function flattenFiles(files: VaultFile[]): VaultFile[] {
  const result: VaultFile[] = [];
  for (const file of files) {
    if (!file.is_dir) {
      result.push(file);
    }
    if (file.children) {
      result.push(...flattenFiles(file.children));
    }
  }
  return result;
}

/**
 * Find a note by name (case-insensitive, .md extension optional).
 * Returns the first match from a flat search of the file tree.
 */
export function findNoteByName(
  files: VaultFile[],
  name: string,
): VaultFile | null {
  const normalized = name.toLowerCase().replace(/\.md$/, "");
  const flat = flattenFiles(files);

  for (const file of flat) {
    const fileName = file.name.toLowerCase().replace(/\.md$/, "");
    if (fileName === normalized) {
      return file;
    }
  }

  return null;
}
