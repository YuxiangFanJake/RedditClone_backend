const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;
const secretKey = 'your_secret_key'; // Change this to a more secure key in production

// MySQL connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'newuser', // replace with your mysql username
  password: '1', // replace with your mysql password
  database: 'RedditClone' // replace with your database name
});

// Connect to MySQL
db.connect(err => {
  if (err) throw err;
  console.log('Connected to MySQL Database.');
});

// Middleware
app.use(bodyParser.json());
// Enable CORS for all routes and origins. @TODO this needs to be changed later for security concerns
app.use(cors());


// Signup Endpoint
app.post('/api/v1/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!(email && password && username)) {
    res.status(400).send("All input is required");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
  db.query(sql, [username, email, hashedPassword], (err, result) => {
    if (err) {
      res.status(500).json({message : 'Database error: ' + err.message});
    } else {
      res.status(201).json({message: 'User created successfully'});
    }
  });
});


// Login Endpoint
app.post('/api/v1/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], async (err, result) => {
    if (err) {
      res.status(500).json('Database error: ' + err.message);
    } else if (result.length > 0) {
      const user = result[0];
      if (await bcrypt.compare(password, user.password)) {
        //const token = jwt.sign({ user_id: user.id, email }, secretKey, { expiresIn: '2h' });
        const userName = user.username
        res.status(200).json({ userName });
      } else {
        res.status(400).json({ message: 'Invalid credentials' });
      }
    } else {
        res.status(404).json({ message: 'User not found' });
    }
  });
});


// Define the GET endpoint
app.get('/api/v1/search-subreddit', (req, res) => {
    const { name } = req.query;  // Get the search term from query parameters
    if (!name) {
        return res.status(400).json({ error: 'Name parameter is required' });
    }

    // SQL query to find similar subreddit names
    const query = "SELECT name FROM subreddit WHERE name LIKE ?";

    db.query(query, [`%${name}%`], (err, results) => {
        if (err) {
            console.error('Error executing the query:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

// new community
app.post('/api/v1/new-community', async (req, res) => {
    const { name, community_type, is_NSFW } = req.body;
    if (!(name && community_type && typeof is_NSFW !== 'undefined')) {
      res.status(400).json("All input is required");
    }
    
    const sql = 'INSERT INTO subreddit (name, community_type, is_adult_content) VALUES (?, ?, ?)';
    db.query(sql, [name, community_type, is_NSFW], (err, result) => {
      if (err) {
        res.status(500).json({message : 'Database error: ' + err.message});
      } else {
        res.status(201).json({message: 'new community created successfully'});
      }
    });
  });


// new post
app.post('/api/v1/new-post', async (req, res) => {
    const { subject, content, author, community } = req.body;
    if (!(subject && author && content && community)) {
      return res.status(400).json("All input is required");
    }
    
    const sql = 'INSERT INTO post (subject, content, author, community) VALUES (?, ?, ?, ?)';
    db.query(sql, [subject, content, author, community], (err, result) => {
      if (err) {
        res.status(500).json({message : 'Database error: ' + err.message});
      } else {
        res.status(201).json({message: 'new post created successfully'});
      }
    });
  });

  // get endpoint to fetch data based on subreddit name
app.get('/api/v1/fetch-subreddit', (req, res) => {
    const { subredditName } = req.query;  // Get the search term from query parameters
    if (!subredditName) {
        res.status(400).json("All input is required");
    }
    const sql = `
    SELECT 
        subreddit.id AS subreddit_id,
        subreddit.name AS subreddit_name,
        subreddit.community_type AS subreddit_type,
        subreddit.is_adult_content AS subreddit_adult_content,
        post.id AS post_id,
        post.subject AS post_subject,
        post.content AS post_content,
        post.vote AS post_votes,
        post.author AS post_author,
        (SELECT COUNT(*) FROM comment WHERE comment.post_id = post.id) AS comment_count
    FROM 
        subreddit
    JOIN 
        post ON post.community = subreddit.name
    WHERE 
        subreddit.name = ?;
    `;
  
    db.query(sql, [subredditName], (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json(results);
    });
  });

  // get endpoint to fetch data based on post id
  app.get('/api/v1/fetch-post', (req, res) => {
    const { postId } = req.query;  // Get the search term from query parameters
    if (!postId) {
        res.status(400).json("All input is required");
    }
    const sql = `
        SELECT 
            post.id AS post_id,
            post.subject,
            post.content AS post_content,
            post.vote AS post_vote,
            post.author AS post_author,
            post.community AS post_community,
            comment.id AS comment_id,
            comment.content AS comment_content,
            comment.vote AS comment_vote,
            comment.author AS comment_author
        FROM post
        LEFT JOIN comment ON comment.post_id = post.id
        WHERE post.id = ?;
    `;
  
    db.query(sql, [postId], (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json(results);
    });
  });

// new comment
app.post('/api/v1/new-comment', async (req, res) => {
    const { content, author, post_id } = req.body;
    if (!(content && author && post_id)) {
      return res.status(400).json("All input is required");
    }
    
    const sql = 'INSERT INTO comment (content, author, post_id) VALUES (?, ?, ?)';
    db.query(sql, [content, author, post_id], (err, result) => {
      if (err) {
        res.status(500).json({message : 'Database error: ' + err.message});
      } else {
        res.status(201).json({message: 'new comment created successfully'});
      }
    });
  });



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
