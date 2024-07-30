const { callAPI } = require('./callAPI');

//Character prototype to handle actions and tracking information
function Character(name, authorization) {
    this.name = name;
    this.authorization = authorization;
}

Character.prototype.move = async function (x, y) {
    const headers = { Authorization: `Bearer ${this.authorization}` };
    const data = { x, y };
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/move`;
    return callAPI(endpoint, 'POST', headers, data);
};

Character.prototype.fight = async function () {
    const headers = { Authorization: `Bearer ${this.authorization}` };
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/fight`;
    return callAPI(endpoint, 'POST', headers);
};

module.exports = { Character };