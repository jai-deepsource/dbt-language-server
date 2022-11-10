import { assertThat, startsWith } from 'hamjest';
import { LanguageStatusSeverity } from 'vscode';
import { activateAndWait, getCustomDocUri, getLanguageStatusItems, getPreviewText, SPECIAL_PYTHON_SETTINGS_PATH } from './helper';

suite('Certain version', () => {
  const DOC_URI = getCustomDocUri('special-python-settings/models/version.sql');
  const VENV_VERSION = '1.2.2';

  test('Should run project with dbt version specified for workspace', async () => {
    await activateAndWait(DOC_URI);

    assertThat(getPreviewText(), VENV_VERSION);
    assertLanguageStatusItems();
  }).timeout('100s');

  function assertLanguageStatusItems(): void {
    const items = getLanguageStatusItems();
    assertThat(items.activeDbtProject.busy, false);
    assertThat(items.activeDbtProject.text, 'dbt project');
    assertThat(items.activeDbtProject.detail, SPECIAL_PYTHON_SETTINGS_PATH);

    assertThat(items.python.busy, false);

    assertThat(items.dbt.busy, false);
    assertThat(items.dbt.text, `dbt ${VENV_VERSION}`);
    assertThat(items.dbt.detail, startsWith('installed version. Latest version: '));
    assertThat(items.dbt.severity, LanguageStatusSeverity.Warning);
    assertThat(items.dbt.command?.title, 'Update To Latest Version');

    assertThat(items.dbtAdapters.busy, false);
    assertThat(items.dbtAdapters.detail, 'installed dbt adapters');
    assertThat(items.dbtAdapters.severity, LanguageStatusSeverity.Information);

    assertThat(items.dbtPackages.busy, false);
    assertThat(items.dbtPackages.text, 'No packages.yml');
    assertThat(items.dbtPackages.detail, '');
    assertThat(items.dbtPackages.severity, LanguageStatusSeverity.Information);
    assertThat(items.dbtPackages.command?.title, 'Install dbt Packages');

    assertThat(items.profilesYml.busy, false);
    assertThat(items.profilesYml.text, 'profiles.yml');
  }
});
