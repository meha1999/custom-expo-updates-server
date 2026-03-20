import { FormEvent, useEffect, useState } from 'react';
import { DashboardPage } from '../../components/layout/dashboard-page';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FieldLabel } from '../../components/ui/field-label';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { StatCard, StatLabel, StatValue } from '../../components/ui/stat';
import { Table, Td, Th } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../components/providers/toast-provider';
import { useLocale } from '../../hooks/use-locale';
import { jsonFetch } from '../../lib/http';
import { formatDate, parseListInput } from '../../lib/format';
import { t } from '../../lib/i18n';
import { ChannelItem, DashboardPayload, ReleaseItem } from '../../lib/types';

export default function ReleasesPage() {
  const { locale } = useLocale();
  return (
    <DashboardPage
      title={t(locale, 'releases.title')}
      subtitle={t(locale, 'releases.subtitle')}
    >
      {({ appSlug, userRole }) => <ReleasesContent appSlug={appSlug} userRole={userRole} />}
    </DashboardPage>
  );
}

function ReleasesContent({ appSlug, userRole }: { appSlug: string; userRole: 'admin' | 'viewer' }) {
  const { locale } = useLocale();
  const toast = useToast();
  const [runtimeVersion, setRuntimeVersion] = useState('1');
  const [bundleId, setBundleId] = useState('');
  const [channelName, setChannelName] = useState('production');
  const [rolloutPercentage, setRolloutPercentage] = useState(100);
  const [allowlist, setAllowlist] = useState('');
  const [blocklist, setBlocklist] = useState('');

  const [sourceChannel, setSourceChannel] = useState('development');
  const [targetChannel, setTargetChannel] = useState('production');
  const [rollbackChannel, setRollbackChannel] = useState('production');

  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [audit, setAudit] = useState<DashboardPayload['recentAuditLogs']>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [registeringRelease, setRegisteringRelease] = useState(false);
  const [promotingRelease, setPromotingRelease] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [uploadRuntimeVersion, setUploadRuntimeVersion] = useState('1');
  const [uploadBundleId, setUploadBundleId] = useState('');
  const [uploadChannelName, setUploadChannelName] = useState('production');
  const [uploadRolloutPercentage, setUploadRolloutPercentage] = useState(100);
  const [uploadAllowlist, setUploadAllowlist] = useState('');
  const [uploadBlocklist, setUploadBlocklist] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showRegisterReleaseModal, setShowRegisterReleaseModal] = useState(false);
  const hints =
    locale === 'fa'
      ? {
          runtimeVersion: 'نسخه ران‌تایم هدف این انتشار. فقط دستگاه‌های همین ران‌تایم آپدیت را دریافت می‌کنند.',
          bundleId: 'نام پوشه باندل داخل مسیر updates که باید منتشر شود.',
          channel: 'کانالی که این نسخه روی آن فعال می‌شود.',
          rollout: 'درصد دستگاه‌هایی که مجاز به دریافت این آپدیت هستند.',
          allowlist: 'اگر پر شود، فقط همین Device IDها امکان دریافت آپدیت را دارند.',
          blocklist: 'Device IDهای این لیست حتی در صورت واجد شرایط بودن آپدیت نمی‌گیرند.',
          sourceChannel: 'کانالی که می‌خواهید نسخه فعال آن را بردارید.',
          targetChannel: 'کانالی که نسخه از مبدا به آن منتقل می‌شود.',
          rollbackChannel: 'کانالی که باید به نسخه embedded برگردد.',
        }
      : {
          runtimeVersion:
            'Target runtime version for this release. Only devices on this runtime can receive it.',
          bundleId: 'Bundle folder name inside the updates directory to publish.',
          channel: 'Channel where this release should be active.',
          rollout: 'Percentage of eligible devices that should receive this update.',
          allowlist: 'If set, only these device IDs can receive the update.',
          blocklist: 'Device IDs here are excluded even if they match rollout criteria.',
          sourceChannel: 'Channel to copy the currently active release from.',
          targetChannel: 'Channel to move/promote the release into.',
          rollbackChannel: 'Channel that should roll back to the embedded version.',
        };

  useEffect(() => {
    void loadData();
  }, [appSlug, locale]);

  async function loadData(): Promise<void> {
    try {
      const [releaseResp, dashboardResp, channelsResp] = await Promise.all([
        jsonFetch<{ items: ReleaseItem[] }>(`/api/admin/releases?app=${encodeURIComponent(appSlug)}`),
        jsonFetch<DashboardPayload>(`/api/dashboard?app=${encodeURIComponent(appSlug)}&limit=40`),
        jsonFetch<{ channels: ChannelItem[] }>(`/api/admin/channels?app=${encodeURIComponent(appSlug)}`),
      ]);
      setReleases(releaseResp.items);
      setAudit(dashboardResp.recentAuditLogs);
      setChannels(channelsResp.channels);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t(locale, 'releases.failedLoad'));
    }
  }

  const channelOptions = Array.from(
    new Set([
      ...channels.map((channel) => channel.name),
      'production',
      'development',
    ]),
  );

  const latestRelease = releases.length > 0 ? releases[0] : null;
  const rollbackReleases = releases.filter((item) => item.isRollback).length;
  const selectedUploadBytes = uploadFiles.reduce((sum, file) => sum + file.size, 0);

  function normalizeUploadPath(file: File): string {
    const withRelative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return (withRelative || file.name).replace(/\\/g, '/').replace(/^\/+/, '').trim();
  }

  function stripCommonRoot(paths: string[]): string[] {
    if (paths.length === 0) {
      return paths;
    }
    const splitPaths = paths.map((value) => value.split('/').filter(Boolean));
    const firstSegment = splitPaths[0]?.[0];
    if (!firstSegment) {
      return paths;
    }
    const hasSingleRoot = splitPaths.every((segments) => segments.length > 1 && segments[0] === firstSegment);
    if (!hasSingleRoot) {
      return paths;
    }
    return splitPaths.map((segments) => segments.slice(1).join('/'));
  }

  async function encodeFileToBase64(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  function handleUploadFileSelection(fileList: FileList | null): void {
    if (!fileList) {
      setUploadFiles([]);
      return;
    }
    setUploadFiles(Array.from(fileList));
  }

  async function handleRegisterRelease(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      setRegisteringRelease(true);
      await jsonFetch('/api/admin/releases', {
        method: 'POST',
        body: JSON.stringify({
          appSlug,
          runtimeVersion,
          bundleId,
          channelName,
          rolloutPercentage,
          allowlist: parseListInput(allowlist),
          blocklist: parseListInput(blocklist),
        }),
      });
      setBundleId('');
      setShowRegisterReleaseModal(false);
      const success = t(locale, 'releases.successRegister');
      setMessage(success);
      toast.success(success);
      await loadData();
    } catch (submitError) {
      const failure =
        submitError instanceof Error ? submitError.message : t(locale, 'releases.failedLoad');
      setError(failure);
      toast.error(failure);
    } finally {
      setRegisteringRelease(false);
    }
  }

  async function handleUploadRelease(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!uploadRuntimeVersion.trim() || !uploadBundleId.trim()) {
      const failure =
        locale === 'fa'
          ? 'Runtime Version و Bundle ID برای آپلود الزامی هستند.'
          : 'Runtime version and bundle ID are required for upload.';
      setError(failure);
      toast.error(failure);
      return;
    }
    if (uploadFiles.length === 0) {
      const failure =
        locale === 'fa'
          ? 'حداقل یک فایل برای آپلود انتخاب کنید.'
          : 'Select at least one file to upload.';
      setError(failure);
      toast.error(failure);
      return;
    }

    try {
      setUploadingFiles(true);
      const normalizedPaths = uploadFiles.map((file) => normalizeUploadPath(file));
      const finalPaths = stripCommonRoot(normalizedPaths);
      const files = await Promise.all(
        uploadFiles.map(async (file, index) => ({
          path: finalPaths[index] ?? normalizeUploadPath(file),
          contentBase64: await encodeFileToBase64(file),
        })),
      );

      await jsonFetch('/api/admin/upload-release', {
        method: 'POST',
        body: JSON.stringify({
          appSlug,
          runtimeVersion: uploadRuntimeVersion.trim(),
          bundleId: uploadBundleId.trim(),
          channelName: uploadChannelName,
          rolloutPercentage: uploadRolloutPercentage,
          allowlist: parseListInput(uploadAllowlist),
          blocklist: parseListInput(uploadBlocklist),
          files,
        }),
      });

      setUploadFiles([]);
      const success =
        locale === 'fa'
          ? 'فایل‌های آپدیت آپلود و نسخه ثبت شد.'
          : 'Update files uploaded and release registered.';
      setMessage(success);
      toast.success(success);
      await loadData();
    } catch (uploadError) {
      const failure =
        uploadError instanceof Error ? uploadError.message : t(locale, 'releases.failedLoad');
      setError(failure);
      toast.error(failure);
    } finally {
      setUploadingFiles(false);
    }
  }

  async function handlePromote(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      setPromotingRelease(true);
      await jsonFetch('/api/admin/promote', {
        method: 'POST',
        body: JSON.stringify({
          appSlug,
          sourceChannelName: sourceChannel,
          targetChannelName: targetChannel,
          runtimeVersion,
        }),
      });
      const success = t(locale, 'releases.successPromote');
      setMessage(success);
      toast.success(success);
      await loadData();
    } catch (submitError) {
      const failure =
        submitError instanceof Error ? submitError.message : t(locale, 'releases.failedLoad');
      setError(failure);
      toast.error(failure);
    } finally {
      setPromotingRelease(false);
    }
  }

  async function handleRollback(event: FormEvent): Promise<void> {
    event.preventDefault();
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            locale === 'fa'
              ? 'آیا از فعال‌سازی بازگشت به نسخه embedded مطمئن هستید؟'
              : 'Are you sure you want to enable rollback to embedded?',
          );
    if (!confirmed) {
      return;
    }
    try {
      setRollingBack(true);
      await jsonFetch('/api/admin/rollback', {
        method: 'POST',
        body: JSON.stringify({
          appSlug,
          channelName: rollbackChannel,
          runtimeVersion,
        }),
      });
      const success = t(locale, 'releases.successRollback');
      setMessage(success);
      toast.success(success);
      await loadData();
    } catch (submitError) {
      const failure =
        submitError instanceof Error ? submitError.message : t(locale, 'releases.failedLoad');
      setError(failure);
      toast.error(failure);
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard>
          <StatLabel>{locale === 'fa' ? 'کل نسخه‌ها' : 'Total releases'}</StatLabel>
          <StatValue>{releases.length}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>{locale === 'fa' ? 'نسخه‌های rollback' : 'Rollback releases'}</StatLabel>
          <StatValue>{rollbackReleases}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>{locale === 'fa' ? 'کانال‌های فعال' : 'Available channels'}</StatLabel>
          <StatValue>{channelOptions.length}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>{locale === 'fa' ? 'آخرین انتشار' : 'Latest release'}</StatLabel>
          <StatValue className="text-base">
            {latestRelease ? `${latestRelease.runtimeVersion}/${latestRelease.bundleId}` : '-'}
          </StatValue>
          <p className="mt-1 text-xs text-muted-foreground">
            {latestRelease ? formatDate(latestRelease.createdAt, locale) : ''}
          </p>
        </StatCard>
      </section>

      {error ? (
        <Card>
          <CardContent className="py-3 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}
      {message ? (
        <Card>
          <CardContent className="py-3 text-sm text-success">{message}</CardContent>
        </Card>
      ) : null}

      {userRole === 'admin' ? (
        <section className="grid items-start gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHeader>
              <CardTitle>{t(locale, 'releases.register.title')}</CardTitle>
              <CardDescription>{t(locale, 'releases.register.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">
                  {locale === 'fa'
                    ? 'فرم ثبت نسخه در پنجره جداگانه باز می‌شود.'
                    : 'Open release registration in a modal and keep this page focused on operations.'}
                </p>
                <Button type="button" onClick={() => setShowRegisterReleaseModal(true)}>
                  {t(locale, 'releases.register.button')}
                </Button>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <div className="rounded-md border border-border bg-muted/20 p-2">
                  <p className="font-medium">{t(locale, 'releases.register.runtimeVersion')}</p>
                  <p>{runtimeVersion || '-'}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2">
                  <p className="font-medium">{t(locale, 'releases.register.channel')}</p>
                  <p>{channelName || '-'}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2">
                  <p className="font-medium">{t(locale, 'releases.register.rollout')}</p>
                  <p>{rolloutPercentage}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Modal
            open={showRegisterReleaseModal}
            onClose={() => setShowRegisterReleaseModal(false)}
            title={t(locale, 'releases.register.title')}
            description={t(locale, 'releases.register.description')}
            widthClassName="max-w-4xl"
          >
            <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void handleRegisterRelease(event)}>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'releases.register.runtimeVersion')} hint={hints.runtimeVersion} />
                <Input
                  value={runtimeVersion}
                  onChange={(event) => setRuntimeVersion(event.target.value)}
                  placeholder={t(locale, 'releases.register.runtimeVersion')}
                  required
                />
              </div>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'releases.register.bundleId')} hint={hints.bundleId} />
                <Input
                  value={bundleId}
                  onChange={(event) => setBundleId(event.target.value)}
                  placeholder={t(locale, 'releases.register.bundleId')}
                  required
                />
              </div>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'releases.register.channel')} hint={hints.channel} />
                <Select value={channelName} onChange={(event) => setChannelName(event.target.value)}>
                  {channelOptions.map((channel) => (
                    <option key={`register-${channel}`} value={channel}>
                      {channel}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <FieldLabel label={t(locale, 'releases.register.rollout')} hint={hints.rollout} />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={rolloutPercentage}
                  onChange={(event) => setRolloutPercentage(Number(event.target.value))}
                  placeholder={t(locale, 'releases.register.rollout')}
                  required
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <FieldLabel label={t(locale, 'releases.register.allowlist')} hint={hints.allowlist} />
                <Textarea
                  value={allowlist}
                  onChange={(event) => setAllowlist(event.target.value)}
                  placeholder={t(locale, 'releases.register.allowlist')}
                  className="md:col-span-2"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <FieldLabel label={t(locale, 'releases.register.blocklist')} hint={hints.blocklist} />
                <Textarea
                  value={blocklist}
                  onChange={(event) => setBlocklist(event.target.value)}
                  placeholder={t(locale, 'releases.register.blocklist')}
                  className="md:col-span-2"
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  loading={registeringRelease}
                  loadingText={locale === 'fa' ? 'در حال ثبت...' : 'Registering...'}
                >
                  {t(locale, 'releases.register.button')}
                </Button>
              </div>
            </form>
          </Modal>

          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle>{t(locale, 'releases.ops.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-2" onSubmit={(event) => void handlePromote(event)}>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'releases.ops.sourceChannel')} hint={hints.sourceChannel} />
                  <Select value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value)}>
                    {channelOptions.map((channel) => (
                      <option key={`source-${channel}`} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'releases.ops.targetChannel')} hint={hints.targetChannel} />
                  <Select value={targetChannel} onChange={(event) => setTargetChannel(event.target.value)}>
                    {channelOptions.map((channel) => (
                      <option key={`target-${channel}`} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  loading={promotingRelease}
                  loadingText={locale === 'fa' ? 'در حال پروموت...' : 'Promoting...'}
                >
                  {t(locale, 'releases.ops.promoteButton')}
                </Button>
              </form>
              <form className="space-y-2" onSubmit={(event) => void handleRollback(event)}>
                <div className="space-y-1">
                  <FieldLabel label={t(locale, 'releases.ops.rollbackChannel')} hint={hints.rollbackChannel} />
                  <Select value={rollbackChannel} onChange={(event) => setRollbackChannel(event.target.value)}>
                    {channelOptions.map((channel) => (
                      <option key={`rollback-${channel}`} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="submit"
                  variant="destructive"
                  loading={rollingBack}
                  loadingText={locale === 'fa' ? 'در حال بازگشت...' : 'Rolling back...'}
                >
                  {t(locale, 'releases.ops.rollbackButton')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="xl:col-span-12">
            <CardHeader>
              <CardTitle>{locale === 'fa' ? 'آپلود فایل‌های آپدیت' : 'Upload Update Files'}</CardTitle>
              <CardDescription>
                {locale === 'fa'
                  ? 'پوشه خروجی آپدیت (metadata.json، expoConfig.json، bundles و assets) را مستقیم آپلود کنید. بعد از آپلود، نسخه ثبت و روی کانال انتخابی اعمال می‌شود.'
                  : 'Upload an exported update folder (metadata.json, expoConfig.json, bundles, assets). After upload, the release is registered and assigned to the selected channel.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => void handleUploadRelease(event)}>
                <div className="space-y-1">
                  <FieldLabel
                    label={locale === 'fa' ? 'Runtime Version' : 'Runtime Version'}
                    hint={
                      locale === 'fa'
                        ? 'مسیر ذخیره فایل‌ها: updates/<runtime>/<bundle>'
                        : 'Files are stored under updates/<runtime>/<bundle>.'
                    }
                  />
                  <Input
                    value={uploadRuntimeVersion}
                    onChange={(event) => setUploadRuntimeVersion(event.target.value)}
                    placeholder={locale === 'fa' ? 'مثال: test یا 1' : 'e.g. test or 1'}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel
                    label={locale === 'fa' ? 'Bundle ID' : 'Bundle ID'}
                    hint={
                      locale === 'fa'
                        ? 'نام پوشه نسخه داخل Runtime.'
                        : 'Release folder name inside the runtime directory.'
                    }
                  />
                  <Input
                    value={uploadBundleId}
                    onChange={(event) => setUploadBundleId(event.target.value)}
                    placeholder={locale === 'fa' ? 'مثال: 1 یا 17154400' : 'e.g. 1 or 17154400'}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel
                    label={locale === 'fa' ? 'کانال مقصد' : 'Target Channel'}
                    hint={
                      locale === 'fa'
                        ? 'نسخه بعد از آپلود روی این کانال فعال می‌شود.'
                        : 'Release is assigned to this channel immediately after upload.'
                    }
                  />
                  <Select value={uploadChannelName} onChange={(event) => setUploadChannelName(event.target.value)}>
                    {channelOptions.map((channel) => (
                      <option key={`upload-${channel}`} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <FieldLabel
                    label={locale === 'fa' ? 'Rollout %' : 'Rollout %'}
                    hint={
                      locale === 'fa'
                        ? 'درصد دستگاه‌های واجد شرایط برای دریافت نسخه.'
                        : 'Percent of eligible devices that can receive the release.'
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={uploadRolloutPercentage}
                    onChange={(event) => setUploadRolloutPercentage(Number(event.target.value))}
                    placeholder="100"
                    required
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel
                    label={locale === 'fa' ? 'Allowlist (اختیاری)' : 'Allowlist (optional)'}
                    hint={
                      locale === 'fa'
                        ? 'Device IDها را با comma یا خط جدید جدا کنید.'
                        : 'Separate device IDs by comma or newline.'
                    }
                  />
                  <Textarea
                    value={uploadAllowlist}
                    onChange={(event) => setUploadAllowlist(event.target.value)}
                    placeholder={locale === 'fa' ? 'device-1, device-2' : 'device-1, device-2'}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel
                    label={locale === 'fa' ? 'Blocklist (اختیاری)' : 'Blocklist (optional)'}
                    hint={
                      locale === 'fa'
                        ? 'Device IDهای این لیست آپدیت دریافت نمی‌کنند.'
                        : 'Devices in this list are excluded from update delivery.'
                    }
                  />
                  <Textarea
                    value={uploadBlocklist}
                    onChange={(event) => setUploadBlocklist(event.target.value)}
                    placeholder={locale === 'fa' ? 'device-x, device-y' : 'device-x, device-y'}
                  />
                </div>
                <div className="space-y-1 xl:col-span-4">
                  <FieldLabel
                    label={locale === 'fa' ? 'فایل‌ها/پوشه آپدیت' : 'Update Files/Folder'}
                    hint={
                      locale === 'fa'
                        ? 'پوشه کامل آپدیت را انتخاب کنید. در مرورگرهایی که پشتیبانی ندارند، چند فایل را با هم انتخاب کنید.'
                        : 'Select the full update folder. In unsupported browsers, select multiple files manually.'
                    }
                  />
                  <input
                    type="file"
                    multiple
                    onChange={(event) => handleUploadFileSelection(event.target.files)}
                    className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                    {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {locale === 'fa'
                      ? `${uploadFiles.length} فایل انتخاب شده - ${(selectedUploadBytes / (1024 * 1024)).toFixed(2)} MB`
                      : `${uploadFiles.length} file(s) selected - ${(selectedUploadBytes / (1024 * 1024)).toFixed(2)} MB`}
                  </p>
                </div>
                <div className="xl:col-span-4">
                  <Button
                    type="submit"
                    loading={uploadingFiles}
                    loadingText={locale === 'fa' ? 'در حال آپلود...' : 'Uploading...'}
                  >
                    {locale === 'fa' ? 'آپلود و ثبت نسخه' : 'Upload And Register Release'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'releases.recent.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'releases.recent.id')}</Th>
                  <Th>{t(locale, 'releases.recent.runtime')}</Th>
                  <Th>{t(locale, 'releases.recent.bundle')}</Th>
                  <Th>{locale === 'fa' ? 'مسیر فایل' : 'Update Path'}</Th>
                  <Th>{t(locale, 'releases.recent.type')}</Th>
                  <Th>{t(locale, 'releases.recent.created')}</Th>
                </tr>
              </thead>
              <tbody>
                {releases.slice(0, 30).map((release) => (
                  <tr key={release.id}>
                    <Td>{release.id}</Td>
                    <Td>{release.runtimeVersion}</Td>
                    <Td>{release.bundleId}</Td>
                    <Td>
                      <span className="break-all text-xs text-muted-foreground">
                        {release.updatePath ?? `${release.runtimeVersion}/${release.bundleId}`}
                      </span>
                    </Td>
                    <Td>
                      <Badge variant={release.isRollback ? 'warning' : 'default'}>
                        {release.isRollback
                          ? t(locale, 'releases.recent.rollback')
                          : t(locale, 'releases.recent.update')}
                      </Badge>
                    </Td>
                    <Td>{formatDate(release.createdAt, locale)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(locale, 'releases.audit.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t(locale, 'releases.audit.time')}</Th>
                  <Th>{t(locale, 'releases.audit.actor')}</Th>
                  <Th>{locale === 'fa' ? 'اپ' : 'App'}</Th>
                  <Th>{t(locale, 'releases.audit.action')}</Th>
                  <Th>{locale === 'fa' ? 'جزئیات' : 'Details'}</Th>
                </tr>
              </thead>
              <tbody>
                {audit.slice(0, 30).map((entry) => (
                  <tr key={entry.id}>
                    <Td>{formatDate(entry.timestamp, locale)}</Td>
                    <Td>{entry.actorUsername}</Td>
                    <Td>
                      <Badge variant="muted">{entry.appSlug}</Badge>
                    </Td>
                    <Td>
                      <Badge variant="default">{entry.action}</Badge>
                    </Td>
                    <Td>
                      <p className="max-w-[560px] break-all text-xs text-muted-foreground">{entry.detailsJson}</p>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
