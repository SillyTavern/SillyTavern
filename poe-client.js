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

const cached_bots = {};

const logger = console;

const user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36";

function extractFormKey(html) {
    const scriptRegex = /<script>if\(.+\)throw new Error;(.+)<\/script>/;
    const scriptText = html.match(scriptRegex)[1];
    const keyRegex = /var .="([0-9a-f]+)",/;
    const keyText = scriptText.match(keyRegex)[1];
    const cipherRegex = /.\[(\d+)\]=.\[(\d+)\]/g;
    const cipherPairs = Array.from(scriptText.matchAll(cipherRegex));

    const formKeyList = new Array(cipherPairs.length).fill("");
    for (const pair of cipherPairs) {
        const [formKeyIndex, keyIndex] = pair.slice(1).map(Number);
        formKeyList[formKeyIndex] = keyText[keyIndex];
    }
    const formKey = formKeyList.join("");

    return formKey;
}


function md5() {
    function a(e, t) {
        var r = (65535 & e) + (65535 & t);
        return (e >> 16) + (t >> 16) + (r >> 16) << 16 | 65535 & r
    }
    function s(e, t, r, n, i, s) {
        var o;
        return a((o = a(a(t, e), a(n, s))) << i | o >>> 32 - i, r)
    }
    function o(e, t, r, n, i, a, o) {
        return s(t & r | ~t & n, e, t, i, a, o)
    }
    function l(e, t, r, n, i, a, o) {
        return s(t & n | r & ~n, e, t, i, a, o)
    }
    function u(e, t, r, n, i, a, o) {
        return s(t ^ r ^ n, e, t, i, a, o)
    }
    function c(e, t, r, n, i, a, o) {
        return s(r ^ (t | ~n), e, t, i, a, o)
    }
    function d(e, t) {
        e[t >> 5] |= 128 << t % 32,
            e[(t + 64 >>> 9 << 4) + 14] = t;
        var r, n, i, s, d, f = 1732584193, h = -271733879, p = -1732584194, _ = 271733878;
        for (r = 0; r < e.length; r += 16)
            n = f,
                i = h,
                s = p,
                d = _,
                f = o(f, h, p, _, e[r], 7, -680876936),
                _ = o(_, f, h, p, e[r + 1], 12, -389564586),
                p = o(p, _, f, h, e[r + 2], 17, 606105819),
                h = o(h, p, _, f, e[r + 3], 22, -1044525330),
                f = o(f, h, p, _, e[r + 4], 7, -176418897),
                _ = o(_, f, h, p, e[r + 5], 12, 1200080426),
                p = o(p, _, f, h, e[r + 6], 17, -1473231341),
                h = o(h, p, _, f, e[r + 7], 22, -45705983),
                f = o(f, h, p, _, e[r + 8], 7, 1770035416),
                _ = o(_, f, h, p, e[r + 9], 12, -1958414417),
                p = o(p, _, f, h, e[r + 10], 17, -42063),
                h = o(h, p, _, f, e[r + 11], 22, -1990404162),
                f = o(f, h, p, _, e[r + 12], 7, 1804603682),
                _ = o(_, f, h, p, e[r + 13], 12, -40341101),
                p = o(p, _, f, h, e[r + 14], 17, -1502002290),
                h = o(h, p, _, f, e[r + 15], 22, 1236535329),
                f = l(f, h, p, _, e[r + 1], 5, -165796510),
                _ = l(_, f, h, p, e[r + 6], 9, -1069501632),
                p = l(p, _, f, h, e[r + 11], 14, 643717713),
                h = l(h, p, _, f, e[r], 20, -373897302),
                f = l(f, h, p, _, e[r + 5], 5, -701558691),
                _ = l(_, f, h, p, e[r + 10], 9, 38016083),
                p = l(p, _, f, h, e[r + 15], 14, -660478335),
                h = l(h, p, _, f, e[r + 4], 20, -405537848),
                f = l(f, h, p, _, e[r + 9], 5, 568446438),
                _ = l(_, f, h, p, e[r + 14], 9, -1019803690),
                p = l(p, _, f, h, e[r + 3], 14, -187363961),
                h = l(h, p, _, f, e[r + 8], 20, 1163531501),
                f = l(f, h, p, _, e[r + 13], 5, -1444681467),
                _ = l(_, f, h, p, e[r + 2], 9, -51403784),
                p = l(p, _, f, h, e[r + 7], 14, 1735328473),
                h = l(h, p, _, f, e[r + 12], 20, -1926607734),
                f = u(f, h, p, _, e[r + 5], 4, -378558),
                _ = u(_, f, h, p, e[r + 8], 11, -2022574463),
                p = u(p, _, f, h, e[r + 11], 16, 1839030562),
                h = u(h, p, _, f, e[r + 14], 23, -35309556),
                f = u(f, h, p, _, e[r + 1], 4, -1530992060),
                _ = u(_, f, h, p, e[r + 4], 11, 1272893353),
                p = u(p, _, f, h, e[r + 7], 16, -155497632),
                h = u(h, p, _, f, e[r + 10], 23, -1094730640),
                f = u(f, h, p, _, e[r + 13], 4, 681279174),
                _ = u(_, f, h, p, e[r], 11, -358537222),
                p = u(p, _, f, h, e[r + 3], 16, -722521979),
                h = u(h, p, _, f, e[r + 6], 23, 76029189),
                f = u(f, h, p, _, e[r + 9], 4, -640364487),
                _ = u(_, f, h, p, e[r + 12], 11, -421815835),
                p = u(p, _, f, h, e[r + 15], 16, 530742520),
                h = u(h, p, _, f, e[r + 2], 23, -995338651),
                f = c(f, h, p, _, e[r], 6, -198630844),
                _ = c(_, f, h, p, e[r + 7], 10, 1126891415),
                p = c(p, _, f, h, e[r + 14], 15, -1416354905),
                h = c(h, p, _, f, e[r + 5], 21, -57434055),
                f = c(f, h, p, _, e[r + 12], 6, 1700485571),
                _ = c(_, f, h, p, e[r + 3], 10, -1894986606),
                p = c(p, _, f, h, e[r + 10], 15, -1051523),
                h = c(h, p, _, f, e[r + 1], 21, -2054922799),
                f = c(f, h, p, _, e[r + 8], 6, 1873313359),
                _ = c(_, f, h, p, e[r + 15], 10, -30611744),
                p = c(p, _, f, h, e[r + 6], 15, -1560198380),
                h = c(h, p, _, f, e[r + 13], 21, 1309151649),
                f = c(f, h, p, _, e[r + 4], 6, -145523070),
                _ = c(_, f, h, p, e[r + 11], 10, -1120210379),
                p = c(p, _, f, h, e[r + 2], 15, 718787259),
                h = c(h, p, _, f, e[r + 9], 21, -343485551),
                f = a(f, n),
                h = a(h, i),
                p = a(p, s),
                _ = a(_, d);
        return [f, h, p, _]
    }
    function f(e) {
        var t, r = "", n = 32 * e.length;
        for (t = 0; t < n; t += 8)
            r += String.fromCharCode(e[t >> 5] >>> t % 32 & 255);
        return r
    }
    function h(e) {
        var t, r = [];
        for (t = 0,
            r[(e.length >> 2) - 1] = void 0; t < r.length; t += 1)
            r[t] = 0;
        var n = 8 * e.length;
        for (t = 0; t < n; t += 8)
            r[t >> 5] |= (255 & e.charCodeAt(t / 8)) << t % 32;
        return r
    }
    function p(e) {
        var t, r, n = "0123456789abcdef", i = "";
        for (r = 0; r < e.length; r += 1)
            i += n.charAt((t = e.charCodeAt(r)) >>> 4 & 15) + n.charAt(15 & t);
        return i
    }
    function _(e) {
        return unescape(encodeURIComponent(e))
    }
    function v(e) {
        var t;
        return f(d(h(t = _(e)), 8 * t.length))
    }
    function g(e, t) {
        return function (e, t) {
            var r, n, i = h(e), a = [], s = [];
            for (a[15] = s[15] = void 0,
                i.length > 16 && (i = d(i, 8 * e.length)),
                r = 0; r < 16; r += 1)
                a[r] = 909522486 ^ i[r],
                    s[r] = 1549556828 ^ i[r];
            return n = d(a.concat(h(t)), 512 + 8 * t.length),
                f(d(s.concat(n), 640))
        }(_(e), _(t))
    }
    function m(e, t, r) {
        return t ? r ? g(t, e) : p(g(t, e)) : r ? v(e) : p(v(e))
    }

    return m;
}

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

