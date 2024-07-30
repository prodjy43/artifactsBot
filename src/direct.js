//Directly control from the terminal for testing

const Character = require('./Character');

function parseArgs() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log("Usage: node manualTest.js <characterName> <action> [params]");
        process.exit(1);
    }
    return args;
}

async function performAction() {
    const [characterName, action, ...params] = parseArgs();
    const character = new Character(characterName, 'Bearer your_token_here');

    try {
        switch (action) {
            case 'move':
                if (params.length !== 2) {
                    console.log("Usage for move: x y");
                    return;
                }
                await character.move(...params.map(Number));
                break;
            case 'fight':
                await character.fight();
                break;
            default:
                console.log("Unknown action. Valid actions are: move, fight");
        }
    } catch (error) {
        console.error('Action failed:', error);
    }
}