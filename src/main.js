const Character = require('./Character');
const Game = require('./Game');



function gameLoop() {
    setInterval(() => {
        characters.forEach(character => {
            if (Math.random() > 0.5) {
                randomMove(character);
            } else {
                randomFight(character);
            }
        });
    }, 3000);
}



async function main(){
    //Create our main reference for game objects and the game map
    let gameObjects = {};
    let gameMap = {};
    let characters =[];
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
    characters[0].getObjective()
    //gameLoop();
}

function bucketByCode(list){
    let returnObj = {};
    for(let item of list){
        returnObj[item.code] = returnObj[item.code] || [];
        returnObj[item.code].push(item)
    }
    return returnObj;
}

main();