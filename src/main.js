import Character from "./Character.js";
import Game from "./Game.js";
import chalk from "chalk";

let gameObjects = {};
let gameMap = {};
let characters;

async function gameLoop() {
  while (true) {
    let now = new Date();

    for (let char of characters) {
      if (!char.jobs || !char.jobs.length || !char.objective) {
        await char.getObjective(gameObjects);
        char.getJobs(char.objective, gameObjects);
        console.log(
          chalk.blue(`${char.name}`) +
            " has primary objective: " +
            chalk.green(`${char.objective.type}`) +
            (char.objective == "task"
              ? " new task"
              : ` ${chalk.yellow(char.objective.quantity)} ${chalk.cyan(
                  char.objective.target.name
                )}`)
        );
        console.log(chalk.magenta("Subtasks:"));
        for (let i = 0; i <= char.jobs.length - 1; i++) {
          let job = char.jobs[i];
          console.log(
            chalk.red(`Job ${i + 1}:`) +
              " " +
              chalk.green(`${job.type}`) +
              (job.quantity ? ` ${chalk.yellow(job.quantity)}` : "") +
              (job.type == "move"
                ? ` ${chalk.cyan(job.target)}`
                : ` ${chalk.cyan(job.target.name)}`)
          );
        }
      }

      let charCooldown = new Date(char.cooldown_expiration);
      if (charCooldown - now > 0) continue;

      await char.executeJob(gameObjects, gameMap);
    }
    let minCooldown = Math.min(
      ...characters.map((char) => {
        let cooldownExpiration = new Date(char.cooldown_expiration);
        let timeDiff = cooldownExpiration - now;
        return timeDiff > 0 ? timeDiff : 0;
      })
    );

    await new Promise((resolve) => setTimeout(resolve, minCooldown));
  }
}

async function main() {
  let apiResponse = await Game.getMyCharacters();
  characters = apiResponse.data.map((data) => new Character(data));

  for (let each of ["monsters", "items", "resources"]) {
    apiResponse = await Game.getAll(each);
    gameObjects[each] = bucketByCode(apiResponse.data);
  }

  apiResponse = await Game.getAll("maps");
  for (let spot of apiResponse.data) {
    if (spot.content) {
      let spotType = spot.content.type + "s";
      let spotCode = spot.content.code;
      console.log(chalk.magenta(spotType));

      if (!gameObjects[spotType]) gameObjects[spotType] = {};

      if (!gameObjects[spotType][spotCode])
        gameObjects[spotType][spotCode] = {};
      gameObjects[spotType][spotCode].locations =
        gameObjects[spotType][spotCode].locations || [];
      gameObjects[spotType][spotCode].locations.push(`${spot.x},${spot.y}`);
    }
    let key = `${(spot.x, spot.y)}`;
    gameMap[key] = spot;
  }

  gameLoop();
}

function bucketByCode(list) {
  let returnObj = {};
  for (let item of list) {
    returnObj[item.code] = item;
  }
  return returnObj;
}

main();
