import { SINGLE_APP_SLUG } from '../common/singleApp';

export function useAppScope(enabled: boolean) {
  void enabled;
  return {
    appSlug: SINGLE_APP_SLUG,
    loading: false,
  };
}
