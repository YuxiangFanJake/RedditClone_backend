const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;
const secretKey = 'your_secret_key'; // Change this to a more secure key in production

// Create a connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'newuser',
    password: '1',
    database: 'RedditClone',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes and origins. @TODO: Secure this in production.

// User Management Module

// Signup Endpoint
app.post('/api/v1/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!(email && password && username)) {
        return res.status(400).send("All input is required");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    try {
        await pool.query(sql, [username, email, hashedPassword]);
        res.status(201).json({message: 'User created successfully'});
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({message: 'Database error: ' + error.message});
    }
});

// Login Endpoint
app.post('/api/v1/login', async (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ?';
    try {
        const [results] = await pool.query(sql, [email]);
        if (results.length > 0) {
            const user = results[0];
            if (await bcrypt.compare(password, user.password)) {
                //const token = jwt.sign({ user_id: user.id, email }, secretKey, { expiresIn: '2h' });
                const userName = user.username;
                res.status(200).json({ userName });
            } else {
                res.status(400).json({ message: 'Invalid credentials' });
            }
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json('Database error: ' + error.message);
    }
});

// Define the GET endpoint to fetch a user's name by ID
app.get('/api/v1/user-name', async (req, res) => {
    const { id } = req.query;  // Get the user ID from query parameters
    if (!id) {
        return res.status(400).json({ error: 'ID parameter is required' });
    }

    const query = "SELECT username FROM users WHERE id = ?";
    try {
        const [results] = await pool.query(query, [id]);
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error executing the query:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Join Community Endpoint
app.post('/api/v1/join-community', async (req, res) => {
    const { userId, communityId } = req.body;
    if (!userId || !communityId) {
        return res.status(400).json({ error: 'Both userId and communityId are required' });
    }

    try {
        const checkExistenceQuery = 'SELECT 1 FROM user_community WHERE user_id = ? AND community_id = ?';
        const [results] = await pool.query(checkExistenceQuery, [userId, communityId]);

        if (results.length > 0) {
            return res.status(409).json({ message: 'User already a member of this community' });
        }

        const joinQuery = 'INSERT INTO user_community (user_id, community_id, status, joined_at) VALUES (?, ?, "active", NOW())';
        await pool.query(joinQuery, [userId, communityId]);
        res.status(201).json({ message: 'Successfully joined the community' });
    } catch (error) {
        console.error('Error in database operation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



app.post('/api/v1/leave-community', async (req, res) => {
    const { userId, communityId } = req.body;

    // Input validation
    if (!userId || !communityId) {
        return res.status(400).json({ error: 'Both userId and communityId are required' });
    }

    try {
        // Start a transaction to ensure data integrity
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if the user is currently a member of the community
        const [exists] = await connection.query(
            'SELECT 1 FROM user_community WHERE user_id = ? AND community_id = ? AND status = "active"',
            [userId, communityId]
        );

        if (exists.length === 0) {
            await connection.release();
            return res.status(404).json({ error: 'User is not an active member of this community' });
        }

        // Update the user's status to 'inactive'
        await connection.query(
            'UPDATE user_community SET status = "inactive", joined_at = null, left_at = NOW() WHERE user_id = ? AND community_id = ?',
            [userId, communityId]
        );

        await connection.commit();
        connection.release();
        res.status(200).json({ message: 'You have successfully left the community' });
    } catch (error) {
        console.error('Error in database operation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




// Listen to server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
