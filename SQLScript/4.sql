-- UserCommunity Relationship Table
CREATE TABLE user_community (
    user_id INT,
    community_id INT,
    joined_at TIMESTAMP,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    left_at TIMESTAMP,
    PRIMARY KEY (user_id, community_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);

