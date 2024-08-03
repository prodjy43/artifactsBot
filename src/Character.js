import chalk from "chalk";
import gameAPI from "./gameAPI.js";
import {
  AUTH_TOKEN,
  SKILLS,
  INVENTORY_SLOTS,
  INVENTORY_MAX_ITEMS,
} from "./constants.js";

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

Character.prototype.move = async function (x, y) {
  const headers = { Authorization: this.authorization };
  const data = { x, y };
  const endpoint = `/my/${encodeURIComponent(this.name)}/action/move`;
  return gameAPI.callAPI(endpoint, "POST", headers, data);
};

Character.prototype.fight = async function () {
  const headers = { Authorization: this.authorization };
  const endpoint = `/my/${encodeURIComponent(this.name)}/action/fight`;
  return gameAPI.callAPI(endpoint, "POST", headers, null);
};

Character.prototype.harvest = async function () {
  const headers = { Authorization: this.authorization };
  const endpoint = `/my/${encodeURIComponent(this.name)}/action/gathering`;
  return gameAPI.callAPI(endpoint, "POST", headers, null);
};

Character.prototype.craft = async function (code, quantity) {
  const headers = { Authorization: this.authorization };
  const data = { code, quantity };
  const endpoint = `/my/${encodeURIComponent(this.name)}/action/crafting`;
  return gameAPI.callAPI(endpoint, "POST", headers, data);
};
Character.prototype.equipItem = async function (code, slot) {
  const headers = { Authorization: this.authorization };
  const data = { code, slot };
  const endpoint = `/my/${encodeURIComponent(this.name)}/action/equip`;
  return gameAPI.callAPI(endpoint, "POST", headers, data);
};
Character.prototype.unequipItem = async function (slot) {
  const headers = { Authorization: this.authorization };
  const data = { slot };
  const endpoint = `/my/${encodeURIComponent(this.name)}/action/unequip`;
  return gameAPI.callAPI(endpoint, "POST", headers, data);
};
Character.prototype.getTask = async function () {
  const headers = { Authorization: this.authorization };
  const params = { name: this.name };
  const endpoint = `/my/${encodeURIComponent(this.name)}/action/task/new`;
  return gameAPI.callAPI(endpoint, "POST", headers, null, params);
};

Character.prototype.setData = function (data) {
  if (this.cooldown_expiration) {
  }
  for (let key in data) {
    let keySplit = key.split("_");

    if (keySplit[0] == "task") {
      continue;
    } else if (
      keySplit[keySplit.length - 1] == "slot" &&
      ![
        "consumable2",
        "consumable1",
        "artifact1",
        "artifact2",
        "artifact3",
      ].includes(keySplit[0])
    ) {
      let gearSlot = keySplit.slice(0, -1).join("_");
      this.gear[gearSlot] = data[key];
    } else if (SKILLS.includes(keySplit[0])) {
      if (!this.skills[keySplit[0]]) {
        this.skills[keySplit[0]] = {};
      }

      const attribute = keySplit.slice(1).join("_");
      this.skills[keySplit[0]][attribute] = data[key];
    } else {
      this[key] = data[key];
    }
  }

  this.task = {
    target: data["task"],
    type: data["task_type"],
    progress: data["task_progress"],
    total: data["task_total"],
  };
};

