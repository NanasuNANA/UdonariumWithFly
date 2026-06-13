import Loader, { I18nJsonObject } from 'bcdice/lib/loader/loader';
import gameSystems from './bcdice-game-systems.generated';
import i18nSystems from './bcdice-i18n.generated';

export default class BCDiceLoader extends Loader {
  async dynamicImportI18n(baseClassName: string, locale: string): Promise<I18nJsonObject> {
    const key = `${baseClassName}.${locale}`;
    const loader = i18nSystems.get(key);
    if (!loader) throw new Error(`BCDice i18n not found: ${key}`);
    return ((await loader()).default) as I18nJsonObject;
  }

  async dynamicImport(className: string): Promise<void> {
    const loader = gameSystems.get(className);
    if (!loader) throw new Error(`BCDice game system not found: ${className}`);
    await loader();
  }
}
