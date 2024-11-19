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
    database: 'reddit',
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
    const { username, communityName } = req.body;
    if (!username || !communityName) {
        return res.status(400).json({ error: 'Both username and communityName are required' });
    }

    try {
        // Start a transaction to ensure data integrity
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if the user is already associated with the community
        const checkExistenceQuery = 'SELECT status FROM user_community_subscription WHERE username = ? AND community_name = ?';
        const [results] = await connection.query(checkExistenceQuery, [username, communityName]);

        if (results.length > 0) {
            const currentUserStatus = results[0].status;
            if (currentUserStatus === 'active') {
                await connection.release();
                return res.status(409).json({ message: 'User already an active member of this community' });
            } else {
                // User is inactive, reactivate the membership
                const reactivateQuery = 'UPDATE user_community_subscription SET status = "active", timestamp = NOW() WHERE username = ? AND community_name = ?';
                await connection.query(reactivateQuery, [username, communityName]);
                await connection.commit();
                connection.release();
                return res.status(200).json({ message: 'Successfully reactivated membership in the community' });
            }
        }

        // If no existing record, insert a new one
        const joinQuery = 'INSERT INTO user_community_subscription (username, community_name, status, timestamp) VALUES (?, ?, "active", NOW())';
        await connection.query(joinQuery, [username, communityName]);
        await connection.commit();
        connection.release();
        res.status(201).json({ message: 'Successfully joined the community' });
    } catch (error) {
        await connection.rollback();  // Ensure transaction is rolled back in case of error
        connection.release();
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
            'SELECT 1 FROM user_community_subscription WHERE username = ? AND community_name = ? AND status = "active"',
            [userId, communityId]
        );

        if (exists.length === 0) {
            await connection.release();
            return res.status(404).json({ error: 'User is not an active member of this community' });
        }

        // Update the user's status to 'inactive'
        await connection.query(
            'UPDATE user_community_subscription SET status = "inactive", timestamp = NOW() WHERE username = ? AND community_name = ?',
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

//Content Management Module
// Define the GET endpoint
app.get('/api/v1/search-communities', async(req, res) => {
    const { name } = req.query;  // Get the search term from query parameters
    if (!name) {
        return res.status(400).json({ error: 'Name parameter is required' });
    }
    const connection = await pool.getConnection();

    const query = "SELECT name FROM communities WHERE name LIKE ?";
    try {
        // Construct and execute the search queries
        const [communities] = await connection.query(query, [`%${name}%`]
        );
        // Close the database connection
        connection.release();

        // Send combined search results
        res.json({communities});
    } catch (error) {
        console.error('Failed to execute search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }

});

// new community
app.post('/api/v1/new-community', async (req, res) => {
    const { name, community_type, is_NSFW } = req.body;
    if (!(name && community_type && typeof is_NSFW !== 'undefined')) {
      res.status(400).json("All input is required");
    }
    
    const connection = await pool.getConnection();
    const query = 'INSERT INTO communities (name, community_type, is_adult_content) VALUES (?, ?, ?)';
    try {
        // Construct and execute the search queries
        await connection.query(query, [name, community_type, is_NSFW]);
        // Close the database connection
        connection.release();

        // Send combined search results
        res.json('new community created successfully');
    } catch (error) {
        console.error('Failed to execute search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
  });


//Find subscribed communities
app.get('/api/v1/community/subscription', async (req, res) => {
    const { username } = req.query;
    try {
        let query = `SELECT name FROM communities
        JOIN user_community_subscription ON communities.name = user_community_subscription.community_name
        WHERE user_community_subscription.username = ?`;

        const [community_subscription] = await pool.query(query, username);
        res.json(community_subscription);
    } catch (error) {
        console.error('Failed to retrieve community subscription:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// new post
app.post('/api/v1/new-post', async (req, res) => {
    const { subject, content, author, community } = req.body;
    if (!(subject && author && content && community)) {
      return res.status(400).json("All input is required");
    }

    const connection = await pool.getConnection();
    const query = 'INSERT INTO posts (subject, content, author, community) VALUES (?, ?, ?, ?)';
    try {
        // Construct and execute the search queries
        await connection.query(query, [subject, content, author, community]);
        // Close the database connection
        connection.release();

        // Send combined search results
        res.json('new post created successfully');
    } catch (error) {
        console.error('Failed to execute search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
  });

  // get endpoint to fetch data based on communities name
app.get('/api/v1/fetch-communities', async(req, res) => {
    const { communitiesName } = req.query;  // Get the search term from query parameters
    if (!communitiesName) {
        res.status(400).json("All input is required");
    }
    const sql = `
    SELECT 
        communities.id AS communities_id,
        communities.name AS communities_name,
        communities.community_type AS communities_type,
        communities.is_adult_content AS communities_adult_content,
        posts.id AS post_id,
        posts.subject AS post_subject,
        posts.content AS post_content,
        posts.vote AS post_votes,
        posts.author AS post_author,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count
    FROM 
        communities
    JOIN 
        posts ON posts.community = communities.name
    WHERE 
        communities.name = ?;
    `;
  
    try {
        const [results] = await pool.query(sql, [communitiesName]);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
  });

// get endpoint to fetch data based on post id
app.get('/api/v1/fetch-post',async(req, res) => {
    const { postId } = req.query;  // Get the search term from query parameters
    if (!postId) {
        res.status(400).json("All input is required");
    }
    const sql = `
        SELECT 
            posts.id AS post_id,
            posts.subject,
            posts.content AS post_content,
            posts.vote AS post_vote,
            posts.author AS post_author,
            posts.community AS post_community,
            comments.id AS comments_id,
            comments.content AS comments_content,
            comments.vote AS comments_vote,
            comments.author AS comments_author,
            (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count
        FROM posts
        LEFT JOIN comments ON comments.post_id = posts.id
        WHERE posts.id = ?;
    `;
    try {
        const [results] = await pool.query(sql, [postId]);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
  });

// new comments
app.post('/api/v1/new-comments', async (req, res) => {
    const { content, author, post_id } = req.body;
    if (!(content && author && post_id)) {
      return res.status(400).json("All input is required");
    }
    
    const connection = await pool.getConnection();
    const query = 'INSERT INTO comments (content, author, post_id) VALUES (?, ?, ?)';
    try {
        // Construct and execute the search queries
        await connection.query(query, [content, author, post_id],);
        // Close the database connection
        connection.release();

        // Send combined search results
        res.json('new comments created successfully');
    } catch (error) {
        console.error('Failed to execute search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }

  });


//Communication Module 
//Marketplace Module
// POST /marketplace/listings to create new product listings
app.post('/api/v1/marketplace/listings', async (req, res) => {
    const { name, description, userId, price } = req.body;
    if (!name || !description || !price || !userId) {
        return res.status(400).json({ message: 'name, description, userId and price are required' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO listings (name, description, price, username) VALUES (?, ?, ?, ?)',
            [name, description, price, userId]
        );
        res.status(201).json({ id: result.insertId, name, description, price, userId });
    } catch (error) {
        console.error('Failed to create listing:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /marketplace/listings to browse and search listings
app.get('/api/v1/marketplace/listings', async (req, res) => {
    const { search } = req.query;
    try {
        let query = 'SELECT * FROM listings';
        const params = [];

        if (search) {
            query += ' WHERE name LIKE ? OR description LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [listings] = await pool.query(query, params);
        res.json(listings);
    } catch (error) {
        console.error('Failed to retrieve listings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//Search Module
app.get('/api/v1/search', async (req, res) => {
    var { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    const connection = await pool.getConnection();

    try {
        // Escape the input to prevent SQL Injection
        const escapedQuery = `%${query}%`;

        // Construct and execute the search queries
        const [posts] = await connection.query(
            `SELECT subject, content, vote, author, community FROM posts WHERE subject LIKE ? OR content LIKE ?`, [escapedQuery, escapedQuery]
        );
        const [communities] = await connection.query(
            `SELECT name, community_type, is_adult_content FROM communities WHERE name LIKE ?`, [escapedQuery]
        );
        const [comments] = await connection.query(
            `SELECT content, vote, author, post_id FROM comments WHERE content LIKE ?`, [escapedQuery]
        );
        const [users] = await connection.query(
            `SELECT username FROM users WHERE username LIKE ?`, [escapedQuery]
        );

        // Close the database connection
        connection.release();

        // Send combined search results
        res.json({ posts, communities, comments, users });
    } catch (error) {
        console.error('Failed to execute search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Home feed module
const home_feed_sql = `
SELECT 
    p.id AS post_id,
    p.subject,
    p.content,
    p.vote,
    p.author,
    c.name AS community_name
FROM 
    posts p
JOIN 
    communities c ON p.community = c.name -- Joining posts to communities
JOIN 
    user_community_subscription uc ON c.id = uc.community_id -- Joining communities to user subscriptions
JOIN 
    users u ON uc.username = u.username -- Joining users to user subscriptions
WHERE 
    u.id = 1
	AND uc.status = 'active'; -- Ensuring the user's subscription is active
`;


app.get('/api/v1/home-feed', async (req, res) => {
    var { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    const connection = await pool.getConnection();

    try {
        // Construct and execute the search queries
        const [home_feed] = await connection.query(
            home_feed_sql, [userId]
        );

        // Close the database connection
        connection.release();

        // Send combined search results
        res.json({home_feed});
    } catch (error) {
        console.error('Failed to execute search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Listen to server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
