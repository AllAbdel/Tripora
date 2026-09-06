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

  it('reste compréhensible face à une erreur inconnue', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const failure = toFailure(new Error('bizarre'));
    expect(failure.kind).toBe('unknown');
    expect(failure.message).toBeTruthy();
  });
});
