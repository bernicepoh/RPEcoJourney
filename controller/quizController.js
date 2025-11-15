const db = require('../db');

/* =======================================================
   1) SHOW CATEGORY LIST
======================================================== */
exports.getQuiz = (req, res) => {
  const sql = 'SELECT * FROM category';

  db.query(sql, (err, categories) => {
    if (err) {
      console.error('Error fetching categories:', err);
      return res.status(500).send('Database error');
    }
    res.render('quizCategories', { categories });
  });
};

/* =======================================================
   2) SHOW SETS FOR CATEGORY
======================================================== */
exports.getSetByCategory = (req, res) => {
  const categoryID = req.params.id;

  const categorySql = 'SELECT categoryName FROM category WHERE categoryID = ?';

  db.query(categorySql, [categoryID], (err, categoryResults) => {
    if (err) {
      console.error('Error fetching category:', err);
      return res.status(500).send('Database error');
    }

    if (categoryResults.length === 0) {
      return res.status(404).send('Category not found');
    }

    const categoryName = categoryResults[0].categoryName;

    const setSql = `
      SELECT DISTINCT setNumber 
      FROM quiz
      WHERE categoryID = ?
      ORDER BY setNumber;
    `;

    db.query(setSql, [categoryID], (err, sets) => {
      if (err) {
        console.error('Error fetching quiz sets:', err);
        return res.status(500).send('Database error');
      }

      res.render('quizSets', { sets, categoryID, categoryName });
    });
  });
};

/* =======================================================
   3) START GAME — Prevent Retake
======================================================== */
exports.startGame = (req, res) => {
  const { categoryID, setNumber } = req.params;
  const userID = req.session.user.userID;

  const checkSql = `
    SELECT * FROM quiz_attempts
    WHERE userID = ? AND categoryID = ? AND setNumber = ?
  `;

  db.query(checkSql, [userID, categoryID, setNumber], (err, attempts) => {
    if (err) return res.send("DB error checking attempts");

    /* =====================================================
       ALREADY COMPLETED — Show proper XP + caption + bar
    ====================================================== */
    if (attempts.length > 0) {
      
      // Get TOTAL XP & LEVEL
      const userSql = `
        SELECT xp, level
        FROM user_progress
        WHERE userID = ?
      `;

      db.query(userSql, [userID], (err2, userRows) => {
        if (err2) return res.send("Error retrieving user XP");

        const totalXP = userRows[0].xp;
        const level = userRows[0].level;

        const progressPercent = Math.min((totalXP % 500) / 500 * 100, 100);

        // Get XP earned for THIS quiz set
        const xpSql = `
            SELECT SUM(r.xpEarned) AS setXP
            FROM quiz_results r
            JOIN quiz q ON r.quizID = q.quizID
            WHERE r.userID = ?
              AND q.categoryID = ?
              AND q.setNumber = ?
        `;

        db.query(xpSql, [userID, categoryID, setNumber], (err3, xpRows) => {
          if (err3) return res.send("Error retrieving quiz XP");

          const previousXP = xpRows[0].setXP || 0;

          return res.render("quizResult", {
            alreadyDone: true,
            sessionXP: previousXP,   // XP earned from this quiz set
            totalXP,
            level,
            progressPercent,
            categoryID,
            setNumber
          });
        });
      });

      return; 
    }

    /* =====================================================
       NOT DONE BEFORE — start quiz normally
    ====================================================== */
    const insertSql = `
      INSERT INTO quiz_attempts (userID, categoryID, setNumber)
      VALUES (?, ?, ?)
    `;

    db.query(insertSql, [userID, categoryID, setNumber]);

    const firstQsql = `
      SELECT * FROM quiz
      WHERE categoryID = ? AND setNumber = ?
      ORDER BY quizID ASC
      LIMIT 1
    `;

    db.query(firstQsql, [categoryID, setNumber], (err2, rows) => {
      if (err2) return res.send("Database error (startGame)");

      const question = rows[0];

      const countSql = `
        SELECT COUNT(*) AS totalCount
        FROM quiz
        WHERE categoryID = ? AND setNumber = ?
      `;

      db.query(countSql, [categoryID, setNumber], (err3, countRows) => {
        const totalQuestions = countRows[0].totalCount;

        res.render("quizPage", {
          question,
          feedback: null,
          xpEarned: null,
          timeTaken: null,
          categoryID,
          setNumber,
          totalQuestions,
          userAnswer: null
        });
      });
    });
  });
};

