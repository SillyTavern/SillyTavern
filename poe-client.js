/*
Adapted and rewritten to Node based on ading2210/poe-api

ading2210/poe-api: a reverse engineered Python API wrapper for Quora's Poe
Copyright (C) 2023 ading2210

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const parent_path = path.resolve(__dirname);
const queries_path = path.join(parent_path, "poe_graphql");
let queries = {};

const logger = console;

const user_agent = "Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0";

function load_queries() {
    const files = fs.readdirSync(queries_path);
    for (const filename of files) {
        const ext = path.extname(filename);
        if (ext !== '.graphql') {
            continue;
        }
        const queryName = path.basename(filename, ext);
        const query = fs.readFileSync(path.join(queries_path, filename), 'utf-8');
        queries[queryName] = query;
    }
}

function generate_payload(query_name, variables) {
    return {
        query: queries[query_name],
        variables: variables,
    }
}

async function request_with_retries(method, attempts = 10) {
    const url = '';
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await method();
            if (response.status === 200) {
                return response;
            }
            logger.warn(`Server returned a status code of ${response.status} while downloading ${url}. Retrying (${i + 1}/${attempts})...`);
        }
        catch (err) {
            console.log(err);
        }
    }
    throw new Error(`Failed to download ${url} too many times.`);
}

class Client {
    gql_url = "https://poe.com/api/gql_POST";
    gql_recv_url = "https://poe.com/api/receive_POST";
    home_url = "https://poe.com";
    settings_url = "https://poe.com/api/settings";

    formkey = "";
    next_data = {};
    bots = {};
    active_messages = {};
    message_queues = {};
    bot_names = [];
    ws = null;
    ws_connected = false;
    auto_reconnect = false;

    constructor(auto_reconnect = false) {
        this.auto_reconnect = auto_reconnect;
    }

    async init(token, proxy = null) {
        this.proxy = proxy;
        this.session = axios.default.create({
            timeout: 60000,
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
        });
        if (proxy) {
            this.session.defaults.proxy = {
                "http": proxy,
                "https": proxy,
            };
            logger.info(`Proxy enabled: ${proxy}`);
        }
        const cookies = `p-b=${token}; Domain=poe.com`;
        this.headers = {
            "User-Agent": user_agent,
            "Referrer": "https://poe.com/",
            "Origin": "https://poe.com",
            "Cookie": cookies,
        };
        this.ws_domain = `tch${Math.floor(Math.random() * 1e6)}`;
        this.session.defaults.headers.common = this.headers;
        this.next_data = await this.get_next_data();
        this.channel = await this.get_channel_data();
        await this.connect_ws();
        this.bots = await this.get_bots();
        this.bot_names = this.get_bot_names();
        this.gql_headers = {
            "poe-formkey": this.formkey,
            "poe-tchannel": this.channel["channel"],
            ...this.headers,
        };
        await this.subscribe();
    }

    async get_next_data() {
        logger.info('Downloading next_data...');

        const r = await request_with_retries(() => this.session.get(this.home_url));
        const jsonRegex = /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/;
        const jsonText = jsonRegex.exec(r.data)[1];
        const nextData = JSON.parse(jsonText);

        this.formkey = nextData.props.formkey;
        this.viewer = nextData.props.pageProps.payload.viewer;

        return nextData;
    }

    async get_bots() {
        const viewer = this.next_data.props.pageProps.payload.viewer;
        if (!viewer.availableBots) {
            throw new Error('Invalid token.');
        }
        const botList = viewer.availableBots;

        const bots = {};
        for (const bot of botList) {
            const url = `https://poe.com/_next/data/${this.next_data.buildId}/${bot.displayName.toLowerCase()}.json`;
            logger.info(`Downloading ${url}`);

            const r = await request_with_retries(() => this.session.get(url));

            const chatData = r.data.pageProps.payload.chatOfBotDisplayName;
            bots[chatData.defaultBotObject.nickname] = chatData;
        }

        return bots;
    }

    get_bot_names() {
        const botNames = {};
        for (const botNickname in this.bots) {
            const botObj = this.bots[botNickname].defaultBotObject;
            botNames[botNickname] = botObj.displayName;
        }
        return botNames;
    }

    async get_channel_data(channel = null) {
        logger.info('Downloading channel data...');
        const r = await request_with_retries(() => this.session.get(this.settings_url));
        const data = r.data;

        this.formkey = data.formkey;
        return data.tchannelData;
    }

    get_websocket_url(channel = null) {
        if (!channel) {
            channel = this.channel;
        }
        const query = `?min_seq=${channel.minSeq}&channel=${channel.channel}&hash=${channel.channelHash}`;
        return `wss://${this.ws_domain}.tch.${channel.baseHost}/up/${channel.boxName}/updates${query}`;
    }

    async send_query(queryName, variables) {
        for (let i = 0; i < 20; i++) {
            const payload = generate_payload(queryName, variables);
            const r = await request_with_retries(() => this.session.post(this.gql_url, payload, { headers: this.gql_headers }));
            if (!r.data.data) {
                logger.warn(`${queryName} returned an error: ${data.errors[0].message} | Retrying (${i + 1}/20)`);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                continue;
            }

            return r.data;
        }

        throw new Error(`${queryName} failed too many times.`);
    }

    async subscribe() {
        logger.info("Subscribing to mutations")
        await this.send_query("SubscriptionsMutation", {
            "subscriptions": [
                {
                    "subscriptionName": "messageAdded",
                    "query": queries["MessageAddedSubscription"]
                },
                {
                    "subscriptionName": "viewerStateUpdated",
                    "query": queries["ViewerStateUpdatedSubscription"]
                }
            ]
        });
    }

    ws_run_thread() {
        this.ws = new WebSocket(this.get_websocket_url(), {
            headers: {
                "User-Agent": user_agent
            },
            rejectUnauthorized: false
        });

        this.ws.on("open", () => {
            this.on_ws_connect(this.ws);
        });

        this.ws.on('message', (message) => {
            this.on_message(this.ws, message);
        });

        this.ws.on('close', () => {
            this.ws_connected = false;
        });

        this.ws.on('error', (error) => {
            this.on_ws_error(this.ws, error);
        });
    }

    async connect_ws() {
        this.ws_connected = false;
        this.ws_run_thread();
        while (!this.ws_connected) {
            await new Promise(resolve => setTimeout(() => { resolve() }, 10));
        }
    }

    disconnect_ws() {
        if (this.ws) {
            this.ws.close();
        }
        this.ws_connected = false;
    }

    on_ws_connect(ws) {
        this.ws_connected = true;
    }

    on_ws_error(ws, error) {
        logger.warn(`Websocket returned error: ${error}`);
        this.disconnect_ws();

        if (this.auto_reconnect) {
            this.connect_ws();
        }
    }

    async on_message(ws, msg) {
        try {
            const data = JSON.parse(msg);

            if (!('messages' in data)) {
                return;
            }

            for (const message_str of data["messages"]) {
                const message_data = JSON.parse(message_str);

                if (message_data["message_type"] != "subscriptionUpdate"){ 
                    continue;
                }

                const message = message_data["payload"]["data"]["messageAdded"]
        
                const copiedDict = Object.assign({}, this.active_messages);
                for (const [key, value] of Object.entries(copiedDict)) {
                    //add the message to the appropriate queue
                    if (value === message["messageId"] && key in this.message_queues) {
                        this.message_queues[key].push(message);
                        return;
                    }
        
                    //indicate that the response id is tied to the human message id
                    else if (key !== "pending" && value === null && message["state"] !== "complete") {
                        this.active_messages[key] = message["messageId"];
                        this.message_queues[key].push(message);
                    }
                }
            }
        }
        catch (err) {
            console.log('Error occurred in onMessage', err);
            this.disconnect_ws();
            await this.connect_ws();
        }
    }

    async *send_message(chatbot, message, with_chat_break = false, timeout = 20) {
        //if there is another active message, wait until it has finished sending
        while (Object.values(this.active_messages).includes(null)) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        //null indicates that a message is still in progress
        this.active_messages["pending"] = null;

        console.log(`Sending message to ${chatbot}: ${message}`);

        const messageData = await this.send_query("AddHumanMessageMutation", {
            "bot": chatbot,
            "query": message,
            "chatId": this.bots[chatbot]["chatId"],
            "source": null,
            "withChatBreak": with_chat_break
        });

        delete this.active_messages["pending"];

        if (!messageData["data"]["messageCreateWithStatus"]["messageLimit"]["canSend"]) {
            throw new Error(`Daily limit reached for ${chatbot}.`);
        }

        let humanMessageId;
        try {
            const humanMessage = messageData["data"]["messageCreateWithStatus"];
            humanMessageId = humanMessage["message"]["messageId"];
        } catch (error) {
            throw new Error(`An unknown error occured. Raw response data: ${messageData}`);
        }

        //indicate that the current message is waiting for a response
        this.active_messages[humanMessageId] = null;
        this.message_queues[humanMessageId] = [];

        let lastText = "";
        let messageId;
        while (true) {
            try {
                const message = this.message_queues[humanMessageId].shift();
                if (!message) {
                    await new Promise(resolve => setTimeout(() => resolve(), 1000));
                    continue;
                    //throw new Error("Queue is empty");
                }

                //only break when the message is marked as complete
                if (message["state"] === "complete") {
                    if (lastText && message["messageId"] === messageId) {
                        break;
                    } else {
                        continue;
                    }
                }

                //update info about response
                message["text_new"] = message["text"].substring(lastText.length);
                lastText = message["text"];
                messageId = message["messageId"];

                yield message;
            } catch (error) {
                delete this.active_messages[humanMessageId];
                delete this.message_queues[humanMessageId];
                throw new Error("Response timed out.");
            }
        }

        delete this.active_messages[humanMessageId];
        delete this.message_queues[humanMessageId];
    }

    async send_chat_break(chatbot) {
        logger.info(`Sending chat break to ${chatbot}`);
        const result = await this.send_query("AddMessageBreakMutation", {
            "chatId": this.bots[chatbot]["chatId"]
        });
        return result["data"]["messageBreakCreate"]["message"];
    }

    async get_message_history(chatbot, count = 25, cursor = null) {
        logger.info(`Downloading ${count} messages from ${chatbot}`);
        const result = await this.send_query("ChatListPaginationQuery", {
            "count": count,
            "cursor": cursor,
            "id": this.bots[chatbot]["id"]
        });
        return result["data"]["node"]["messagesConnection"]["edges"];
    }

    async delete_message(message_ids) {
        logger.info(`Deleting messages: ${message_ids}`);
        if (!Array.isArray(message_ids)) {
            message_ids = [parseInt(message_ids)];
        }
        const result = await this.send_query("DeleteMessageMutation", {
            "messageIds": message_ids
        });
    }

    async purge_conversation(chatbot, count = -1) {
        logger.info(`Purging messages from ${chatbot}`);
        let last_messages = (await this.get_message_history(chatbot, 50)).reverse();
        while (last_messages.length) {
            const message_ids = [];
            for (const message of last_messages) {
                if (count === 0) {
                    break;
                }
                count--;
                message_ids.push(message["node"]["messageId"]);
            }

            await this.delete_message(message_ids);

            if (count === 0) {
                return;
            }
            last_messages = (await this.get_message_history(chatbot, 50)).reverse();
        }
        logger.info("No more messages left to delete.");
    }
}

load_queries();

module.exports = { Client };