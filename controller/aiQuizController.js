const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const db = require("../db");
const missionController = require("./missionController");

/* ======================================================
   1. GENERATE AI QUIZ
====================================================== */
exports.generateAIQuiz = async (req, res) => {
    const difficulty = req.body.difficulty; 
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
Generate EXACTLY 5 sustainability questions with 4 options. 
The difficulty level is ${difficulty} (1=Easy, 2=Medium, 3=Hard).
Return ONLY valid JSON without markdown.
{
  "questions": [
    {
      "question": "string",
      "pillar": "Environmental",
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
};

/* ======================================================
   2. SAVE QUIZ RESULT
====================================================== */
exports.showQuizResult = (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.redirect("/");
    }

    const score = parseInt(req.query.score) || 0;
    const streakBonus = parseInt(req.query.streakBonus) || 0;
    const perfectBonus = parseInt(req.query.perfectBonus) || 0;
    const difficulty = req.query.difficulty || 1; 
        
    const totalXPEarned = (score * 2) + streakBonus + perfectBonus;
    const now = new Date().toISOString(); // ✅ PostgreSQL-safe timestamp

    const sql = `
        INSERT INTO quiz 
        (userID, question, score, createdAt, XPEarned, difficulty)
        VALUES ($1, $2, $3, $4, $5, $6)
    `;

    const values = [
        user.userID,
        "AI Generated Sustainability Quiz",
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

        const updateXP = `
            UPDATE "user"
            SET totalXP = totalXP + $1
            WHERE userID = $2
        `;

        db.query(updateXP, [totalXPEarned, user.userID], (err) => {
            if (err) {
                console.log("Error updating user XP:", err);
            }

            // ==========================================
            // MISSION TRIGGERS
            // ==========================================
            missionController.completeMission(user.userID, 'Complete 1 AI Quiz');
                    
            if (totalXPEarned >= 30) {
                missionController.completeMission(user.userID, 'Score 30 XP in a Quiz');
            }
                    
            if (perfectBonus > 0) {
                missionController.completeMission(user.userID, 'Get 100% Score');
            }

            if (difficulty == 3 || difficulty == "3") {
                missionController.completeMission(user.userID, 'Play a Hard-difficulty Quiz');
            }

            return res.render("aiQuizResult", {
                user,
                score,
                xpEarned: totalXPEarned,
                streakBonus,
                perfectBonus,
                completedAt: now,
                difficulty 
            });
        });
    });
};

/* ======================================================
   3. AI INSIGHTS & WORD MEANING
====================================================== */
exports.generateInsights = async (req, res) => {
    const { questions, userAnswers } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const overallPrompt = `
You are an eco-education assistant.
Give short, encouraging feedback based on the quiz performance.
Data: ${JSON.stringify({ questions, userAnswers })}
Keep it student-friendly.
`;

    const overallResult = await model.generateContent(overallPrompt);
    const feedback = overallResult.response.text();

    const explanations = [];

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const userAnswer = userAnswers[i];
        const correctAnswer = q.options[q.answerIndex];

        const explainPrompt = `
Explain this sustainability quiz question simply.

Question: ${q.question}
Correct Answer: ${correctAnswer}
User Selected: ${q.options[userAnswer]}

Explain WHY the correct answer is correct in 1–2 short sentences.
Avoid emojis. Keep it clear and educational.
`;

        const explainResult = await model.generateContent(explainPrompt);
        explanations.push(explainResult.response.text().trim());
    }

    res.json({
        feedback,
        explanations
    });
};

exports.getWordMeaning = async (req, res) => {
    const { word } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(`Meaning of "${word}". Short only.`);

    missionController.completeMission(
        req.session.user.userID,
        'Learn a New Eco Word'
    );

    res.json({ meaning: result.response.text() });
};