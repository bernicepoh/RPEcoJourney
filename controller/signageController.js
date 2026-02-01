const db = require('../db'); // Your existing connection to rpecojourney

const signageController = {
    // 1. Get the Editor and load your EXISTING project content
    getEditor: (req, res) => {
        // CHANGED FROM 'contents' TO 'content'
        const sql = "SELECT * FROM content"; 
        db.query(sql, (err, results) => {
            if (err) {
                console.error("❌ SQL Error in getEditor:", err);
                return res.status(500).send("Database Error");
            }
            // Pass the sustainability posts to your editor
            res.render('editor', { projectContents: results });
        });
    },

    // 2. Save the "PPT" design to the database
    saveLayout: (req, res) => {
        // 1. Extract the new scheduling fields from the request body
        const { 
            screen_id, 
            layout_data, 
            layout_name, 
            start_time, 
            end_time 
        } = req.body;

        console.log("--- SERVER ATTEMPTING SCHEDULED SAVE ---");
        console.log(`Screen: ${screen_id} | Layout: ${layout_name} [${start_time} - ${end_time}]`);

        // 2. Updated SQL: We now include the 3 new columns.
        // We use INSERT because one screen can now have multiple timed layouts.
        const sql = `
            INSERT INTO screen_layouts 
            (screen_id, layout_json, layout_name, start_time, end_time) 
            VALUES (?, ?, ?, ?, ?)
        `;

        const params = [
            screen_id, 
            layout_data, 
            layout_name || 'Untitled Layout', 
            start_time || '00:00:00', 
            end_time || '23:59:59'
        ];

        db.query(sql, params, (err, result) => {
            if (err) {
                console.error("❌ DATABASE ERROR:", err.message);
                return res.status(500).json({ error: err.message });
            }
            console.log("✅ SCHEDULE SAVED SUCCESSFULLY");
            return res.status(200).json({ status: "ok", message: "Schedule created" });
        });
    },

    // 3. API for the Raspberry Pi to fetch its content
    getScreenContent: (req, res) => {
        const screenId = req.params.id;

        // The SQL logic:
        // 1. CURTIME() gets the current time on the server (e.g., 13:21:00)
        // 2. BETWEEN checks if the current time fits the schedule
        // 3. ORDER BY ensures we get the latest saved version first
        const sql = `
            SELECT layout_json 
            FROM screen_layouts 
            WHERE screen_id = ? 
            AND is_active = 1 
            AND CURTIME() BETWEEN start_time AND end_time 
            ORDER BY updated_at DESC 
            LIMIT 1
        `;

        db.query(sql, [screenId], (err, results) => {
            if (err) {
                console.error("❌ FETCH ERROR:", err.message);
                return res.status(500).json({ error: "Database error" });
            }

            if (results.length === 0) {
                console.log(`⚠️ No active schedule for Screen ${screenId} at this time.`);
                return res.status(404).json({ error: "No active schedule found for the current time." });
            }

            // Successfully found a layout for this time slot!
            console.log(`✅ Sending active layout for Screen ${screenId}`);
            res.json(JSON.parse(results[0].layout_json));
        });
    },

    // 4. Render the actual display page for the TV
    getDisplay: (req, res) => {
        const screenId = req.params.id;
        // This renders views/display.ejs and tells it which screen ID it is
        res.render('display', { screenId: screenId });
    }
};

module.exports = signageController;