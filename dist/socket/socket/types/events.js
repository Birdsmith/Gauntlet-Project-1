"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketEvents = void 0;
var SocketEvents;
(function (SocketEvents) {
    // Connection events
    SocketEvents["CONNECT"] = "connect";
    SocketEvents["DISCONNECT"] = "disconnect";
    // Channel events
    SocketEvents["JOIN_CHANNEL"] = "join_channel";
    SocketEvents["LEAVE_CHANNEL"] = "leave_channel";
    SocketEvents["CHANNEL_MESSAGE"] = "channel_message";
    // Direct message events
    SocketEvents["JOIN_CONVERSATION"] = "join_conversation";
    SocketEvents["LEAVE_CONVERSATION"] = "leave_conversation";
    SocketEvents["DIRECT_MESSAGE"] = "direct_message";
    // Reaction events
    SocketEvents["ADD_REACTION"] = "add_reaction";
    SocketEvents["REMOVE_REACTION"] = "remove_reaction";
    // User events
    SocketEvents["USER_ONLINE"] = "user_online";
    SocketEvents["USER_OFFLINE"] = "user_offline";
    SocketEvents["USER_TYPING"] = "user_typing";
    // Thread events
    SocketEvents["JOIN_THREAD"] = "join_thread";
    SocketEvents["LEAVE_THREAD"] = "leave_thread";
    SocketEvents["THREAD_MESSAGE"] = "thread_message";
})(SocketEvents || (exports.SocketEvents = SocketEvents = {}));
