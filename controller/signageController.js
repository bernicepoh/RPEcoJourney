const db = require('../db'); 

const signageController = {
    getEditor: (req, res) => {
        // CHANGED FROM 'contents' TO 'content' - Only show approved content
        const sql = "SELECT * FROM content WHERE status = 'Approved'"; 
        db.query(sql, (err, results) => {
            if (err) {
                console.error("❌ SQL Error in getEditor:", err);
                return res.status(500).send("Database Error");
            }
            res.render('editor', { projectContents: results });
        });
    },

    saveLayout: (req, res) => {
        const { 
            screen_id, 
            layout_data, 
            layout_name, 
            start_time, 
            end_time 
        } = req.body;

        console.log("--- SERVER ATTEMPTING SCHEDULED SAVE ---");
        console.log(`Screen: ${screen_id} | Layout: ${layout_name} [${start_time} - ${end_time}]`);

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

    getScreenContent: (req, res) => {
        const screenId = req.params.id;

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

            console.log(`✅ Sending active layout for Screen ${screenId}`);
            res.json(JSON.parse(results[0].layout_json));
        });
    },

    getDisplay: (req, res) => {
        const screenId = req.params.id;
        res.render('display', { screenId: screenId });
    }
};

module.exports = signageController;