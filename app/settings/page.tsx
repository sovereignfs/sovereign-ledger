import { Card, PageHeader } from '@sovereignfs/ui';
import { BackLink } from '../_components/BackLink';
import { SettingsForm } from '../_components/SettingsForm';
import { getSettings } from '../_lib/actions';
import styles from './page.module.css';

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className={styles.page}>
      <BackLink href="/ledger">Back</BackLink>

      <PageHeader
        title="Settings"
        description="Your base currency, display currency, and monthly budget period."
      />

      <Card className={styles.card}>
        <SettingsForm settings={settings} />
      </Card>
    </div>
  );
}
