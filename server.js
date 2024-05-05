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
      res.status(500).send('Database error: ' + err.message);
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


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
