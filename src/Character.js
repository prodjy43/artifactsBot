const gameAPI = require('./gameAPI');
const {AUTH_TOKEN,SKILLS,INVENTORY_SLOTS,INVENTORY_MAX_ITEMS}  = require('./constants');
const jobNameRef = {
    'Amos':'miner',
    'Philip':'woodcutter'
}

//Character prototype to handle actions and tracking information
function Character(data) {
    this.authorization = AUTH_TOKEN;
    this.skills = {};
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

Character.prototype.harvest = async function () {
    const headers = { Authorization: this.authorization };
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/gathering`;
    return gameAPI.callAPI(endpoint, 'POST', headers, null);
};

Character.prototype.craft = async function (code,quantity) {
    const headers = { Authorization: this.authorization };
    const data = {code,quantity};
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/crafting`;
    return gameAPI.callAPI(endpoint, 'POST', headers, data);
};
Character.prototype.equipItem = async function (code,slot) {
    const headers = { Authorization: this.authorization };
    const data = {code,slot};
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/equip`;
    return gameAPI.callAPI(endpoint, 'POST', headers, data);
};
Character.prototype.unequipItem = async function (slot) {
    const headers = { Authorization: this.authorization };
    const data = {slot};
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/unequip`;
    return gameAPI.callAPI(endpoint, 'POST', headers, data);
};
Character.prototype.getTask = async function () {
    const headers = { Authorization: this.authorization };
    const params = {name:this.name};
    const endpoint = `/my/${encodeURIComponent(this.name)}/action/task/new`;
    return gameAPI.callAPI(endpoint, 'POST', headers, null,params);
};

//Character Data
Character.prototype.setData = function(data){
    if(this.cooldown_expiration){
        //console.log(this.name,"old expiratoin",new Date(this.cooldown_expiration));
        //console.log(this.name,"new expiration",new Date(data.cooldown_expiration))
    }
    for (let key in data) {
        let keySplit = key.split('_');

        if(keySplit[0] == 'task'){
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

    //Set up task object if needed
    this.task = {
        target: data['task'],
        type: data['task_type'],
        progress: data['task_progress'],
        total: data['task_total']
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
Character.prototype.getObjective = async function(gameObjects){
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
        console.log("Checking",slot,"found",item)
        //If we're missing an item, our goal is to fill that item slot if we can
        //Extra check for the starter stick because it's awful
        if(!item || item == 'wooden_stick'){
            console.log("Need equipment")
            //Set the specific type we need, to make sure we get the rings as well
            let typeNeeded = ['ring1','ring2'].includes(slot) ? 'ring' : slot;
            //Create an array for all viable objectives for this slot
            let itemOptions = [];
            let inventoryItems = this.inventory.map(slot => slot.code);
            for(let item of Object.values(gameObjects['items'])){
                //Skip if the wrong type or too high a level or a stick
                if(item.type != typeNeeded) continue;
                if(item.level > this.level) continue;
                if(item.code == 'wooden_stick') continue;
                //console.log("Checking item",item)
                //If it's valid, check if we already have one and equip if so
                if(inventoryItems.includes(item.code)){
                    //console.log("Equipping item",item)
                    await this.equip(item);
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
    console.log("Check for task",this.task)
    if(!this.task.target){
        console.log("No task")
        this.objective = {
            type:'get',
            target:'task'
        }
    }else{
        console.log("Have a task",this.task)
        this.objective = {
            type:'complete',
            target:'task'
        }
    }
    
}

//Gets all subjobs that need done to fulfill the main job
Character.prototype.getJobs = function(parentJob,gameObjects,gameMap){
    //console.log("Getting jobs!")
    let {target, type, quantity} = parentJob;
    let targetCode = target.code
    //Objective is to acquire something
    if(type == 'get'){
        //console.log("Job is to get something")
        //If we already have the item, then no job is needed
        let invTotal = 0;
        for(let slot of this.inventory){
            if(slot.code == targetCode){
                invTotal += slot.quantity;
            }
        }
        if(invTotal >= quantity){
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
            this.getJobs(craftJob,gameObjects,gameMap);
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
                let dropQuantity = 0;
                for(let monster of Object.values(gameObjects.monsters)){
                    for(let drop of monster.drops){
                        if(drop.code == targetCode){
                            targetMonster = monster;
                            dropQuantity = {min_quantity:drop.min_quantity,max_quantity:drop.max_quantity}
                        }
                    }
                }
                
                this.jobs.unshift({
                    type:'kill',
                    target:targetMonster,
                    dropTarget:target,
                    quantity:quantity,
                    dropQuantity:dropQuantity
                });
            }
            //If not a monster drop, add a harvest job and get subtasks for it
            //Get the resource for this job
            let targetResource;
            let dropQuantity = 0;
            for(let source of Object.values(gameObjects.resources)){
                for(let drop of source.drops){
                    //If one of the resource drops is our target, if it's a lower level than an existing target, record it and break
                    if(drop.code == targetCode){
                        if(!targetResource || targetResource.level > source.level){
                            targetResource = source;
                            dropQuantity = {min_quantity:drop.min_quantity,max_quantity:drop.max_quantity}
                        }
                        break;
                    }
                }
            }
            
            let harvJob = {
                type:'harvest',
                target:targetResource,
                dropTarget:target,
                quantity:quantity,
                dropQuantity:dropQuantity
            };
            this.jobs.unshift(harvJob);
            this.getJobs(harvJob,gameObjects,gameMap);
            return;
        }

        if(target == 'task'){
            //Pick what kind of task, for now there's only one
            let taskType = 'monsters';
            //Submit claim job
            let claimJob = {
                type:'request',
                target:'task',
                quantity:null
            };
            this.jobs.unshift(claimJob)
            //Submit move job for the taskmaster
            //console.log(JSON.stringify(gameObjects))
            let locations = gameObjects.tasks_masters[taskType].locations;
            let moveTarget = this.getClosestPosition(locations);
            let moveJob = {
                type:'move',
                target:moveTarget.closestSpot,
                quantity:moveTarget.closestDist
            };
            this.jobs.unshift(moveJob)
            return;
        }

        console.log(this.name,"job has no viable actions:",parentJob);
        return;
        
    }
    //Objective is to harvest something
    if(type == 'harvest'){
        //Get all resource locations
        let locations = [];
        for(let source of Object.values(gameObjects.resources)){
            if(source.code == target.code){
                locations.push(...source.locations);
            }
        }
        //If we have locations, add a move job, otherwise error and return
        if(!locations.length){
            console.log(this.name,"has no locations for job:",parentJob);
            return;
        }
        let moveTarget = this.getClosestPosition(locations);
        let moveJob = {
            type:'move',
            target:moveTarget.closestSpot,
            quantity:moveTarget.closestDist
        };
        this.jobs.unshift(moveJob)
        //Also see if we have the level to harvest this, if not we add a train job, otherwise return
        if(target.level <= this.skills[target.skill].level) return;
        let trainJob = {
            type:'train',
            target:target.skill,
            quantity:target.level
        };
        this.jobs.unshift(trainJob);
        this.getJobs(trainJob,gameObjects,gameMap);
        return;
    }
    if(type == 'craft'){
        //Add travel job
        let locations = gameObjects.workshops[target.craft.skill].locations;
        //If we have locations, add a move job, otherwise error and return
        if(!locations.length){
            console.log(this.name,"has no locations for job:",parentJob);
            return;
        }
        let moveTarget = this.getClosestPosition(locations);
        let moveJob = {
            type:'move',
            target:moveTarget.closestSpot,
            quantity:moveTarget.closestDist
        };
        this.jobs.unshift(moveJob);
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
            this.getJobs(getJob,gameObjects,gameMap);
        }
        //If we have the level for this craft then return, else add a train job
        if(target.craft.level <= this.skills[target.craft.skill].level) return;
        let trainJob = {
            type:'train',
            target:target.craft.skill,
            quantity:target.craft.level
        };
        this.jobs.unshift(trainJob);
        this.getJobs(trainJob,gameObjects,gameMap);
    }
    if(type == 'complete'){
        //If it's a task
        if(target == 'task'){
            //Set jobs based on task type
            let task = this.task;
            if(task.type == 'monsters'){
                //Set kill job
                let killJob = {
                    type:'kill',
                    target:gameObjects.monsters[task.target],
                    quantity:task.total
                };
                this.jobs.unshift(killJob);
                this.getJobs(killJob,gameObjects,gameMap);
            }
            return;
        }
    }
    if(type == 'kill'){
        //Set up move job
        let task = this.task;
        let killTarget = this.getClosestPosition(gameObjects.monsters[task.target].locations);
        let moveJob = {
            type:'move',
            target:killTarget.closestSpot,
            quantity:killTarget.closestDist
        };
        this.jobs.unshift(moveJob);
    }
}

Character.prototype.getClosestPosition = function(positions){
    let closestSpot;
    let closestDist = Infinity;
    for(let spot of positions){
        let [x, y] = spot.split(',').map(Number);
        let spotDist = getDistance(this.x,this.y,x,y);
        if(spotDist < closestDist){
            closestDist = spotDist;
            closestSpot = spot;
        }
    }

    function getDistance(x1, y1, x2, y2) {
        return Math.round(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)));
        //return Math.abs(x2 - x1) + Math.abs(y2 - y1);
    }
    
    return {closestSpot:closestSpot,closestDist:closestDist};
}

//Executes current job
Character.prototype.executeJob = async function(gameObjects,gameMap){
    let job = this.jobs[0];
    console.log(`${this.name} executing job:${job.type} ${job.quantity ? job.quantity : ''} ${job.type == 'move' ? job.target : job.target.name}`)
    if(job.type == 'move'){
        let [x,y] = job.target.split(',').map(Number);
        //If we're there, complete and move on to the next job
        if(this.x == x && this.y == y){
            //console.log("Already here at",x,y)
            this.completeJob();
            return;
        }
        //Otherwise, move to the target
        let moveResponse = await this.move(x,y);
        //Update character data
        this.setData(moveResponse.data.character);
        return;
    }
    if(job.type == 'request'){
        //See if we have a task, complete if so
        if(this.task.target){
            this.completeJob();
            return;
        }
        console.log("Request job found:",job)
        if(job.target == 'task'){
            this.getTask();
            this.completeJob();
        }

    }
    if(job.type == 'harvest'){
        //Check if we've harvested our goal
        let totalHarvested = 0;
        let totalItems = 0;
        let fullSlots = 0;
        for(let slot of this.inventory){
            if(slot.code == job.dropTarget.code) totalHarvested += slot.quantity;
            totalItems += slot.quantity;
            if(slot.quantity > 0) fullSlots++;
        }
        if(totalHarvested >= job.quantity){
            this.completeJob();
            return;
        }
        //If not, at some point we should make sure there's actually a resource here.
        //Check if inventory is full/no slots
        if(totalItems + job.dropQuantity.max_quantity > INVENTORY_MAX_ITEMS || (fullSlots == INVENTORY_SLOTS && totalCrafted == 0)){
            let depositJob = {
                type:'deposit',
                target:job.dropTarget,
                quantity:job.quantity
            }
            //console.log("Inserting",JSON.stringify(getJob))
            this.jobs.unshift(depositJob);
            //Get all subjobs for the new job
            this.getJobs(depositJob,gameObjects,gameMap);
            return;
        }
        let harvResponse = await this.harvest();
        this.setData(harvResponse.data.character);
        return;
    }
    if(job.type == 'craft'){
        //Make sure we don't already have it and that we have the ingredients needed
        let totalCrafted = 0;
        let totalItems = 0;
        let fullSlots = 0;
        //Gather all the components
        let craftItems = {};
        for(let component of job.target.craft.items){
            craftItems[component.code] = {need:component.quantity,have:0};
        }
        for(let slot of this.inventory){
            if(slot.code == job.target.code) totalCrafted += slot.quantity;
            totalItems += slot.quantity;
            if(slot.quantity > 0) fullSlots++;
            if(craftItems[slot.code]) craftItems[slot.code].have += slot.quantity;
        }
        if(totalCrafted >= job.quantity){
            this.completeJob();
            console.log("Return4")
            return;
        }
        //See if we need more components, schedule jobs if so
        console.log("Craft items:",craftItems)
        for(let values of Object.values(craftItems)){
            if(values.need > values.have){
                this.getJobs(job,gameObjects,gameMap);
                console.log("Return1")
                return;
            }
        }
        //If not, at some point make sure there's a workshop here.
        //Check if our inventory is full or if we're out of slots, if so we need to deposit first
        if(totalItems + job.target.craft.quantity > INVENTORY_MAX_ITEMS || (fullSlots == INVENTORY_SLOTS && totalCrafted == 0)){
            let depositJob = {
                type:'deposit',
                target:job.target,
                quantity:job.quantity
            }
            //console.log("Inserting",JSON.stringify(getJob))
            this.jobs.unshift(depositJob);
            //Get all subjobs for the new job
            this.getJobs(depositJob,gameObjects,gameMap);
            console.log("Return2")
            return;
        }
        //Craft as many as we need, counting what we have
        let craftResponse = await this.craft(job.target.code,job.quantity-totalCrafted);
        this.setData(craftResponse.data.character);
        return;
    }
    if(job.type == 'get'){
        //See if it's a task and not an item
        if(job.target == 'task'){
            //If we already have one, complete the job
            if(this.task){
                console.log("Already have task",this.task)
                this.completeJob();
            }
            else{
                let taskResponse = this.getTask();
                this.setData(taskResponse.data.character);
            }
            return;
        }
        //Confirm we have it
        let totalHeld = 0;
        for(let slot of this.inventory){
            if(slot.code == job.target.code) totalHeld += slot.quantity;
        }
        if(totalHeld >= job.quantity){
            this.completeJob();
            return;
        }
        //Add bank check in here later on
        //For now just add jobs to get the remainder
        this.getJobs(job,gameObjects,gameMap);
        return;
    }
    if(job.type == 'kill'){
        //See if we're done
        if(job.quantity == 0){
            this.completeJob();
            return;
        }
        //No killing if we're full
        let totalItems = 0;
        let fullSlots = 0;
        for(let slot of this.inventory){
            totalItems += slot.quantity;
            if(slot.quantity > 0) fullSlots++;
        }
        if(fullSlots == INVENTORY_SLOTS || totalItems == INVENTORY_MAX_ITEMS){
            let depositJob = {
                type:'deposit',
                target:job.target,
                quantity:job.quantity
            }
            //console.log("Inserting",JSON.stringify(getJob))
            this.jobs.unshift(depositJob);
            //Get all subjobs for the new job
            this.getJobs(depositJob,gameObjects,gameMap);
            return;
        }
        let fightResponse = await this.fight();
        this.setData(fightResponse.data.character)
        job.quantity--;
        return;
    }
}

Character.prototype.equip = async function(item,slot='none'){
    //console.log("Equip requested for item",item)
    //If no slot, find an empty one
    if(slot == 'none'){
        if(item.type == 'ring'){
            if(!this.gear.ring1){
                slot = 'ring1';
            }
            else{
                slot = 'ring2';
            }
        }
        else{
            slot = item.type;
        }
    }
    console.log(this.name,"equipping",item.code,"to slot",slot)
    //Unequip if needed
    if(this.gear[slot]){
        await this.unequipItem(slot);
        return;
    }
    let equipResponse = await this.equipItem(item.code,slot);
    this.setData(equipResponse.data.character);
}

Character.prototype.completeJob = function(){
    this.jobs.shift();
}

module.exports = Character;