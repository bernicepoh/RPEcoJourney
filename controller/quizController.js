const db = require('../db');

/* =======================================================
   1) SHOW CATEGORY LIST
======================================================= */
exports.getQuiz = (req, res) => {
  const sql = 'SELECT * FROM category';
  db.query(sql, (err, categories) => {
    if (err) return res.status(500).send('Database error');
    res.render('quizCategories', { categories });
  });
};

/* =======================================================
   2) SHOW SETS FOR CATEGORY
======================================================= */
exports.getSetByCategory = (req, res) => {
  const categoryID = req.params.id;

  db.query(
    `SELECT categoryName FROM category WHERE categoryID = ?`,
    [categoryID],
    (err, categoryResults) => {
      if (err) return res.status(500).send('Database error');
      if (categoryResults.length === 0)
        return res.status(404).send('Category not found');

      const categoryName = categoryResults[0].categoryName;

      db.query(
        `SELECT setNumber, title, cardColor
         FROM quiz_info
         WHERE categoryID = ?
         ORDER BY setNumber ASC`,
        [categoryID],
        (err2, sets) => {
          if (err2) return res.status(500).send("Database error retrieving sets");

          res.render('quizSets', { sets, categoryID, categoryName });
        }
      );
    }
  );
};

/* =======================================================
   3) START GAME 
======================================================= */
exports.startGame = (req, res) => {
  const { categoryID, setNumber } = req.params;

  if (!req.session.user) {
    const guestID = "guest_" + Math.floor(Math.random() * 1000000);
    req.session.user = {
      userID: guestID,
      userName: "Guest",
      userType: "Guest",
    };
  }

  res.redirect(`/quizPage/${categoryID}/${setNumber}`);
};

/* =======================================================
   4) SHOW FIRST QUESTION
======================================================= */
exports.showQuizPage = (req, res) => {
  const { categoryID, setNumber } = req.params;

  db.query(
    `SELECT * FROM quiz
     WHERE categoryID = ? AND setNumber = ?
     ORDER BY quizID ASC`,
    [categoryID, setNumber],
    (err, rows) => {
      if (err) return res.send("DB error loading first question");
      if (rows.length === 0) return res.send("No questions found");

      const question = rows[0];

      db.query(
        `SELECT COUNT(*) AS totalCount
         FROM quiz 
         WHERE categoryID = ? AND setNumber = ?`,
        [categoryID, setNumber],
        (err2, countRows) => {
          const totalQuestions = countRows[0].totalCount;

          res.render("quizPage", {
            question,
            feedback: null,
            xpEarned: null,
            timeTaken: null,
            categoryID,
            setNumber,
            totalQuestions,
            userAnswer: null,
            timeLimit: 20,
            questionIndex: 0,      // ⭐ ALWAYS START AT 0
            nextQuizID: question.quizID
          });
        }
      );
    }
  );
};

