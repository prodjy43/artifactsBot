const Character = require('./Character');
const Game = require('./Game');

//Primary objects
let gameObjects = {};
let gameMap = {};
let characters;

//Primary game loop
async function gameLoop() {
    while (true) {
        //Perform actions for each character
        let chCount = 1;
        for(let char of characters){
            if(char.cooldown) continue;
            if(!char.objective) char.getObjective(gameObjects);
            if(!char.jobs || !char.jobs.length) char.getJobs(char.objective,gameObjects);
            if(chCount > 1) console.log('-------------------------------------------------------------------------------')
            console.log(`${char.name} has primary objective: ${char.objective.type} ${char.objective.quantity} ${char.objective.target.name}`);
            console.log("Subtasks:");
            for (let i = 0; i <= char.jobs.length - 1; i++) {
                let job = char.jobs[i];
                console.log(`Job ${i+1}: ${job.type} ${job.quantity} ${job.target.name}`);
            }
            chCount++;
        }
        //Get minimum cooldown for our delay
        let minCooldown = Math.min(...characters.map(char => char.cooldown));
        //console.log(`Minimum cooldown is ${minCooldown}`)
        process.exit()
        //Wait as long as we need for the cooldown
        await new Promise(resolve => setTimeout(resolve, minCooldown));

        console.log(`Waiting for ${minCooldown} ms before next iteration`);
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
    //Gather map data
    apiResponse = await Game.getAll('maps');
    for(let spot of apiResponse.data){
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