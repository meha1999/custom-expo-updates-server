import FormData from 'form-data';
import { NextApiRequest, NextApiResponse } from 'next';
import { serializeDictionary } from 'structured-headers';

import {
  getAppCodeSigningConfig,
  insertRequestLog,
  resolveReleaseForRequest,
} from '../../common/controlPlaneDb';
import { getRequestContext, getSingleValue } from '../../common/requestContext';
import {
  getAssetMetadataAsync,
  getMetadataAsync,
  convertSHA256HashToUUID,
  convertToDictionaryItemsRepresentation,
  signRSASHA256,
  getPrivateKeyAsync,
  getExpoConfigAsync,
  createRollBackDirectiveAsync,
  NoUpdateAvailableError,
  createNoUpdateAvailableDirectiveAsync,
} from '../../common/helpers';

export default async function manifestEndpoint(req: NextApiRequest, res: NextApiResponse) {
  const context = getRequestContext(req);
  const runtimeVersion = context.runtimeVersion;
  const platform = context.platform;
  const protocolHeader = req.headers['expo-protocol-version'];

  const logEvent = async (
    eventType:
      | 'manifest_update'
      | 'manifest_rollback'
      | 'manifest_no_update'
      | 'manifest_error',
    status: number,
    extras?: {
      updateId?: string;
      bundlePath?: string;
      message?: string;
    },
  ): Promise<void> => {
    insertRequestLog({
      timestamp: new Date().toISOString(),
      eventType,
      requestPath: '/api/manifest',
      method: req.method ?? 'GET',
      status,
      appSlug: context.appSlug,
      channelName: context.channelName,
      platform,
      runtimeVersion,
      updateId: extras?.updateId,
      bundlePath: extras?.bundlePath,
      message: extras?.message,
      ip: context.ip,
      userAgent: context.userAgent,
      deviceId: context.deviceId,
      appVersion: context.appVersion,
    });
  };

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Expected GET.' });
    await logEvent('manifest_error', 405, { message: 'Expected GET.' });
    return;
  }

  if (Array.isArray(protocolHeader)) {
    res.status(400).json({
      error: 'Unsupported protocol version. Expected either 0 or 1.',
    });
    await logEvent('manifest_error', 400, {
      message: 'Unsupported protocol version. Expected either 0 or 1.',
    });
    return;
  }
  const parsedProtocolVersion = parseInt(getSingleValue(protocolHeader) ?? '0', 10);
  const protocolVersion = Number.isFinite(parsedProtocolVersion) ? parsedProtocolVersion : 0;

  if (platform !== 'ios' && platform !== 'android') {
    res.status(400).json({
      error: 'Unsupported platform. Expected either ios or android.',
    });
    await logEvent('manifest_error', 400, {
      message: 'Unsupported platform. Expected either ios or android.',
    });
    return;
  }

  if (!runtimeVersion) {
    res.status(400).json({
      error: 'No runtimeVersion provided.',
    });
    await logEvent('manifest_error', 400, {
      message: 'No runtimeVersion provided.',
    });
    return;
  }

  try {
    const resolution = resolveReleaseForRequest({
      appSlug: context.appSlug,
      channelName: context.channelName,
      runtimeVersion,
      deviceId: context.deviceId,
    });

    if (resolution.kind === 'rollback') {
      await putRollBackDirectiveInResponseAsync(
        req,
        res,
        protocolVersion,
        resolution.policy.updatedAt,
        context.appSlug,
      );
      await logEvent('manifest_rollback', res.statusCode, {
        message: 'Rollback policy active',
      });
      return;
    }

    if (resolution.kind === 'no_update') {
      if (resolution.reason === 'No release found for runtime') {
        res.status(404).json({ error: 'Unsupported runtime version' });
        await logEvent('manifest_error', 404, { message: resolution.reason });
        return;
      }
      await putNoUpdateAvailableInResponseAsync(req, res, protocolVersion, context.appSlug);
      await logEvent('manifest_no_update', res.statusCode, {
        message: resolution.reason,
      });
      return;
    }

    const release = resolution.release;
    if (release.isRollback) {
      await putRollBackInResponseAsync(
        req,
        res,
        release.updatePath,
        protocolVersion,
        context.appSlug,
      );
      await logEvent('manifest_rollback', res.statusCode, {
        bundlePath: release.updatePath,
      });
      return;
    }

    const result = await putUpdateInResponseAsync(
      req,
      res,
      release.updatePath,
      runtimeVersion,
      platform,
      protocolVersion,
      context.appSlug,
    );

    await logEvent('manifest_update', res.statusCode, {
      updateId: result.manifestId,
      bundlePath: release.updatePath,
    });
  } catch (error) {
    if (error instanceof NoUpdateAvailableError) {
      try {
        await putNoUpdateAvailableInResponseAsync(req, res, protocolVersion, context.appSlug);
        await logEvent('manifest_no_update', res.statusCode, {
          message: 'Client already on latest update',
        });
      } catch (directiveError) {
        res.status(500).json({
          error: directiveError instanceof Error ? directiveError.message : 'Failed to emit no-update directive',
        });
        await logEvent('manifest_error', 500, {
          message:
            directiveError instanceof Error
              ? directiveError.message
              : 'Failed to emit no-update directive',
        });
      }
      return;
    }
    console.error(error);
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Manifest processing failed',
    });
    await logEvent('manifest_error', 404, {
      message: error instanceof Error ? error.message : 'Manifest processing failed',
    });
  }
}

