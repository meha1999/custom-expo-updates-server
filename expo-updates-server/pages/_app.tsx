import { AppProps } from 'next/app';
import { LocaleProvider } from '../components/providers/locale-provider';
import { ToastProvider } from '../components/providers/toast-provider';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <LocaleProvider>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </LocaleProvider>
  );
}

export default MyApp;
