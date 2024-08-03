import gameAPI from "./gameAPI.js";
import { AUTH_TOKEN } from "./constants.js";
const validTypes = new Set([
  "characters",
  "resources",
  "monsters",
  "items",
  "maps",
]);

const Game = {
  authorization: AUTH_TOKEN,
  getAll: async function (type, opts) {
    if (!validTypes.has(type)) {
      console.log(`Invalid type: ${type}!`);
      return {};
    }
    const headers = { Authorization: this.authorization };
    const params = opts || null;
    const endpoint = `/${type}`;
    return gameAPI.callAPI(endpoint, "GET", headers, null, params);
  },
  getMyCharacters: async function (opts) {
    const headers = { Authorization: this.authorization };
    const params = opts || null;
    const endpoint = `/my/characters`;
    return gameAPI.callAPI(endpoint, "GET", headers, null, params);
  },
};

export default Game;
