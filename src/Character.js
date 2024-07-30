const gameAPI = require('./gameAPI');
const {AUTH_TOKEN,SKILLS,INVENTORY_SLOTS}  = require('./constants');
const jobNameRef = {
    'Amos':'miner',
    'Philip':'woodcutter'
}

//Character prototype to handle actions and tracking information
function Character(data) {
    this.authorization = AUTH_TOKEN;
    this.skills = {};
    this.inventory = {};
    this.task = {};
    this.gear = {};
    this.objective = null;
    this.jobs = [];
    this.personality = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
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
        if(!data[key]) continue;
        this.inventory[data[key]] = {
            slot:i,
            item:data[key],
            quantity:data[key+'_quantity']
        }
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
Character.prototype.getObjective = function(gameObjects){
    //Shuffle gear objective until we have a better way to decide
    let gearKeys = Object.keys(this.gear)
    let currentIndex = gearKeys.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [gearKeys[currentIndex], gearKeys[randomIndex]] = [
            gearKeys[randomIndex], gearKeys[currentIndex]];
    }

    //See if we need better gear
    for(let slot of gearKeys){
        let item = this.gear[slot]
        //If we're missing an item, our goal is to fill that item slot if we can
        //Extra check for the starter stick because it's awful
        if(!item || item.code == 'wooden_stick'){
            //Set the specific type we need, to make sure we get the rings as well
            let typeNeeded = ['ring1','ring2'].includes(slot) ? 'ring' : slot;
            //Create an array for all viable objectives for this slot
            let itemOptions = [];
            for(let item of Object.values(gameObjects['items'])){
                //Skip if the wrong type or too high a level
                if(item.type != typeNeeded) continue;
                if(item.level > this.level) continue;
                //If it's valid, check if we already have one and equip if so
                if(this.inventory[item.code]){
                    this.equip(item.code);
                    itemOptions = [];
                    break;
                }
                //If not, add it to the list of options
                itemOptions.push(item);
            }
            //If we didn't find any options, move on
            if(!itemOptions.length) continue;
            //Otherwise, pick a random one and set it as our objective
            let pick = itemOptions[Math.floor(Math.random() * itemOptions.length)];
            this.objective = {
                type:'get',
                target:pick,
                quantity:1
            };
            return;
        }
    }
    //If we have all the items we need, make sure our health is full before moving on

    //If our health is full, work on our task or get one if we need
    this.objective = {
        type:'get',
        target:'task'
    }
}

//Gets all subjobs that need done to fulfill the main job
Character.prototype.getJobs = function(parentJob,gameObjects){
    //console.log("Getting jobs!")
    let {target, type, quantity} = parentJob;
    let targetName = target.code
    //Objective is to acquire something
    if(type == 'get'){
        //console.log("Job is to get something")
        //If we already have the item, then no job is needed
        if(this.inventory[targetName] && this.inventory[targetName].quantity >= quantity){
            //console.log("Already got it!")
            return;
        }
        //See if it's a craftable item
        if(target.craft && target.craft.skill){
            //console.log("Crafting job!")
            //Add a craft job
            let craftJob = {
                type:'craft',
                target:target,
                quantity:quantity
            }
            this.jobs.unshift(craftJob);
            //Add all components as get jobs
            for(let component of target.craft.items){
                //console.log("Adding",JSON.stringify(component))
                let getJob = {
                    type:'get',
                    target:gameObjects.items[component.code],
                    quantity:component.quantity * quantity //We need components for each unit in the parent job
                }
                //console.log("Inserting",JSON.stringify(getJob))
                this.jobs.unshift(getJob);
                //Get all subjobs for the new job
                this.getJobs(getJob,gameObjects);
            }
            return;
        }
        //If not, see if it's a resource we need to gather
        if(target.type == 'resource'){
            //console.log("Get a resource")
            //See if it's a monster drop by checking for the subtype in skills
            if(!SKILLS.includes(target.subtype)){
                //console.log("Monster drop!")
                //Find the monster that gives our drop
                let targetMonster;
                let droprate = 0;
                for(let monster of Object.values(gameObjects.monsters)){
                    for(let drop of monster.drops){
                        if(drop.code == targetName){
                            droprate = drop.rate;
                            targetMonster = monster;
                        }
                    }
                }
                this.jobs.unshift({
                    type:'kill',
                    target:targetMonster,
                    quantity:quantity*droprate
                });
            }
            //If not a monster drop, add a harvest job
            this.jobs.unshift({
                type:'harvest',
                target:target,
                quantity:quantity
            });
            //See if our skill is high enough to gather it, return if so

            if(target.level <= this.skills[target.subtype].level) return;
            //If it isn't, add a training job
            //Add a harvest job
            this.jobs.unshift({
                type:'train',
                target:target.subtype,
                quantity:target.level
            });
            return;
        }
        console.log("End of job check for",JSON.stringify(parentJob))
    }
}

module.exports = Character;