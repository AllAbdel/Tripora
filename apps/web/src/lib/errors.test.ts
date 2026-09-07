import { describe, expect, it, vi, afterEach } from 'vitest';
import { toFailure } from './errors';

afterEach(() => vi.unstubAllGlobals());

describe('traduction des pannes', () => {
  it('reconnaît l’absence de réseau avant tout le reste', () => {
    vi.stubGlobal('navigator', { onLine: false });
    const failure = toFailure({ status: 500 });
    expect(failure.kind).toBe('offline');
    expect(failure.hint).toMatch(/hors ligne/i);
  });

  it('distingue les refus d’accès des vraies pannes', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(toFailure({ status: 401 }).kind).toBe('unauthenticated');
    expect(toFailure({ status: 403 }).kind).toBe('forbidden');
    expect(toFailure({ status: 404 }).kind).toBe('notFound');
    expect(toFailure({ status: 409 }).kind).toBe('conflict');
    expect(toFailure({ status: 503 }).kind).toBe('server');
  });

  it('annonce un quota épuisé sans laisser croire à une panne, et sans réessai', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const failure = toFailure({ status: 429 });
    expect(failure.kind).toBe('quota');
    expect(failure.retryable).toBe(false);
    expect(failure.hint).toMatch(/continue de fonctionner/i);
  });

  it('traduit un échec réseau plutôt que d’afficher « Failed to fetch »', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const failure = toFailure(new TypeError('Failed to fetch'));
    expect(failure.kind).toBe('unreachable');
    expect(failure.message).not.toMatch(/fetch/i);
    expect(failure.message).toMatch(/serveur ne répond pas/i);
    expect(failure.retryable).toBe(true);
  });

  it('reconnaît la panne réseau même déguisée par supabase-js', () => {
    vi.stubGlobal('navigator', { onLine: true });
    // Forme réellement renvoyée : un objet nu, pas une instance d'Error.
    const failure = toFailure({
      message: 'TypeError: Failed to fetch',
      details: 'Request failed',
      hint: '',
      code: '',
    });
    expect(failure.kind).toBe('unreachable');
  });

  it('ne confond pas une erreur métier qui parle de réseau', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(toFailure({ message: 'Le réseau de transport local est inconnu' }).kind).toBe(
      'unknown',
    );
  });

  it('distingue « pas de réseau » de « serveur muet »', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(toFailure(new TypeError('Failed to fetch')).kind).toBe('offline');
  });

  it('reste compréhensible face à une erreur inconnue', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const failure = toFailure(new Error('bizarre'));
    expect(failure.kind).toBe('unknown');
    expect(failure.message).toBeTruthy();
  });
  it('lit le code des erreurs de base, qui n’ont pas de statut', () => {
    vi.stubGlobal('navigator', { onLine: true });
    // Forme réelle d'une PostgrestError : aucun `status`, seulement un `code`.
    // Sans lui, un refus de politique RLS passait pour « erreur inattendue ».
    const refus = toFailure({
      message: 'new row violates row-level security policy for table "trips"',
      code: '42501',
      details: null,
      hint: null,
    });
    expect(refus.kind).toBe('forbidden');
    expect(refus.message).not.toMatch(/inattendue/i);

    expect(toFailure({ message: '', code: '23505' }).kind).toBe('conflict');
    expect(toFailure({ message: '', code: 'PGRST116' }).kind).toBe('notFound');
    expect(toFailure({ message: '', code: '28000' }).kind).toBe('unauthenticated');
  });

  it('ne prend pas un code vide pour un diagnostic', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(toFailure({ message: 'bizarre', code: '' }).kind).toBe('unknown');
  });
});
