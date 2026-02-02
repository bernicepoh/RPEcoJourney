-- Add missing columns and fix your existing content_request table
-- Run this SQL in your MySQL database

-- Add primary key auto-increment
ALTER TABLE content_request 
MODIFY COLUMN contentRequestID INT AUTO_INCREMENT PRIMARY KEY;

-- Add timestamps
ALTER TABLE content_request 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add indexes for better performance
ALTER TABLE content_request 
ADD INDEX idx_status (status),
ADD INDEX idx_created_at (created_at);

-- Optional: Add foreign key if not exists (might fail if constraint already exists, that's OK)
ALTER TABLE content_request 
ADD CONSTRAINT fk_content_request_content 
FOREIGN KEY (contentID) REFERENCES content(contentID) ON DELETE CASCADE;
