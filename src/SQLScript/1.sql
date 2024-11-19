--create subreddit table

CREATE TABLE communities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  community_type VARCHAR(255) NOT NULL, 
  is_adult_content BOOLEAN NOT NULL
);
 
