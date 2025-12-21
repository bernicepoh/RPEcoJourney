const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const db = require("../db");

/* ======================================================
   1. GENERATE AI QUIZ
====================================================== */
exports.generateAIQuiz = async (req, res) => {
    try {
        // Pillar is removed; difficulty comes from the form (1, 2, or 3)
        const difficulty = req.body.difficulty;

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash" // Adjusted to current stable version
        });

        const prompt = `
Generate EXACTLY 5 sustainability questions with 4 options. 
The difficulty level is ${difficulty} (1=Easy, 2=Medium, 3=Hard).
Return ONLY valid JSON without markdown.

{
  "questions": [
    {
      "question": "string",
      "pillar": "Environmental/Social/Governance",
      "options": ["A","B","C","D"],
      "answerIndex": 0
    }
  ]
}
        `;

        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json|```/g, "").trim();

        const quiz = JSON.parse(text);

        res.render("aiQuiz", {
            quiz,
            difficulty,
            user: req.session.user
        });

    } catch (err) {
        console.log("AI QUIZ ERROR:", err);
        res.status(500).send("Failed to generate quiz.");
    }
};


/* ======================================================
   2. SAVE QUIZ RESULT (Updated for your specific MySQL schema)
====================================================== */
exports.showQuizResult = (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect("/");

    const score = parseInt(req.query.score) || 0;
    const difficulty = parseInt(req.query.difficulty) || 1;
    const streakBonus = parseInt(req.query.streakBonus) || 0;
    const perfectBonus = parseInt(req.query.perfectBonus) || 0;

    // Total XP for this session
    const totalXPEarned = (score * 2) + streakBonus + perfectBonus;
    
    // Formatting date for MySQL DATETIME
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Match your 'quiz' table columns: userID, question, score, createdAt, XPEarned, difficulty
    // Note: 'question' is required in your schema, so we store a summary or placeholder
    const sql = `INSERT INTO quiz (userID, question, score, createdAt, XPEarned, difficulty) 
                 VALUES (?, ?, ?, ?, ?, ?)`;

    const values = [
        user.userID, 
        "AI Generated Sustainability Quiz", // placeholder for the 'question' column
        score, 
        now, 
        totalXPEarned, 
        difficulty
    ];

    db.query(sql, values, (err) => {
        if (err) {
            console.log("❌ Error saving quiz result:", err);
            return res.status(500).send("Server error saving results");
        }

        // Optional: Update the user's totalXP in the 'user' table
        const updateXP = "UPDATE user SET totalXP = totalXP + ? WHERE userID = ?";
        db.query(updateXP, [totalXPEarned, user.userID]);

        res.render("aiQuizResult", {
            user,
            score,
            xpEarned: totalXPEarned,
            streakBonus,
            perfectBonus,
            completedAt: now
        });
    });
};

/* ======================================================
   3. AI INSIGHTS & WORD MEANING (Logic remains same)
====================================================== */
exports.generateInsights = async (req, res) => {
    try {
        const { questions, userAnswers } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const overallPrompt = `Analyze performance: ${JSON.stringify({ questions, userAnswers })}. Provide 1 weakness and 2 tips.`;
        const overallResult = await model.generateContent(overallPrompt);
        const feedback = overallResult.response.text();

        const explanations = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const explanationPrompt = `Question: ${q.question}. Correct Answer: ${q.options[q.answerIndex]}. User Answer: ${q.options[userAnswers[i]] || "None"}. Explain why the correct one is right in 2 sentences.`;
            const expResult = await model.generateContent(explanationPrompt);
            explanations.push(expResult.response.text().trim());
        }

        res.json({ feedback, explanations });
    } catch (err) {
        res.json({ feedback: "AI failed to generate insights 😢", explanations: [] });
    }
};

exports.getWordMeaning = async (req, res) => {
    try {
        const { word } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Meaning of "${word}". Short only.`);
        return res.json({ meaning: result.response.text() });
    } catch (err) {
        return res.json({ meaning: "Not available." });
    }
};






