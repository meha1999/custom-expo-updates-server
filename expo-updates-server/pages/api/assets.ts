import fs from 'fs';
import fsPromises from 'fs/promises';
import mime from 'mime';
import { NextApiRequest, NextApiResponse } from 'next';
import nullthrows from 'nullthrows';
import path from 'path';
import { insertRequestLog } from '../../common/controlPlaneDb';
import { getRequestContext } from '../../common/requestContext';
import { getLatestUpdateBundlePathForRuntimeVersionAsync, getMetadataAsync } from '../../common/helpers';

export default async function assetsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const context = getRequestContext(req);
  const { asset: assetName, runtimeVersion, platform } = req.query;
  const safeAssetName = typeof assetName === 'string' ? assetName : undefined;
  const safeRuntimeVersion = typeof runtimeVersion === 'string' ? runtimeVersion : undefined;
  const safePlatform = typeof platform === 'string' ? platform : undefined;

  const logAssetEvent = (
    status: number,
    eventType: 'asset_success' | 'asset_error',
    message?: string,
    bundlePath?: string,
  ): void => {
    insertRequestLog({
      timestamp: new Date().toISOString(),
      eventType,
      status,
      requestPath: '/api/assets',
      method: req.method ?? 'GET',
      appSlug: context.appSlug,
      channelName: context.channelName,
      platform: safePlatform,
      runtimeVersion: safeRuntimeVersion,
      assetName: safeAssetName,
      message,
      bundlePath,
      ip: context.ip,
      userAgent: context.userAgent,
      deviceId: context.deviceId,
      appVersion: context.appVersion,
    });
  };

  if (!assetName || typeof assetName !== 'string') {
    res.statusCode = 400;
    res.json({ error: 'No asset name provided.' });
    logAssetEvent(400, 'asset_error', 'No asset name provided.');
    return;
  }

  if (platform !== 'ios' && platform !== 'android') {
    res.statusCode = 400;
    res.json({ error: 'No platform provided. Expected "ios" or "android".' });
    logAssetEvent(400, 'asset_error', 'No platform provided. Expected "ios" or "android".');
    return;
  }

  if (!runtimeVersion || typeof runtimeVersion !== 'string') {
    res.statusCode = 400;
    res.json({ error: 'No runtimeVersion provided.' });
    logAssetEvent(400, 'asset_error', 'No runtimeVersion provided.');
    return;
  }

  let updateBundlePath = inferUpdateBundlePath(assetName);
  if (!updateBundlePath) {
    try {
      updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion);
    } catch (error: any) {
      res.statusCode = 404;
      res.json({
        error: error.message,
      });
      logAssetEvent(404, 'asset_error', error.message);
      return;
    }
  }

  const { metadataJson } = await getMetadataAsync({
    updateBundlePath,
    runtimeVersion,
  });

  const assetPath = path.resolve(assetName);
  const updatesRootPath = path.resolve(process.cwd(), 'updates');
  const normalizedUpdatesRoot = updatesRootPath.endsWith(path.sep)
    ? updatesRootPath
    : `${updatesRootPath}${path.sep}`;
  if (!assetPath.startsWith(normalizedUpdatesRoot)) {
    res.statusCode = 403;
    res.json({ error: 'Asset path must be within updates directory.' });
    logAssetEvent(403, 'asset_error', 'Asset path outside updates directory.', updateBundlePath);
    return;
  }

  const assetMetadata = metadataJson.fileMetadata[platform].assets.find(
    (asset: any) => asset.path === assetName.replace(`${updateBundlePath}/`, ''),
  );
  const isLaunchAsset =
    metadataJson.fileMetadata[platform].bundle === assetName.replace(`${updateBundlePath}/`, '');

  if (!isLaunchAsset && !assetMetadata) {
    res.statusCode = 404;
    res.json({ error: `Asset "${assetName}" metadata is missing.` });
    logAssetEvent(404, 'asset_error', `Asset "${assetName}" metadata is missing.`, updateBundlePath);
    return;
  }

  if (!fs.existsSync(assetPath)) {
    res.statusCode = 404;
    res.json({ error: `Asset "${assetName}" does not exist.` });
    logAssetEvent(404, 'asset_error', `Asset "${assetName}" does not exist.`, updateBundlePath);
    return;
  }

  try {
    const asset = await fsPromises.readFile(assetPath, null);
    res.statusCode = 200;
    res.setHeader(
      'content-type',
      isLaunchAsset ? 'application/javascript' : nullthrows(mime.getType(assetMetadata!.ext)),
    );
    res.end(asset);
    logAssetEvent(200, 'asset_success', undefined, updateBundlePath);
  } catch (error) {
    console.log(error);
    res.statusCode = 500;
    res.json({ error });
    logAssetEvent(
      500,
      'asset_error',
      error instanceof Error ? error.message : 'Unknown asset read failure',
      updateBundlePath,
    );
  }
}

function inferUpdateBundlePath(assetName: string): string | null {
  const normalized = assetName.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const updatesIndex = segments.indexOf('updates');
  if (updatesIndex < 0 || segments.length < updatesIndex + 3) {
    return null;
  }
  return segments.slice(updatesIndex, updatesIndex + 3).join('/');
}
