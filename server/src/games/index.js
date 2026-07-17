// games/index.js — registry of playable games. GameManager looks games up here.
// This repo ships one U.S. History Unit 1 game: Colony Sort: Region Rush.

import usColonySort from './usColonySort.js';

export const GAMES = {
  [usColonySort.id]: usColonySort,
};

export function getGame(id) {
  return GAMES[id] || null;
}
