const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

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

// Signup Endpoint
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!(email && password && username)) {
    res.status(400).send("All input is required");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
  db.query(sql, [username, email, hashedPassword], (err, result) => {
    if (err) {
      res.status(500).send('Database error: ' + err.message);
    } else {
      res.status(201).send("User created successfully");
    }
  });
});

// Login Endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], async (err, result) => {
    if (err) {
      res.status(500).send('Database error: ' + err.message);
    } else if (result.length > 0) {
      const user = result[0];
      if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ user_id: user.id, email }, secretKey, { expiresIn: '2h' });
        res.status(200).json({ token });
      } else {
        res.status(400).send("Invalid Credentials");
      }
    } else {
      res.status(404).send("User not found");
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
