const gameAPI = require('./gameAPI');
const {AUTH_TOKEN,SKILLS,INVENTORY_SLOTS}  = require('./constants');

//Character prototype to handle actions and tracking information
function Character(data) {
    this.authorization = AUTH_TOKEN;
    this.skills = {};
    this.inventory = [];
    this.task = {};
    this.gear = {};
    this.objective = {};
    this.setData(data);
}

//Character Actions
Character.prototype.move = async function (x, y) {
    const headers = { Authorization: this.authorization };
    const data = { x, y };
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/move`;
    return gameAPI.callAPI(endpoint, 'POST', headers, data);
};

Character.prototype.fight = async function () {
    const headers = { Authorization: this.authorization };
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/fight`;
    return gameAPI.callAPI(endpoint, 'POST', headers, null);
};

//Character Data
Character.prototype.setData = function(data){
    for (let key in data) {
        let keySplit = key.split('_');

        //Inventory is set up separately, so skip these
        if(keySplit[0] == 'inventory'){
            continue;
        }
        //Task is set up separately, skip
        else if(keySplit[0] == 'task'){
            continue
        }
        //Set up gear, separate out the consumables and artifacts for now
        else if(keySplit[keySplit.length-1] == 'slot' && !['consumable2','consumable1','artifact1','artifact2','artifact3'].includes(keySplit[0])){
            let gearSlot = keySplit.slice(0, -1).join('_');
            this.gear[gearSlot] = data[key];
        }
        //Set up skills
        else if(SKILLS.includes(keySplit[0])){
            //Add the skill to the Character's skills if not already
            if (!this.skills[keySplit[0]]) {
                this.skills[keySplit[0]] = {};
            }
            //Assign the attributes for xp and max_xp to the skill
            const attribute = keySplit.slice(1).join('_');
            this.skills[keySplit[0]][attribute] = data[key];
        }
        //Everything not filtered out just goes in as a flat property
        else{
            this[key] = data[key];
        }
    }

    //Set up task object
    this.task = {
        target: data['task'],
        type: data['task_type'],
        progress: data['task_progress'],
        total: data['task_total']
    }

    //Set up inventory array with item objects
    for(let i = 1; i <= INVENTORY_SLOTS; i++){
        let key = `inventory_slot${i}`;
        this.inventory.push({
            slot:i,
            itemName:data[key],
            quantity:data[key+'_quantity']
        })
    }
}


//Character Logic
/**
 * Character objective priorities:
 * 1. Have all equipment at our best level
 *  1.a Level skill if needed for resource gathering
 *  1.b Gather resources to create equipment
 *  1.c Create equipment, sell old equipment
 * 2. Be at full health
 * 3. Complete Task
 */
Character.prototype.getObjective = function(){
    //See if we need better gear
    for(let [slot,item] of Object.entries(this.gear)){
        //If we're missing an item
        if(!item){

        }
    }
}

module.exports = Character;