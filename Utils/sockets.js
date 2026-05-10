import { Server } from 'socket.io';
import Message from '../Models/MessageSchema.js';
import User from '../Models/UserSchema.js';

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust this to your frontend URL in production
            methods: ["GET", "POST"]
        }
    });



    io.on('connection', (socket) => {


        // User joins their own room or admin joins a specific user's room
        socket.on('join_room', (userId) => {
            socket.join(userId);

        });

        // Admin joins a specific conversation
        socket.on('admin_join_user', (userId) => {
            socket.join(userId);

        });

        // Sending a message
        socket.on('send_message', async (data) => {
            let { sender, receiver, message, isAdmin } = data;
            
            try {
                // If user is sending to admin, find an actual admin ID
                if (!isAdmin && (receiver === "admin_id_placeholder" || !receiver)) {
                    const adminUser = await User.findOne({ role: 'admin' });
                    if (adminUser) {
                        receiver = adminUser._id;
                    } else {
                        receiver = sender; 
                    }
                }

                // If admin is sending, find an actual admin ID
                if (isAdmin && (sender === "admin_id_placeholder" || !sender)) {
                    const adminUser = await User.findOne({ role: 'admin' });
                    if (adminUser) {
                        sender = adminUser._id;
                    }
                }

                // Save message to database
                const newMessage = new Message({
                    sender,
                    receiver,
                    message,
                    isAdmin: !!isAdmin
                });
                await newMessage.save();

                // Broadcast message to the specific room (userId)
                const roomId = isAdmin ? receiver : sender;
                io.to(roomId.toString()).emit('receive_message', newMessage);
                
                // If it's a new conversation, notify admin list
                if (!isAdmin) {
                    io.emit('new_chat_notification', {
                        userId: sender,
                        message: message.substring(0, 50)
                    });
                }

            } catch (error) {
                console.error('Error saving message:', error);
                socket.emit('error', 'Message could not be sent');
            }
        });

        socket.on('disconnect', () => {

        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};
