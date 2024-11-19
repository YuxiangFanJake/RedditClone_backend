const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');

mongoose.connect('mongodb://localhost/messages', {});

const MessageSchema = new mongoose.Schema({
    fromUserId: String,
    toUserId: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const app = express();
app.use(cors()); // Enable CORS for all routes and origins. @TODO: Secure this in production.
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3001",  // Specify the frontend origin explicitly
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],  // Optional: specify custom headers
        credentials: true  // Optional: if your frontend sends cookies with the API requests
    }
});


const PORT = process.env.PORT || 3002;
app.get('/', (req, res) => res.send('Server is running'));
io.on('connection', async(socket) => {
    socket.on('openChat', async (toId, fromId) => {
        socket.join(fromId);
        console.log(`User ${fromId} connected`);

        try {
            const messages = await Message.find({
                $or: [
                    // Either messages from fromId to toId
                    { $and: [
                        { fromUserId: fromId },
                        { toUserId: toId }
                    ]},
                    // Or messages from toId to fromId
                    { $and: [
                        { fromUserId: toId },
                        { toUserId: fromId }
                    ]}
                ]})
                .sort({ timestamp: -1 })
                .limit(50)
                .exec(); // Note that we are awaiting the promise here

            socket.emit('loadOldMessages', messages.reverse());
        } catch (err) {
            console.error('Error fetching messages:', err);
            // Handle the error appropriately
        }
    });

    socket.on('sendMessage', (data) => {
        const { fromUserId, toUserId, message } = data;
        const msgToSave = new Message({ fromUserId, toUserId, message });
        msgToSave.save();
        io.to(toUserId).emit('receiveMessage', data);
    });

    socket.on('disconnect', () => console.log('User disconnected'));
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
 