Character.prototype.getObjective = async function (gameObjects) {
  let gearKeys = Object.keys(this.gear);
  let currentIndex = gearKeys.length;

  while (currentIndex != 0) {
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [gearKeys[currentIndex], gearKeys[randomIndex]] = [
      gearKeys[randomIndex],
      gearKeys[currentIndex],
    ];
  }

  for (let slot of gearKeys) {
    let item = this.gear[slot];
    console.log(chalk.blue("Checking"), slot, chalk.green("found"), item);

    if (!item || item == "wooden_stick") {
      console.log(chalk.red("Need equipment"));

      let typeNeeded = ["ring1", "ring2"].includes(slot) ? "ring" : slot;

      let itemOptions = [];
      let inventoryItems = this.inventory.map((slot) => slot.code);
      for (let item of Object.values(gameObjects["items"])) {
        if (item.type != typeNeeded) continue;
        if (item.level > this.level) continue;
        if (item.code == "wooden_stick") continue;

        if (inventoryItems.includes(item.code)) {
          await this.equip(item);
          break;
        }

        itemOptions.push(item);
      }

      if (!itemOptions.length) continue;

      let pick = itemOptions[Math.floor(Math.random() * itemOptions.length)];
      this.objective = {
        type: "get",
        target: pick,
        quantity: 1,
      };
      return;
    }
  }

  console.log(chalk.yellow("Check for task"), this.task);
  if (!this.task.target) {
    console.log(chalk.red("No task"));
    this.objective = {
      type: "get",
      target: "task",
    };
  } else {
    console.log(chalk.green("Have a task"), this.task);
    this.objective = {
      type: "complete",
      target: "task",
    };
  }
};

Character.prototype.getJobs = function (parentJob, gameObjects, gameMap) {
  let { target, type, quantity } = parentJob;
  let targetCode = target.code;

  if (type == "get") {
    let invTotal = 0;
    for (let slot of this.inventory) {
      if (slot.code == targetCode) {
        invTotal += slot.quantity;
      }
    }
    if (invTotal >= quantity) {
      return;
    }

    if (target.craft && target.craft.skill) {
      let craftJob = {
        type: "craft",
        target: target,
        quantity: quantity,
      };
      this.jobs.unshift(craftJob);
      this.getJobs(craftJob, gameObjects, gameMap);
      return;
    }

    if (target.type == "resource") {
      if (!SKILLS.includes(target.subtype)) {
        let targetMonster;
        let dropQuantity = 0;
        for (let monster of Object.values(gameObjects.monsters)) {
          for (let drop of monster.drops) {
            if (drop.code == targetCode) {
              targetMonster = monster;
              dropQuantity = {
                min_quantity: drop.min_quantity,
                max_quantity: drop.max_quantity,
              };
            }
          }
        }

        this.jobs.unshift({
          type: "kill",
          target: targetMonster,
          dropTarget: target,
          quantity: quantity,
          dropQuantity: dropQuantity,
        });
      }

      let targetResource;
      let dropQuantity = 0;
      for (let source of Object.values(gameObjects.resources)) {
        for (let drop of source.drops) {
          if (drop.code == targetCode) {
            if (!targetResource || targetResource.level > source.level) {
              targetResource = source;
              dropQuantity = {
                min_quantity: drop.min_quantity,
                max_quantity: drop.max_quantity,
              };
            }
            break;
          }
        }
      }

      let harvJob = {
        type: "harvest",
        target: targetResource,
        dropTarget: target,
        quantity: quantity,
        dropQuantity: dropQuantity,
      };
      this.jobs.unshift(harvJob);
      this.getJobs(harvJob, gameObjects, gameMap);
      return;
    }

    if (target == "task") {
      let taskType = "monsters";

      let claimJob = {
        type: "request",
        target: "task",
        quantity: null,
      };
      this.jobs.unshift(claimJob);

      let locations = gameObjects.tasks_masters[taskType].locations;
      let moveTarget = this.getClosestPosition(locations);
      let moveJob = {
        type: "move",
        target: moveTarget.closestSpot,
        quantity: moveTarget.closestDist,
      };
      this.jobs.unshift(moveJob);
      return;
    }

    console.log(chalk.red(this.name), "job has no viable actions:", parentJob);
    return;
  }

  if (type == "harvest") {
    let locations = [];
    for (let source of Object.values(gameObjects.resources)) {
      if (source.code == target.code) {
        locations.push(...source.locations);
      }
    }

    if (!locations.length) {
      console.log(chalk.red(this.name), "has no locations for job:", parentJob);
      return;
    }
    let moveTarget = this.getClosestPosition(locations);
    let moveJob = {
      type: "move",
      target: moveTarget.closestSpot,
      quantity: moveTarget.closestDist,
    };
    this.jobs.unshift(moveJob);

    if (target.level <= this.skills[target.skill].level) return;
    let trainJob = {
      type: "train",
      target: target.skill,
      quantity: target.level,
    };
    this.jobs.unshift(trainJob);
    this.getJobs(trainJob, gameObjects, gameMap);
    return;
  }
  if (type == "craft") {
    let locations = gameObjects.workshops[target.craft.skill].locations;

    if (!locations.length) {
      console.log(chalk.red(this.name), "has no locations for job:", parentJob);
      return;
    }
    let moveTarget = this.getClosestPosition(locations);
    let moveJob = {
      type: "move",
      target: moveTarget.closestSpot,
      quantity: moveTarget.closestDist,
    };
    this.jobs.unshift(moveJob);

    for (let component of target.craft.items) {
      let getJob = {
        type: "get",
        target: gameObjects.items[component.code],
        quantity: component.quantity * quantity,
      };

      this.jobs.unshift(getJob);

      this.getJobs(getJob, gameObjects, gameMap);
    }

    if (target.craft.level <= this.skills[target.craft.skill].level) return;
    let trainJob = {
      type: "train",
      target: target.craft.skill,
      quantity: target.craft.level,
    };
    this.jobs.unshift(trainJob);
    this.getJobs(trainJob, gameObjects, gameMap);
  }
  if (type == "complete") {
    if (target == "task") {
      let task = this.task;
      if (task.type == "monsters") {
        let killJob = {
          type: "kill",
          target: gameObjects.monsters[task.target],
          quantity: task.total,
        };
        this.jobs.unshift(killJob);
        this.getJobs(killJob, gameObjects, gameMap);
      }
      return;
    }
  }
  if (type == "kill") {
    let task = this.task;
    let killTarget = this.getClosestPosition(
      gameObjects.monsters[task.target].locations
    );
    let moveJob = {
      type: "move",
      target: killTarget.closestSpot,
      quantity: killTarget.closestDist,
    };
    this.jobs.unshift(moveJob);
  }
};

