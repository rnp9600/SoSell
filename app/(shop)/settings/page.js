import { Header } from '@/components/pm/header';
import SettingsClient from './settings-client';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <main>
      <Header title="Settings" back="/account" />
      <SettingsClient />
    </main>
  );
}
