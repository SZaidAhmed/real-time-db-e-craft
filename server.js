require("dotenv").config({ path: "./config.env" });
const httpServer = require("http");
const express = require("express");
const socketio = require("socket.io");
const mongoose = require("mongoose");

const app = express();

//mantaining connection list a/c to userId (userId === _id in user colection)
var users = [];

const addUser = ({ userId, socketId }) => {
    !users.some(user => user.userId === userId) && users.push({ userId, socketId })
}

const removeUser = (userId) => {
    users.filter(user => user.userId !== userId);
}

const getUser = (userId) => {

    return users.find(user => `${user.userId}` === `${userId}`);
}

const server = httpServer.createServer(app);

const io = socketio(server, {
    cors: {
        origin: "http://localhost:3000"
    }
});

//listening events
io.on("connection", function (socket) {
    console.log("we have a new connection");
    socket.on("online", (userId) => {
        addUser({ socketId: socket.id, userId });
    });
    socket.on("disconnect", () => {
        removeUser(socket.id)
        console.log("user left")
    })

});


mongoose.connect(process.env.MONGO_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})


const db = mongoose.connection;

db.once("open", () => {
    console.log("db connected");

    //watching notification
    const notificationCollection = db.collection("notifications");
    const notificationChangeStream = notificationCollection.watch();
    notificationChangeStream.on("change", (change) => {
        if (change.operationType === "insert") {
            var doc = change.fullDocument;
            var { user } = doc;
            var connectedUser = getUser(user);
            if (connectedUser) {
                io.to(connectedUser.socketId).emit("notification", doc)
            }
        }
    });

    //watching messages
    const messagesCollection = db.collection("messages");
    const messagesChangeStream = messagesCollection.watch();
    messagesChangeStream.on("change", (change) => {
        if (change.operationType === "insert") {
            var doc = change.fullDocument;
            var { reciever } = doc;
            var connectedUser = getUser(reciever);
            console.log(connectedUser)
            if (connectedUser) {
                io.to(connectedUser.socketId).emit("message", doc);
            }
        }
    })
});

const PORT = process.env.PORT;

server.listen(PORT, () => {
    console.log("server running on port:", PORT);
})