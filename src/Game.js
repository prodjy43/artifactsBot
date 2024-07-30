const gameAPI = require('./gameAPI');
const { AUTH_TOKEN } = require('./constants');
const validTypes = new Set(['characters', 'resources', 'monsters', 'items', 'maps']);


//Game object for interacting with the overall game
const Game = {
    authorization: AUTH_TOKEN,
    getAll: async function (type,opts) {
        if (!validTypes.has(type)) {
            console.log(`Invalid type: ${type}!`);
            return {};
        }
        const headers = { Authorization: this.authorization };
        const params = opts || null;
        const endpoint = `/${type}`;
        return gameAPI.callAPI(endpoint, 'GET', headers, null, params);
    },
    getMyCharacters: async function (opts) {
        const headers = { Authorization: this.authorization };
        const params = opts || null;
        const endpoint = `/my/characters`;
        return gameAPI.callAPI(endpoint, 'GET', headers, null, params);
    },
};

module.exports = Game;