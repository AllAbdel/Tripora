import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { presenterLeService } from './services';

describe('présentation de l’état du serveur', () => {
  it('n’alarme que lorsque le serveur ne répond pas', () => {
    // Le mode local et l'absence de clé d'IA sont des choix, pas des pannes :
    // les signaler en rouge apprendrait à ignorer le rouge.
    expect(presenterLeService({ statut: 'ok', fournisseurs: [] }).ton).toBe('ok');
    expect(presenterLeService({ statut: 'sans-serveur' }).ton).toBe('neutre');
    expect(presenterLeService({ statut: 'non-configure' }).ton).toBe('neutre');
    expect(presenterLeService({ statut: 'injoignable' }).ton).toBe('alerte');
  });

  it('nomme les fournisseurs quand il y en a, et se tait sinon', () => {
    const avec = presenterLeService({ statut: 'ok', fournisseurs: ['gemini', 'groq'] });
    expect(avec.detail).toContain('gemini, groq');

    const sans = presenterLeService({ statut: 'ok', fournisseurs: [] });
    expect(sans.detail).not.toContain('Assistant');
  });

  it('distingue « pas de clé » de « pas de réponse » dans les mots', () => {
    // C'est toute la raison d'être de ce module : les deux situations se
    // ressemblaient à l'écran, et l'une a duré deux semaines déguisée en
    // l'autre. Les deux textes ne doivent jamais pouvoir se confondre.
    const sansCle = presenterLeService({ statut: 'non-configure' });
    const muet = presenterLeService({ statut: 'injoignable' });

    expect(sansCle.titre).not.toBe(muet.titre);
    expect(sansCle.ton).not.toBe(muet.ton);
    expect(muet.detail).toMatch(/panne/i);
  });
});

/**
 * La sonde elle-même : ce qu'elle conclut selon ce que le serveur répond.
 *
 * Le cas qui compte est le dernier — un appel qui échoue parce que le
 * navigateur le refuse ne doit plus jamais être lu comme « non configuré ».
 */
describe('sonde de l’état du serveur', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock('./supabase'));

  async function avecReponse(reponse: { data?: unknown; error?: unknown } | Error) {
    vi.doMock('./supabase', () => ({
      supabase: {
        functions: {
          invoke: () => (reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse)),
        },
      },
    }));
    const { etatDuServeur } = await import('./ai');
    return await etatDuServeur();
  }

  it('lit les fournisseurs quand le serveur répond', async () => {
    const etat = await avecReponse({ data: { configured: true, providers: ['gemini', 'mistral'] } });
    expect(etat).toEqual({ statut: 'ok', fournisseurs: ['gemini', 'mistral'] });
  });

  it('dit « non configuré » quand le serveur le dit lui-même', async () => {
    const etat = await avecReponse({ data: { configured: false, providers: [] } });
    expect(etat.statut).toBe('non-configure');
  });

  it('dit « injoignable » quand l’appel n’aboutit pas', async () => {
    // Exactement ce que produit un refus du navigateur : l'appel lève, sans
    // qu'aucune réponse ne revienne. Avant, ce cas se lisait « non-configuré »
    // et l'application masquait l'assistant en silence.
    const parException = await avecReponse(new TypeError('Failed to fetch'));
    expect(parException.statut).toBe('injoignable');

    const parErreur = await avecReponse({ data: null, error: new Error('FunctionsFetchError') });
    expect(parErreur.statut).toBe('injoignable');
  });

  it('dit « sans serveur » en mode local, ce qui n’est pas une panne', async () => {
    vi.doMock('./supabase', () => ({ supabase: null }));
    const { etatDuServeur } = await import('./ai');
    expect((await etatDuServeur()).statut).toBe('sans-serveur');
  });
});
