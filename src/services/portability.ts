import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import JSZip from 'jszip';
import { Platform } from 'react-native';

import { listProjects, readFileContent, writeFileContent, WorkspaceNode } from './workspace';

type ImportedItem = {
  name: string;
  path: string;
};

function splitName(name: string) {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) {
    return {
      stem: name,
      extension: '',
    };
  }

  return {
    stem: name.slice(0, lastDot),
    extension: name.slice(lastDot),
  };
}

function joinRelativePath(...parts: string[]) {
  return parts
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function pathExists(nodes: WorkspaceNode[], targetPath: string): boolean {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return true;
    }

    if (node.children && pathExists(node.children, targetPath)) {
      return true;
    }
  }

  return false;
}

async function getUniqueDestinationPath(projectName: string, destinationFolderPath: string, fileName: string) {
  const projects = await listProjects();
  const project = projects.find((item) => item.name === projectName);
  const basePath = joinRelativePath(destinationFolderPath, fileName);

  if (!project || !pathExists(project.files, basePath)) {
    return basePath;
  }

  const { stem, extension } = splitName(fileName);
  let counter = 1;
  let nextPath = basePath;

  while (project && pathExists(project.files, nextPath)) {
    nextPath = joinRelativePath(destinationFolderPath, `${stem}-${counter}${extension}`);
    counter += 1;
  }

  return nextPath;
}

function collectFilePaths(nodes: WorkspaceNode[], results: string[] = []) {
  for (const node of nodes) {
    if (node.type === 'file') {
      results.push(node.path);
      continue;
    }

    if (node.children) {
      collectFilePaths(node.children, results);
    }
  }

  return results;
}

export async function importDocumentsIntoProject(projectName: string, destinationFolderPath: string) {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: '*/*',
  });

  if (result.canceled) {
    return [] as ImportedItem[];
  }

  const imported: ImportedItem[] = [];

  for (const asset of result.assets) {
    const nextPath = await getUniqueDestinationPath(projectName, destinationFolderPath, asset.name);

    if (Platform.OS === 'web') {
      if (!asset.file) {
        throw new Error(`The browser did not expose file data for ${asset.name}.`);
      }

      const content = await asset.file.text();
      await writeFileContent(projectName, nextPath, content);
      imported.push({ name: asset.name, path: nextPath });
      continue;
    }

    const sourceFile = new File(asset.uri);
    const destinationFile = new File(Paths.document, 'root-workspace', projectName, ...nextPath.split('/').filter(Boolean));
    destinationFile.parentDirectory.create({ idempotent: true, intermediates: true });
    sourceFile.copy(destinationFile);
    imported.push({ name: asset.name, path: nextPath });
  }

  return imported;
}

export async function exportProjectFile(projectName: string, path: string) {
  const relativePath = joinRelativePath(path);
  if (!relativePath) {
    throw new Error('Select a file first.');
  }

  if (Platform.OS === 'web') {
    const content = await readFileContent(projectName, relativePath);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = relativePath.split('/').pop() ?? 'workspace-file.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
    return;
  }

  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(Paths.document, 'root-workspace', projectName, ...relativePath.split('/').filter(Boolean));
  if (!file.exists) {
    throw new Error('The selected file no longer exists.');
  }

  await Sharing.shareAsync(file.uri);
}

export async function exportProjectArchive(projectName: string) {
  const projects = await listProjects();
  const project = projects.find((item) => item.name === projectName);
  if (!project) {
    throw new Error('Project no longer exists.');
  }

  const zip = new JSZip();
  const filePaths = collectFilePaths(project.files);
  if (!filePaths.length) {
    zip.file('README.txt', `Project ${projectName} is currently empty.\n`);
  }

  for (const filePath of filePaths) {
    const content = await readFileContent(projectName, filePath);
    zip.file(`${projectName}/${filePath}`, content);
  }

  if (Platform.OS === 'web') {
    const blob = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `${projectName}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
    return;
  }

  const archiveBytes = await zip.generateAsync({ type: 'uint8array' });
  const archiveFile = new File(Paths.cache, `${projectName}.zip`);
  if (archiveFile.exists) {
    archiveFile.delete();
  }

  archiveFile.create({ overwrite: true, intermediates: true });
  archiveFile.write(archiveBytes);

  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(archiveFile.uri);
}