function generate_payload(query, variables) {
    return {
        query: queries[query],
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
    use_cached_bots = false;

    constructor(auto_reconnect = false, use_cached_bots = false) {
        this.auto_reconnect = auto_reconnect;
        this.use_cached_bots = use_cached_bots;
        this.abortController = new AbortController();
    }

    async init(token, proxy = null) {
        this.proxy = proxy;
        this.session = axios.default.create({
            timeout: 60000,
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
            signal: this.abortController.signal,
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
        this.session.defaults.headers.common = this.headers;
        this.next_data = await this.get_next_data();
        this.channel = await this.get_channel_data();
        this.bots = await this.get_bots();
        this.bot_names = this.get_bot_names();
        this.ws_domain = `tch${Math.floor(Math.random() * 1e6)}`;
        this.gql_headers = {
            "poe-formkey": this.formkey,
            "poe-tchannel": this.channel["channel"],
            ...this.headers,
        };
        await this.connect_ws();
        await this.subscribe();
    }

    async get_next_data() {
        logger.info('Downloading next_data...');

        const r = await request_with_retries(() => this.session.get(this.home_url));
        const jsonRegex = /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/;
        const jsonText = jsonRegex.exec(r.data)[1];
        const nextData = JSON.parse(jsonText);

        this.formkey = extractFormKey(r.data);
        this.viewer = nextData.props.pageProps.payload.viewer;

        return nextData;
    }

    async get_bots() {
        const viewer = this.next_data.props.pageProps.payload.viewer;
        if (!viewer.availableBots) {
            throw new Error('Invalid token.');
        }
        const botList = viewer.availableBotsConnection.edges.map(x => x.node);
        const retries = 2;
        const bots = {};
        for (const bot of botList.filter(x => x.deletionState == 'not_deleted')) {
            try {
                const url = `https://poe.com/_next/data/${this.next_data.buildId}/${bot.displayName}.json`;
                let r;

                if (this.use_cached_bots && cached_bots[url]) {
                    r = cached_bots[url];
                }
                else {
                    logger.info(`Downloading ${url}`);
                    r = await request_with_retries(() => this.session.get(url), retries);
                    cached_bots[url] = r;
                }

                const chatData = r.data.pageProps.payload.chatOfBotDisplayName;
                bots[chatData.defaultBotObject.nickname] = chatData;
            }
            catch {
                console.log(`Could not load bot: ${bot.displayName}`);
            }
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

        return data.tchannelData;
    }

    get_websocket_url(channel = null) {
        if (!channel) {
            channel = this.channel;
        }
        const query = `?min_seq=${channel.minSeq}&channel=${channel.channel}&hash=${channel.channelHash}`;
        return `wss://${this.ws_domain}.tch.${channel.baseHost}/up/${channel.boxName}/updates${query}`;
    }

    async send_query(queryName, variables, queryDisplayName) {
        for (let i = 0; i < 20; i++) {
            const payload = generate_payload(queryName, variables);
            if (queryDisplayName) payload['queryName'] = queryDisplayName;
            const scramblePayload = JSON.stringify(payload);
            const _headers = this.gql_headers;
            _headers['poe-tag-id'] = md5()(scramblePayload + this.formkey + "WpuLMiXEKKE98j56k");
            _headers['poe-formkey'] = this.formkey;
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
                },
                {
                    "subscriptionName": "viewerMessageLimitUpdated",
                    "query": queries["ViewerMessageLimitUpdatedSubscription"]
                },
            ]
        },
            'subscriptionsMutation');
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

                if (message_data["message_type"] != "subscriptionUpdate") {
                    continue;
                }

                const message = message_data["payload"]["data"]["messageAdded"]

                if (!message) {
                    return;
                }

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

        const messageData = await this.send_query("SendMessageMutation", {
            "bot": chatbot,
            "query": message,
            "chatId": this.bots[chatbot]["chatId"],
            "source": null,
            "withChatBreak": with_chat_break
        });

        delete this.active_messages["pending"];

        if (!messageData["data"]["messageEdgeCreate"]["message"]) {
            throw new Error(`Daily limit reached for ${chatbot}.`);
        }

        let humanMessageId;
        try {
            const humanMessage = messageData["data"]["messageEdgeCreate"]["message"];
            humanMessageId = humanMessage["node"]["messageId"];
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
                this.abortController.signal.throwIfAborted();

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