Character.prototype.getClosestPosition = function (positions) {
  let closestSpot;
  let closestDist = Infinity;
  for (let spot of positions) {
    let [x, y] = spot.split(",").map(Number);
    let spotDist = getDistance(this.x, this.y, x, y);
    if (spotDist < closestDist) {
      closestDist = spotDist;
      closestSpot = spot;
    }
  }

  function getDistance(x1, y1, x2, y2) {
    return Math.round(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)));
  }

  return { closestSpot: closestSpot, closestDist: closestDist };
};

Character.prototype.executeJob = async function (gameObjects, gameMap) {
  let job = this.jobs[0];
  console.log(
    chalk.blue(`${this.name}`) +
      " executing job:" +
      chalk.green(`${job.type}`) +
      (job.quantity ? ` ${chalk.yellow(job.quantity)}` : "") +
      (job.type == "move"
        ? ` ${chalk.cyan(job.target)}`
        : ` ${chalk.cyan(job.target.name)}`)
  );
  if (job.type == "move") {
    let [x, y] = job.target.split(",").map(Number);

    if (this.x == x && this.y == y) {
      this.completeJob();
      return;
    }

    let moveResponse = await this.move(x, y);

    this.setData(moveResponse.data.character);
    return;
  }
  if (job.type == "request") {
    if (this.task.target) {
      this.completeJob();
      return;
    }
    console.log(chalk.magenta("Request job found:"), job);
    if (job.target == "task") {
      this.getTask();
      this.completeJob();
    }
  }
  if (job.type == "harvest") {
    let totalHarvested = 0;
    let totalItems = 0;
    let fullSlots = 0;
    for (let slot of this.inventory) {
      if (slot.code == job.dropTarget.code) totalHarvested += slot.quantity;
      totalItems += slot.quantity;
      if (slot.quantity > 0) fullSlots++;
    }
    if (totalHarvested >= job.quantity) {
      this.completeJob();
      return;
    }

    if (
      totalItems + job.dropQuantity.max_quantity > INVENTORY_MAX_ITEMS ||
      (fullSlots == INVENTORY_SLOTS && totalCrafted == 0)
    ) {
      let depositJob = {
        type: "deposit",
        target: job.dropTarget,
        quantity: job.quantity,
      };

      this.jobs.unshift(depositJob);

      this.getJobs(depositJob, gameObjects, gameMap);
      return;
    }
    let harvResponse = await this.harvest();
    this.setData(harvResponse.data.character);
    return;
  }
  if (job.type == "craft") {
    let totalCrafted = 0;
    let totalItems = 0;
    let fullSlots = 0;

    let craftItems = {};
    for (let component of job.target.craft.items) {
      craftItems[component.code] = { need: component.quantity, have: 0 };
    }
    for (let slot of this.inventory) {
      if (slot.code == job.target.code) totalCrafted += slot.quantity;
      totalItems += slot.quantity;
      if (slot.quantity > 0) fullSlots++;
      if (craftItems[slot.code]) craftItems[slot.code].have += slot.quantity;
    }
    if (totalCrafted >= job.quantity) {
      this.completeJob();
      return;
    }

    console.log(chalk.magenta("Craft items:"), craftItems);
    for (let values of Object.values(craftItems)) {
      if (values.need > values.have) {
        this.getJobs(job, gameObjects, gameMap);
        return;
      }
    }

    if (
      totalItems + job.target.craft.quantity > INVENTORY_MAX_ITEMS ||
      (fullSlots == INVENTORY_SLOTS && totalCrafted == 0)
    ) {
      let depositJob = {
        type: "deposit",
        target: job.target,
        quantity: job.quantity,
      };

      this.jobs.unshift(depositJob);

      this.getJobs(depositJob, gameObjects, gameMap);
      return;
    }

    let craftResponse = await this.craft(
      job.target.code,
      job.quantity - totalCrafted
    );
    this.setData(craftResponse.data.character);
    return;
  }
  if (job.type == "get") {
    if (job.target == "task") {
      if (this.task) {
        console.log("Already have task", this.task);
        this.completeJob();
      } else {
        let taskResponse = this.getTask();
        this.setData(taskResponse.data.character);
      }
      return;
    }

    let totalHeld = 0;
    for (let slot of this.inventory) {
      if (slot.code == job.target.code) totalHeld += slot.quantity;
    }
    if (totalHeld >= job.quantity) {
      this.completeJob();
      return;
    }

    this.getJobs(job, gameObjects, gameMap);
    return;
  }
  if (job.type == "kill") {
    if (job.quantity == 0) {
      this.completeJob();
      return;
    }

    let totalItems = 0;
    let fullSlots = 0;
    for (let slot of this.inventory) {
      totalItems += slot.quantity;
      if (slot.quantity > 0) fullSlots++;
    }
    if (fullSlots == INVENTORY_SLOTS || totalItems == INVENTORY_MAX_ITEMS) {
      let depositJob = {
        type: "deposit",
        target: job.target,
        quantity: job.quantity,
      };

      this.jobs.unshift(depositJob);

      this.getJobs(depositJob, gameObjects, gameMap);
      return;
    }
    let fightResponse = await this.fight();
    this.setData(fightResponse.data.character);
    job.quantity--;
    return;
  }
};

Character.prototype.equip = async function (item, slot = "none") {
  if (slot == "none") {
    if (item.type == "ring") {
      if (!this.gear.ring1) {
        slot = "ring1";
      } else {
        slot = "ring2";
      }
    } else {
      slot = item.type;
    }
  }
  console.log(
    chalk.blue(this.name),
    chalk.green("equipping"),
    chalk.yellow(item.code),
    chalk.green("to slot"),
    chalk.yellow(slot)
  );

  if (this.gear[slot]) {
    await this.unequipItem(slot);
    return;
  }
  let equipResponse = await this.equipItem(item.code, slot);
  this.setData(equipResponse.data.character);
};

Character.prototype.completeJob = function () {
  this.jobs.shift();
};

export default Character;
