import { describe, expect, it } from 'vitest';
import { cryUrl, mp3CryUrl } from './catalog';

describe('cross-browser cry sources', () => {
  it('uses a real MP3 URL for Espurr', () => {
    expect(mp3CryUrl('espurr')).toBe('https://play.pokemonshowdown.com/audio/cries/espurr.mp3');
  });

  it('normalizes punctuation in species slugs and keeps PokeAPI as fallback', () => {
    expect(mp3CryUrl('mr-mime')).toBe('https://play.pokemonshowdown.com/audio/cries/mrmime.mp3');
    expect(cryUrl(677)).toContain('/latest/677.ogg');
  });
});
