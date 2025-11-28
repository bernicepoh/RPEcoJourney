const db = require('../db');
const QRCode = require('qrcode');

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
  const user = req.session.user;

  const categorySql = `SELECT categoryName FROM category WHERE categoryID = ?`;

  db.query(categorySql, [categoryID], (err, categoryResults) => {
    if (err) {
      console.log("CATEGORY SQL ERROR:", err);
      return res.status(500).send('Database error');
    }
    if (categoryResults.length === 0) return res.status(404).send('Category not found');

    const categoryName = categoryResults[0].categoryName;

    const setSql = `
      SELECT 
        setNumber,
        quizTitle AS title,
        cardColor,
        requiredLevel,
        COUNT(*) AS numberOfQuestions
      FROM quiz
      WHERE categoryID = ?
      GROUP BY setNumber, quizTitle, cardColor, requiredLevel
      ORDER BY setNumber ASC
    `;

    db.query(setSql, [categoryID], (err2, sets) => {
      if (err2) {
        console.log("SET SQL ERROR:", err2);   // ⭐ SEE REAL ERROR IN TERMINAL
        return res.status(500).send('Database error');
      }

      res.render("quizSets", {
        user,
        sets,
        categoryID,
        categoryName
      });
    });
  });
};


/* =======================================================
   3) START GAME
======================================================= */
exports.startGame = (req, res) => {
  const { categoryID, setNumber } = req.params;

  // Create guest user if no session
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

  // If Guest → just start quiz
  if (userType === "Guest") {
    return res.redirect(`/quizPage/${categoryID}/${setNumber}`);
  }

  // Ensure user progress row exists
  const initSql = `
    INSERT IGNORE INTO user (userID, totalXP, level, streak, checkInDate)
    VALUES (?, 0, 1, 0, NULL)
  `;

  db.query(initSql, [userID], (err) => {
    if (err) return res.send("Database error (init user progress)");

    // ❗ FIXED: Check if THIS USER already played THIS SET
    const attemptSql = `
      SELECT r.*
      FROM quiz_results r
      JOIN quiz q ON r.quizID = q.quizID
      WHERE r.userID = ?
        AND q.categoryID = ?
        AND q.setNumber = ?
      LIMIT 1
    `;

    db.query(attemptSql, [userID, categoryID, setNumber], (err2, attempts) => {
      if (err2) return res.send("DB error checking attempts");

      // If user already attempted → show result
      if (attempts.length > 0) {
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

          const setXP = xpRows[0].setXP || 0;

          const userSql = `
            SELECT totalXP, level
            FROM user
            WHERE userID = ?
          `;

          db.query(userSql, [userID], (err4, userRows) => {
            const totalXP = userRows[0].totalXP;
            const level = userRows[0].level;
            const progressPercent = Math.min((totalXP % 500) / 500 * 100, 100);

            return res.render("quizResult", {
              alreadyDone: true,
              sessionXP: setXP,
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

      // Otherwise → start quiz normally
      res.redirect(`/quizPage/${categoryID}/${setNumber}`);
    });
  });
};


/* =======================================================
   4) SHOW QUIZ PAGE — FIRST QUESTION
======================================================= */
exports.showQuizPage = (req, res) => {
  const { categoryID, setNumber } = req.params;

  db.query(
    `SELECT * FROM quiz
     WHERE categoryID = ? AND setNumber = ?
     ORDER BY quizID ASC LIMIT 1`,
    [categoryID, setNumber],
    (err, rows) => {
      if (err) return res.send("DB error (showQuizPage)");
      if (!rows.length) return res.send("No questions found");

      const question = rows[0];

      db.query(
        `SELECT COUNT(*) AS totalCount
         FROM quiz 
         WHERE categoryID = ? AND setNumber = ?`,
        [categoryID, setNumber],
        (err2, countRows) => {
          if (err2) return res.send("Error counting questions");

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
            questionIndex: 0,
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

    let xpEarned = isCorrect ? 20 : 0;

    const saveSql = `
      INSERT INTO quiz_results (userID, quizID, timeTaken, xpEarned)
      VALUES (?, ?, ?, ?)
    `;

    db.query(saveSql, [userID, quizID, t, xpEarned]);

    if (req.session.user.userType !== "Guest") {
      db.query(`UPDATE user SET totalXP = totalXP + ? WHERE userID = ?`, [
        xpEarned,
        userID
      ]);
    }

    db.query(
      `SELECT quizID FROM quiz
       WHERE categoryID = ? AND setNumber = ? AND quizID > ?
       ORDER BY quizID ASC LIMIT 1`,
      [categoryID, setNumber, quizID],
      (err3, nextRows) => {
        const nextQuizID = nextRows?.[0]?.quizID || null;

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
              timeLimit: 20,
              questionIndex: Number(questionIndex) + 1,
              nextQuizID
            });
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
      if (!rows.length) {
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
            questionIndex: req.query.index ? Number(req.query.index) : 1,
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

  const xpSql = `
    SELECT SUM(r.xpEarned) AS setXP
    FROM quiz_results r
    JOIN quiz q ON r.quizID = q.quizID
    WHERE r.userID = ? AND q.categoryID = ? AND q.setNumber = ?
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
      if (!userRows.length) {
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

      const totalXP = userRows[0].totalXP;
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

/* =======================================================
   8) CREATE QUIZ (ONE-PAGE FORM)
======================================================= */
exports.createQuiz = (req, res) => {
  const {
    categoryID,
    setNumber,
    title,
    cardColor,
    requiredLevel,
    numberOfQuestions,
    timeLimit
  } = req.body;

  const questions = req.body["question[]"];
  const option1 = req.body["option1[]"];
  const option2 = req.body["option2[]"];
  const option3 = req.body["option3[]"];
  const option4 = req.body["option4[]"];
  const correctOption = req.body["correctOption[]"];
  const explanation = req.body["explanation[]"];

  const sql = `
    INSERT INTO quiz 
    (categoryID, setNumber, question, option1, option2, option3, option4, correctOption, explanation,
     quizTitle, requiredLevel, numberOfQuestion, timeLimit, cardColor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (let i = 0; i < questions.length; i++) {
    db.query(sql, [
      categoryID,
      setNumber,
      questions[i],
      option1[i],
      option2[i],
      option3[i],
      option4[i],
      correctOption[i],
      explanation[i] || "",
      title,
      requiredLevel,
      numberOfQuestions,
      timeLimit,
      cardColor
    ]);
  }

  res.redirect(`/quiz/category/${categoryID}`);
};



/* =======================================================
   QR CODE START PAGE
======================================================= */
exports.showQuizStart = (req, res) => {
  const qrLink = `http://192.168.0.7:3000/quiz-access`;

  QRCode.toDataURL(qrLink, (err, qrImage) => {
    if (err) return res.send("Error generating QR");
    res.render("quiz-start", { qrImage });
  });
};

/* =======================================================
   SHOW ACCESS PAGE
======================================================= */
exports.showQuizAccess = (req, res) => {
  res.render("quiz-access", { guestMode: false });
};

/* =======================================================
   GUEST LOGIN
======================================================= */
exports.startAsGuest = (req, res) => {
  const guestID = "guest_" + Math.floor(Math.random() * 1000000);

  req.session.user = {
    userID: guestID,
    userName: "Guest",
    userType: "Guest"
  };

  req.session.save(() => {
    res.redirect("/guest-welcome");
  });
};

