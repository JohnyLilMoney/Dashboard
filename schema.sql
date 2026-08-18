PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    ip TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS backgrounds (
    bg_name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS user_backgrounds (
    user_ip TEXT,
    background_name TEXT,
    score INT NOT NULL DEFAULT 5,
    PRIMARY KEY (user_ip, background_name),
    FOREIGN KEY (user_ip) REFERENCES users (ip) ON DELETE CASCADE,
    FOREIGN KEY (background_name) REFERENCES backgrounds (bg_name) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TRIGGER IF NOT EXISTS auto_connect_new_user
AFTER INSERT ON users
BEGIN
    INSERT INTO user_backgrounds (user_ip, background_name, score)
    SELECT NEW.ip, backgrounds.bg_name, 5
    FROM backgrounds;
END;

CREATE TRIGGER IF NOT EXISTS auto_connect_new_background
AFTER INSERT ON backgrounds
BEGIN
    INSERT INTO user_backgrounds (user_ip, background_name, score)
    SELECT users.ip, NEW.bg_name, 5
    FROM users;
END;