async function putUpdateInResponseAsync(
  req: NextApiRequest,
  res: NextApiResponse,
  updateBundlePath: string,
  runtimeVersion: string,
  platform: string,
  protocolVersion: number,
  appSlug: string,
): Promise<{ manifestId: string }> {
  const currentUpdateId = req.headers['expo-current-update-id'];
  const { metadataJson, createdAt, id } = await getMetadataAsync({
    updateBundlePath,
    runtimeVersion,
  });

  if (currentUpdateId === convertSHA256HashToUUID(id) && protocolVersion === 1) {
    throw new NoUpdateAvailableError();
  }

  const expoConfig = await getExpoConfigAsync({
    updateBundlePath,
    runtimeVersion,
  });
  const platformSpecificMetadata = metadataJson.fileMetadata[platform];
  const manifest = {
    id: convertSHA256HashToUUID(id),
    createdAt,
    runtimeVersion,
    assets: await Promise.all(
      (platformSpecificMetadata.assets as any[]).map((asset: any) =>
        getAssetMetadataAsync({
          updateBundlePath,
          filePath: asset.path,
          ext: asset.ext,
          runtimeVersion,
          platform,
          isLaunchAsset: false,
        }),
      ),
    ),
    launchAsset: await getAssetMetadataAsync({
      updateBundlePath,
      filePath: platformSpecificMetadata.bundle,
      isLaunchAsset: true,
      runtimeVersion,
      platform,
      ext: null,
    }),
    metadata: {},
    extra: {
      expoClient: expoConfig,
    },
  };

  let signature = null;
  const expectSignatureHeader = req.headers['expo-expect-signature'];
  if (expectSignatureHeader) {
    const signingConfig = await getSigningConfigAsync(appSlug);
    const privateKey = signingConfig.privateKey;
    if (!privateKey) {
      res.status(400).json({
        error: `Code signing requested but no key is configured for app "${appSlug}".`,
      });
      return { manifestId: manifest.id };
    }
    const manifestString = JSON.stringify(manifest);
    const hashSignature = signRSASHA256(manifestString, privateKey);
    const dictionary = convertToDictionaryItemsRepresentation({
      sig: hashSignature,
      keyid: signingConfig.keyId,
    });
    signature = serializeDictionary(dictionary);
  }

  const assetRequestHeaders: { [key: string]: object } = {};
  [...manifest.assets, manifest.launchAsset].forEach((asset) => {
    assetRequestHeaders[asset.key] = {
      'test-header': 'test-header-value',
    };
  });

  const form = new FormData();
  form.append('manifest', JSON.stringify(manifest), {
    contentType: 'application/json',
    header: {
      'content-type': 'application/json; charset=utf-8',
      ...(signature ? { 'expo-signature': signature } : {}),
    },
  });
  form.append('extensions', JSON.stringify({ assetRequestHeaders }), {
    contentType: 'application/json',
  });

  res.statusCode = 200;
  res.setHeader('expo-protocol-version', protocolVersion);
  res.setHeader('expo-sfv-version', 0);
  res.setHeader('cache-control', 'private, max-age=0');
  res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
  res.write(form.getBuffer());
  res.end();
  return { manifestId: manifest.id };
}

