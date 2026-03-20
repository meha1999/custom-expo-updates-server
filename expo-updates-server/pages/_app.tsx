import { AppProps } from 'next/app';
import { LocaleProvider } from '../components/providers/locale-provider';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <LocaleProvider>
      <Component {...pageProps} />
    </LocaleProvider>
  );
}

export default MyApp;
