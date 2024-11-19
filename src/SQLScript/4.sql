-- UserCommunity Relationship Table
CREATE TABLE user_community_subscription (
    username VARCHAR(255),
    community_name VARCHAR(255),
    joined_at TIMESTAMP,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    left_at TIMESTAMP,
    PRIMARY KEY (username, community_name),
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
    FOREIGN KEY (community_name) REFERENCES communities(name) ON DELETE CASCADE
);