async function putRollBackInResponseAsync(
  req: NextApiRequest,
  res: NextApiResponse,
  updateBundlePath: string,
  protocolVersion: number,
  appSlug: string,
): Promise<void> {
  if (protocolVersion === 0) {
    throw new Error('Rollbacks not supported on protocol version 0');
  }

  const embeddedUpdateId = req.headers['expo-embedded-update-id'];
  if (!embeddedUpdateId || typeof embeddedUpdateId !== 'string') {
    throw new Error('Invalid Expo-Embedded-Update-ID request header specified.');
  }

  const currentUpdateId = req.headers['expo-current-update-id'];
  if (currentUpdateId === embeddedUpdateId) {
    throw new NoUpdateAvailableError();
  }

  const directive = await createRollBackDirectiveAsync(updateBundlePath);
  await sendDirectiveAsync(req, res, directive, 1, appSlug);
}

async function putRollBackDirectiveInResponseAsync(
  req: NextApiRequest,
  res: NextApiResponse,
  protocolVersion: number,
  commitTime: string,
  appSlug: string,
): Promise<void> {
  if (protocolVersion === 0) {
    throw new Error('Rollbacks not supported on protocol version 0');
  }

  const embeddedUpdateId = req.headers['expo-embedded-update-id'];
  if (!embeddedUpdateId || typeof embeddedUpdateId !== 'string') {
    throw new Error('Invalid Expo-Embedded-Update-ID request header specified.');
  }

  const currentUpdateId = req.headers['expo-current-update-id'];
  if (currentUpdateId === embeddedUpdateId) {
    throw new NoUpdateAvailableError();
  }

  const directive = {
    type: 'rollBackToEmbedded',
    parameters: {
      commitTime,
    },
  };

  await sendDirectiveAsync(req, res, directive, 1, appSlug);
}

async function putNoUpdateAvailableInResponseAsync(
  req: NextApiRequest,
  res: NextApiResponse,
  protocolVersion: number,
  appSlug: string,
): Promise<void> {
  if (protocolVersion === 0) {
    throw new Error('NoUpdateAvailable directive not available in protocol version 0');
  }

  const directive = await createNoUpdateAvailableDirectiveAsync();
  await sendDirectiveAsync(req, res, directive, 1, appSlug);
}

async function sendDirectiveAsync(
  req: NextApiRequest,
  res: NextApiResponse,
  directive: object,
  protocolVersion: number,
  appSlug: string,
): Promise<void> {
  let signature = null;
  const expectSignatureHeader = req.headers['expo-expect-signature'];
  if (expectSignatureHeader) {
    const signingConfig = await getSigningConfigAsync(appSlug);
    const privateKey = signingConfig.privateKey;
    if (!privateKey) {
      res.statusCode = 400;
      res.json({
        error: `Code signing requested but no key is configured for app "${appSlug}".`,
      });
      return;
    }
    const directiveString = JSON.stringify(directive);
    const hashSignature = signRSASHA256(directiveString, privateKey);
    const dictionary = convertToDictionaryItemsRepresentation({
      sig: hashSignature,
      keyid: signingConfig.keyId,
    });
    signature = serializeDictionary(dictionary);
  }

  const form = new FormData();
  form.append('directive', JSON.stringify(directive), {
    contentType: 'application/json',
    header: {
      'content-type': 'application/json; charset=utf-8',
      ...(signature ? { 'expo-signature': signature } : {}),
    },
  });

  res.statusCode = 200;
  res.setHeader('expo-protocol-version', protocolVersion);
  res.setHeader('expo-sfv-version', 0);
  res.setHeader('cache-control', 'private, max-age=0');
  res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
  res.write(form.getBuffer());
  res.end();
}

async function getSigningConfigAsync(appSlug: string): Promise<{ privateKey: string | null; keyId: string }> {
  const appConfig = getAppCodeSigningConfig(appSlug);
  if (appConfig.privateKeyPem) {
    return {
      privateKey: appConfig.privateKeyPem,
      keyId: appConfig.keyId || 'main',
    };
  }

  const fallbackKey = await getPrivateKeyAsync();
  return {
    privateKey: fallbackKey,
    keyId: appConfig.keyId || 'main',
  };
}
