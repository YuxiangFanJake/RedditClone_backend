CREATE TABLE post (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject VARCHAR(255),
  content TEXT,
  vote INT DEFAULT 0,
  author VARCHAR(255),
  FOREIGN KEY (author) REFERENCES users(username),
  FOREIGN KEY (community) REFERENCES subreddit(name)
);

CREATE TABLE comment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content TEXT,
  vote INT DEFAULT 0,
  author VARCHAR(255),
  post_id INT,
  FOREIGN KEY (post_id) REFERENCES post(id)
);
