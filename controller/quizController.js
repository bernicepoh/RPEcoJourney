const db = require('../db');
const QRCode = require('qrcode');

/* =======================================================
   1) SHOW CATEGORY LIST
======================================================== */
exports.getQuiz = (req, res) => {
  const user = req.session.user 
  const sql = 'SELECT * FROM category';

  db.query(sql, (err, categories) => {
    if (err) return res.status(500).send('Database error');
    res.render('quizCategories', { categories });
  });
};

/* =======================================================
   2) SHOW SETS FOR CATEGORY
======================================================== */
exports.getSetByCategory = (req, res) => {
  const categoryID = req.params.id;
  const user = req.session.user 

  const categorySql = 'SELECT categoryName FROM category WHERE categoryID = ?';

  db.query(categorySql, [categoryID], (err, categoryResults) => {
    if (err) return res.status(500).send('Database error');
    if (categoryResults.length === 0) return res.status(404).send('Category not found');

    const categoryName = categoryResults[0].categoryName;

    const setSql = `
      SELECT DISTINCT setNumber 
      FROM quiz
      WHERE categoryID = ?
      ORDER BY setNumber
    `;

    db.query(setSql, [categoryID], (err, sets) => {
      if (err) return res.status(500).send('Database error');

      res.render('quizSets', { user, sets, categoryID, categoryName });
    });
  });
};

/* =======================================================
   3) START GAME — Prevent Retake + Guest Mode
======================================================== */
exports.startGame = (req, res) => {
  const { categoryID, setNumber } = req.params;

  // SAFETY — If missing session → create guest
  if (!req.session.user) {
    const guestID = "guest_" + Math.floor(Math.random() * 1000000);

    req.session.user = {
      userID: guestID,
      userName: "Guest",
      userType: "Guest"
    };
  }

  const userID = req.session.user.userID;
  const userType = req.session.user.userType;

  // 1) GUEST MODE (NO RETAKE CHECK)
  if (userType === "Guest") {
    return res.redirect(`/quizPage/${categoryID}/${setNumber}`);
  }

  // 2) REAL USERS — Ensure progress row exists
  const initSql = `
    INSERT IGNORE INTO user (userID, totalXP, level, streak, checkInDate)
    VALUES (?, 0, 1, 0, NULL)
  `;

  db.query(initSql, [userID], (errInit) => {
    if (errInit) return res.send("Database error (init user progress)");

    const checkSql = `
      SELECT * FROM quiz
      WHERE categoryID = ? AND setNumber = ?
    `;

    db.query(checkSql, [categoryID, setNumber], (err, attempts) => {
      if (err) return res.send("DB error checking attempts");

      // Already completed → show results
      if (attempts.length > 0) {
        const userSql = `
          SELECT totalXP, level
          FROM user
          WHERE userID = ?
        `;

        db.query(userSql, [userID], (err2, userRows) => {
          if (err2) return res.send("Error retrieving user XP");

          const totalXP = userRows[0].xp;
          const level = userRows[0].level;
          const progressPercent = Math.min((totalXP % 500) / 500 * 100, 100);

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
              sessionXP: previousXP,
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

      // FIRST ATTEMPT → start quiz
      res.redirect(`/quizPage/${categoryID}/${setNumber}`);
    });
  });
};

/* =======================================================
   4) SHOW QUIZ PAGE — First Question
    SELECT * FROM quiz
    WHERE categoryID = ?
      AND setNumber = ?
    ORDER BY quizID ASC
    LIMIT 1
  `;

  db.query(firstQsql, [categoryID, setNumber], (err, rows) => {
    if (err) return res.send("DB error loading first question");
    if (rows.length === 0) return res.send("No questions found");

    const question = rows[0];

    const countSql = `
      SELECT COUNT(*) AS totalCount
      FROM quiz
      WHERE categoryID = ? AND setNumber = ?
    `;

    db.query(countSql, [categoryID, setNumber], (err2, countRows) => {
      if (err2) return res.send("DB error counting questions");

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
   5) SUBMIT ANSWER
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

    // Save answer
    const saveSql = `
      INSERT INTO quiz_results (userID, quizID, timeTaken, xpEarned)
      VALUES (?, ?, ?, ?)
    `;
    db.query(saveSql, [
      userID,
      quizID,
      t,
      xpEarned
    ]);

    // Only REAL users get XP
    if (req.session.user.userType !== "Guest") {
      db.query(`UPDATE user SET totalXP = totalXP + ? WHERE userID = ?`, [
        xpEarned,
        userID
      ]);
    }

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
   6) NEXT QUESTION
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
    if (err) return res.send("DB error");

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
   7) COMPLETE QUIZ
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
        SELECT totalXP, level
        FROM user
        WHERE userID = ?
    `;

    db.query(userSql, [userID], (err2, userRows) => {
      if (err2) return res.send("Error retrieving user XP");

      /* ======================================================
         ⭐ GUEST MODE — No row found in user_progress
      ====================================================== */
      if (!userRows || userRows.length === 0) {
        return res.render("quizResult", {
          alreadyDone: false,
          sessionXP: setXP,
          totalXP: 0,
          level: 1,
          progressPercent: 0,
          categoryID,
          setNumber
        });
      }

      /* ======================================================
         ⭐ REAL USER — Row exists
      ====================================================== */
      const totalXP = userRows[0].xp || 0;
      const level = userRows[0].level || 1;
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

exports.showQuizStart = (req, res) => {
    const qrLink = `http://192.168.0.7:3000/quiz-access`;

    QRCode.toDataURL(qrLink, (err, qrImage) => {
        if (err) return res.send("Error generating QR");

        res.render("quiz-start", { qrImage });
    });
};

exports.showQuizAccess = (req, res) => {
    res.render("quiz-access", { guestMode: false });
};

// Start as guest (create guest session)
exports.startAsGuest = (req, res) => {
    const guestID = "guest_" + Math.floor(Math.random() * 1000000);

    req.session.user = {
        userID: guestID,
        userName: "Guest",
        userType: "Guest"
    };

    // MUST save session before redirect
    req.session.save(() => {
        res.redirect("/guest-welcome");
    });
};