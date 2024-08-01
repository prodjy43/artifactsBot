const Character = require('./Character');
const Game = require('./Game');

//Primary objects
let gameObjects = {};
let gameMap = {};
let characters;
//Primary game loop
async function gameLoop() {
    //Game loop
    while (true) {
        //Get current datetime for cooldowns
        let now = new Date();
        //Perform actions for each character
        for(let char of characters){
            //Get objective/jobs if needed
            if(!char.jobs || !char.jobs.length || !char.objective){
                await char.getObjective(gameObjects);
                char.getJobs(char.objective,gameObjects);
                console.log(`${char.name} has primary objective: ${char.objective.type} ${char.objective == 'task' ? 'new' : char.objective.quantity} ${char.objective == 'task' ? 'task' : char.objective.target.name}`);
                console.log("Subtasks:");
                for (let i = 0; i <= char.jobs.length - 1; i++) {
                    let job = char.jobs[i];
                    console.log(`Job ${i+1}: ${job.type} ${job.quantity ? job.quantity : ''} ${job.type == 'move' ? job.target : job.target.name}`);
                }
            }

            //Execute current job if we're past the cooldown
            let charCooldown = new Date(char.cooldown_expiration);
            if(charCooldown - now > 0) continue;
            //console.log("Current datetime is",now)
            //console.log(char.name,"cooldown datetime is",charCooldown)
            //console.log("Difference is",charCooldown-now)
            //console.log("Greater than 0?",charCooldown-now>0)
            await char.executeJob(gameObjects,gameMap);
        }
        let minCooldown = Math.min(...characters.map(char => {
            let cooldownExpiration = new Date(char.cooldown_expiration);
            let timeDiff = cooldownExpiration - now;
            return timeDiff > 0 ? timeDiff : 0;
        }));
        //console.log(`Waiting for ${minCooldown} ms before next iteration`);
        //process.exit()
        //Wait as long as we need for the cooldown
        await new Promise(resolve => setTimeout(resolve, minCooldown));

        
    }
}

//Startup logic that only needs run once, then calls the game loop
async function main(){
    //Create our main reference for game objects and the game map
    //Get character data and create an array of Character instances for each
    let apiResponse = await Game.getMyCharacters();
    characters = apiResponse.data.map(data => new Character(data));
    //Bucket all monsters, items, and resources on the map by type
    for(let each of ['monsters','items','resources']){
        apiResponse = await Game.getAll(each);
        gameObjects[each] = bucketByCode(apiResponse.data);
    }
    //Gather map data, assign coordinates for resources and monsters in their respective arrays
    apiResponse = await Game.getAll('maps');
    for(let spot of apiResponse.data){
        if(spot.content){
            let spotType = spot.content.type+'s';
            let spotCode = spot.content.code;
            console.log(spotType)
            //Make sure the type exists first
            if(!gameObjects[spotType]) gameObjects[spotType] = {};
            //Make sure we have an entry for that object
            if(!gameObjects[spotType][spotCode])gameObjects[spotType][spotCode] = {}; 
            gameObjects[spotType][spotCode].locations = gameObjects[spotType][spotCode].locations || [];
            gameObjects[spotType][spotCode].locations.push(`${spot.x},${spot.y}`)
        }
        let key = `${spot.x,spot.y}`;
        gameMap[key] = spot;
    }
    //Begin running the game loop
    gameLoop();
}

function bucketByCode(list){
    let returnObj = {};
    for(let item of list){
        returnObj[item.code] = item;
    }
    return returnObj;
}

main();