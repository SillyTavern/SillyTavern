const poe = require('./src/poe-client');

async function test() {
    const client = new poe.Client();
    await client.init('pb-cookie');

    const bots = client.get_bot_names();
    console.log(bots);

    await client.purge_conversation('a2', -1);

    let reply;
    for await (const mes of client.send_message('a2', 'Hello')) {
        reply = mes.text;
    }

    console.log(reply);
    client.disconnect_ws();
}

test();
