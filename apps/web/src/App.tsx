import BackofficeEntry from './app/backoffice/BackofficeEntry';
import PwaUpdateBanner from './components/PwaUpdateBanner';
import { useTerminalProfile } from './hooks/useTerminalProfile';

export default function App() {
  useTerminalProfile({ report: true });

  return (
    <>
      <BackofficeEntry />
      <PwaUpdateBanner />
    </>
  );
}
