-- Create content_request table for approval workflow
-- Run this SQL in your MySQL database

CREATE TABLE IF NOT EXISTS content_request (
    contentRequestID INT AUTO_INCREMENT PRIMARY KEY,
    contentID INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (contentID) REFERENCES content(contentID) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