/* =======================================================
   4) SUBMIT ANSWER
======================================================== */
exports.answerGame = (req, res) => {
  const userID = req.session.user.userID;
  const { quizID, answer, timeTaken, categoryID, setNumber } = req.body;

  const sql = `SELECT * FROM quiz WHERE quizID = ?`;

  db.query(sql, [quizID], (err, rows) => {
    if (err) return res.send("DB error (answerGame)");

    const question = rows[0];
    const correct = Number(question.correctOption);
    const userAnswer = Number(answer);
    const isCorrect = userAnswer === correct;

    let xpEarned = 0;
    const MAX_XP = 20;
    const timeLimit = 20;
    const t = Number(timeTaken) || 0;

    if (isCorrect) {
      xpEarned = Math.floor(MAX_XP * Math.max(0, 1 - (t / timeLimit)));
    }

    // Save result
    const saveSql = `
      INSERT INTO quiz_results (userID, quizID, userAnswer, isCorrect, timeTaken, xpEarned)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(saveSql, [userID, quizID, userAnswer, isCorrect ? 1 : 0, t, xpEarned]);

    // Update user XP
    db.query(`UPDATE user_progress SET xp = xp + ? WHERE userID = ?`, [xpEarned, userID]);

    const countSql = `
      SELECT COUNT(*) AS totalCount
      FROM quiz
      WHERE categoryID = ? AND setNumber = ?
    `;

    db.query(countSql, [categoryID, setNumber], (err2, countRows) => {
      const totalQuestions = countRows[0].totalCount;

      res.render("quizPage", {
        question,
        feedback: isCorrect ? "Correct! 🌱" : "Incorrect 😢",
        xpEarned,
        timeTaken: t,
        categoryID,
        setNumber,
        totalQuestions,
        userAnswer
      });
    });
  });
};

/* =======================================================
   5) NEXT QUESTION
======================================================== */
exports.nextGameQuestion = (req, res) => {
  const { currentID, categoryID, setNumber } = req.params;

  const sql = `
    SELECT * FROM quiz
    WHERE quizID > ?
      AND categoryID = ?
      AND setNumber = ?
    ORDER BY quizID ASC
    LIMIT 1
  `;

  db.query(sql, [currentID, categoryID, setNumber], (err, rows) => {
    if (err) return res.send("Database error (nextGameQuestion)");

    if (rows.length === 0) {
      return res.redirect(`/quiz/game/complete/${categoryID}/${setNumber}`);
    }

    const question = rows[0];

    const countSql = `
      SELECT COUNT(*) AS totalCount
      FROM quiz
      WHERE categoryID = ? AND setNumber = ?
    `;

    db.query(countSql, [categoryID, setNumber], (err2, countRows) => {
      const totalQuestions = countRows[0].totalCount;

      res.render("quizPage", {
        question,
        feedback: null,
        xpEarned: null,
        timeTaken: null,
        categoryID,
        setNumber,
        totalQuestions,
        userAnswer: null
      });
    });
  });
};

/* =======================================================
   6) COMPLETE PAGE
======================================================== */
exports.completeGame = (req, res) => {
  const userID = req.session.user.userID;
  const { categoryID, setNumber } = req.params;

  const xpSql = `
      SELECT SUM(r.xpEarned) AS setXP
      FROM quiz_results r
      JOIN quiz q ON r.quizID = q.quizID
      WHERE r.userID = ?
        AND q.categoryID = ?
        AND q.setNumber = ?
  `;

  db.query(xpSql, [userID, categoryID, setNumber], (err, xpRows) => {
    if (err) return res.send("Error calculating XP");

    const setXP = xpRows[0].setXP || 0;

    const userSql = `
        SELECT xp, level
        FROM user_progress
        WHERE userID = ?
    `;

    db.query(userSql, [userID], (err2, userRows) => {
      if (err2) return res.send("Error retrieving user XP");

      const totalXP = userRows[0].xp;
      const level = userRows[0].level;

      const progressPercent = Math.min((totalXP % 500) / 500 * 100, 100);

      res.render("quizResult", {
        alreadyDone: false,
        sessionXP: setXP,
        totalXP,
        level,
        progressPercent,
        categoryID,
        setNumber
      });
    });
  });
};