/* =======================================================
   5) SUBMIT ANSWER
======================================================= */
exports.answerGame = (req, res) => {
  const userID = req.session.user.userID;
  const { quizID, answer, timeTaken, categoryID, setNumber, questionIndex } = req.body;

  db.query("SELECT * FROM quiz WHERE quizID = ?", [quizID], (err, rows) => {
    if (err) return res.send("DB error (answerGame)");

    const question = rows[0];
    const userAnswer = Number(answer);
    const correct = Number(question.correctOption);
    const isCorrect = userAnswer === correct;
    const t = Number(timeTaken) || 0;

    let xpEarned = 0;
    const MAX_XP = 20;

    db.query(
      "SELECT timeLimit FROM quiz_info WHERE categoryID = ? AND setNumber = ?",
      [categoryID, setNumber],
      (err2, infoRows) => {
        const timeLimit = infoRows?.[0]?.timeLimit || 20;

        if (isCorrect) {
          xpEarned = Math.floor(MAX_XP * Math.max(0, 1 - t / timeLimit));
        }

        // Store result
        db.query(
          `INSERT INTO quiz_results 
           (userID, quizID, userAnswer, isCorrect, timeTaken, xpEarned)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userID, quizID, userAnswer, isCorrect ? 1 : 0, t, xpEarned]
        );

        // Find next question
        db.query(
          `SELECT quizID FROM quiz
           WHERE categoryID = ? AND setNumber = ? AND quizID > ?
           ORDER BY quizID ASC LIMIT 1`,
          [categoryID, setNumber, quizID],
          (err3, nextRows) => {
            const nextQuizID = nextRows?.[0]?.quizID || null;

            // Count total questions
            db.query(
              `SELECT COUNT(*) AS totalCount FROM quiz 
               WHERE categoryID = ? AND setNumber = ?`,
              [categoryID, setNumber],
              (err4, countRows) => {
                const totalQuestions = countRows[0].totalCount;

                res.render("quizPage", {
                  question,
                  feedback: isCorrect ? "Correct! 🌱" : "Incorrect 😢",
                  xpEarned,
                  timeTaken: t,
                  categoryID,
                  setNumber,
                  totalQuestions,
                  userAnswer,
                  timeLimit,
                  questionIndex: Number(questionIndex),   // ⭐ KEEP SAME INDEX HERE
                  nextQuizID
                });
              }
            );
          }
        );
      }
    );
  });
};

/* =======================================================
   6) NEXT QUESTION
======================================================= */
exports.nextGameQuestion = (req, res) => {
  const { currentID, categoryID, setNumber } = req.params;

  db.query(
    `SELECT * FROM quiz
     WHERE quizID > ? AND categoryID = ? AND setNumber = ?
     ORDER BY quizID ASC LIMIT 1`,
    [currentID, categoryID, setNumber],
    (err, rows) => {

      if (rows.length === 0) {
        return res.redirect(`/quiz/game/complete/${categoryID}/${setNumber}`);
      }

      const question = rows[0];

      db.query(
        `SELECT COUNT(*) AS totalCount FROM quiz
         WHERE categoryID = ? AND setNumber = ?`,
        [categoryID, setNumber],
        (err2, countRows) => {

          res.render("quizPage", {
            question,
            feedback: null,
            xpEarned: null,
            timeTaken: null,
            categoryID,
            setNumber,
            totalQuestions: countRows[0].totalCount,
            userAnswer: null,
            timeLimit: 20,
            questionIndex: 0, 
            nextQuizID: question.quizID
          });
        }
      );
    }
  );
};

/* =======================================================
   7) COMPLETE QUIZ
======================================================= */
exports.completeGame = (req, res) => {
  const userID = req.session.user.userID;
  const { categoryID, setNumber } = req.params;

  db.query(
    `SELECT SUM(r.xpEarned) AS setXP
     FROM quiz_results r
     JOIN quiz q ON r.quizID = q.quizID
     WHERE r.userID = ? AND q.categoryID = ? AND q.setNumber = ?`,
    [userID, categoryID, setNumber],
    (err, xpRows) => {
      if (err) return res.send("Error calculating XP");

      const setXP = xpRows?.[0]?.setXP || 0;

      res.render("quizResult", {
        alreadyDone: false,
        sessionXP: setXP,
        totalXP: setXP,
        level: 1,
        progressPercent: (setXP % 500) / 5,
        categoryID,
        setNumber
      });
    }
  );
};


/* =======================================================
   8) CREATE QUIZ 
======================================================= */
exports.createQuizOnePage = (req, res) => {

  console.log("REQ BODY:", req.body);

  const {
    categoryID,
    setNumber,
    title,
    cardColor,
    requiredLevel,
    questions,       // single question string
    option1,
    option2,
    option3,
    option4,
    correctOption
  } = req.body;

  // Validate question text
  if (!questions || questions.trim() === "") {
    return res.send("Please enter a question");
  }

  // ===============================
  // 1) INSERT INTO quiz_info TABLE
  // ===============================
  const infoSql = `
    INSERT INTO quiz_info 
    (categoryID, title, cardColor, requiredLevel, numberOfQuestions)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    infoSql,
    [categoryID, setNumber, title, cardColor, requiredLevel, 1],   // 👈 numberOfQuestions = 1
    (err, infoResult) => {
      if (err) {
        console.log("QUIZ_INFO SQL ERROR:", err);
        return res.send("Error saving quiz info");
      }

      // ===============================
      // 2) INSERT QUESTION INTO quiz TABLE
      // ===============================

      const quizSql = `
        INSERT INTO quiz 
        (categoryID, setNumber, question, option1, option2, option3, option4, correctOption)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        quizSql,
        [
          categoryID,
          setNumber,
          questions,       // question text
          option1,
          option2,
          option3,
          option4,
          correctOption
        ],
        (err2) => {
          if (err2) {
            console.log("QUIZ SQL ERROR:", err2);
            return res.send("Error saving quiz question");
          }

          // Redirect after success
          res.redirect(`/quiz/category/${categoryID}`);
        }
      );
    }
  );
};










