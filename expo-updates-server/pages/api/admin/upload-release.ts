import fs from 'fs';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../common/auth';
import {
  assignReleaseToChannel,
  insertAdminAuditLog,
  registerRelease,
} from '../../../common/controlPlaneDb';
import { SINGLE_APP_SLUG } from '../../../common/singleApp';

interface UploadFileInput {
  path: string;
  contentBase64: string;
}

function assertSafeFolderSegment(value: string, label: string): void {
  if (!value) {
    throw new Error(`${label} is required`);
  }
  if (value.includes('/') || value.includes('\\') || value.includes('\0') || value === '.' || value === '..') {
    throw new Error(`Invalid ${label}`);
  }
}

function parseDeviceList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeRelativePath(rawPath: string): string {
  return rawPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

function assertSafeRelativePath(relativePath: string): void {
  if (!relativePath) {
    throw new Error('File path is required');
  }
  if (relativePath.includes('\0')) {
    throw new Error(`Invalid file path: ${relativePath}`);
  }
  if (relativePath.startsWith('../') || relativePath.includes('/../') || relativePath === '..') {
    throw new Error(`Path traversal is not allowed: ${relativePath}`);
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Absolute paths are not allowed: ${relativePath}`);
  }
}

function validateFiles(files: unknown): UploadFileInput[] {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('At least one file is required');
  }
  const normalized: UploadFileInput[] = [];
  for (const item of files) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const rawPath = `${(item as UploadFileInput).path ?? ''}`;
    const contentBase64 = `${(item as UploadFileInput).contentBase64 ?? ''}`;
    const filePath = normalizeRelativePath(rawPath);
    assertSafeRelativePath(filePath);
    if (!contentBase64.trim()) {
      throw new Error(`File "${filePath}" has empty content`);
    }
    normalized.push({
      path: filePath,
      contentBase64: contentBase64.trim(),
    });
  }
  if (normalized.length === 0) {
    throw new Error('No valid files were provided');
  }
  return normalized;
}

function writeUploadedFiles(params: {
  runtimeVersion: string;
  bundleId: string;
  files: UploadFileInput[];
}): { fileCount: number; totalBytes: number; updatePath: string } {
  const updatesRoot = path.resolve(process.cwd(), 'updates');
  const destinationDir = path.resolve(updatesRoot, params.runtimeVersion, params.bundleId);

  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(destinationDir, { recursive: true });

  let totalBytes = 0;
  for (const file of params.files) {
    const targetPath = path.resolve(destinationDir, file.path);
    const expectedPrefix = destinationDir.endsWith(path.sep) ? destinationDir : `${destinationDir}${path.sep}`;
    if (!(targetPath === destinationDir || targetPath.startsWith(expectedPrefix))) {
      throw new Error(`Resolved path is outside destination: ${file.path}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const buffer = Buffer.from(file.contentBase64, 'base64');
    totalBytes += buffer.byteLength;
    fs.writeFileSync(targetPath, buffer);
  }

  const metadataPath = path.join(destinationDir, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error('metadata.json is required in uploaded files');
  }

  return {
    fileCount: params.files.length,
    totalBytes,
    updatePath: path.relative(process.cwd(), destinationDir).replace(/\\/g, '/'),
  };
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

export default function uploadReleaseEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const user = requireAuth(req, res, { role: 'admin' });
  if (!user) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Expected POST.' });
    return;
  }

  const runtimeVersion = `${req.body?.runtimeVersion ?? ''}`.trim();
  const bundleId = `${req.body?.bundleId ?? ''}`.trim();
  const channelName = `${req.body?.channelName ?? ''}`.trim();

  if (!runtimeVersion || !bundleId) {
    res.status(400).json({ error: 'runtimeVersion and bundleId are required' });
    return;
  }

  try {
    assertSafeFolderSegment(runtimeVersion, 'runtimeVersion');
    assertSafeFolderSegment(bundleId, 'bundleId');

    const files = validateFiles(req.body?.files);
    const uploadResult = writeUploadedFiles({
      runtimeVersion,
      bundleId,
      files,
    });

    const release = registerRelease({
      appSlug: SINGLE_APP_SLUG,
      runtimeVersion,
      bundleId,
    });

    let policy: unknown = null;
    if (channelName) {
      policy = assignReleaseToChannel({
        appSlug: SINGLE_APP_SLUG,
        channelName,
        runtimeVersion,
        releaseId: release.id,
        rolloutPercentage:
          req.body?.rolloutPercentage === undefined ? undefined : Number(req.body.rolloutPercentage),
        allowlist: parseDeviceList(req.body?.allowlist),
        blocklist: parseDeviceList(req.body?.blocklist),
      });
    }

    insertAdminAuditLog({
      actorUsername: user.username,
      action: 'release.upload',
      appSlug: SINGLE_APP_SLUG,
      details: {
        runtimeVersion,
        bundleId,
        channelName: channelName || null,
        fileCount: uploadResult.fileCount,
        totalBytes: uploadResult.totalBytes,
      },
    });

    res.status(201).json({
      release,
      policy,
      upload: uploadResult,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to upload release files',
    });
  }
}
