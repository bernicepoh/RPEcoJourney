const db = require('../db');

exports.getQuiz = (req, res) => {
  const user = req.session.user 
  const sql = 'SELECT * FROM category';
  db.query(sql, (err, categories) => {
    if (err) {
      console.error('Error fetching categories:', err);
      return res.status(500).send('Database error');
    }
    res.render('quizCategories', { user, categories });
  });
};

exports.getSetByCategory = (req, res) => {
  const categoryID = req.params.id;
  const user = req.session.user 

  // Fetch category name (to show on quizSets.ejs)
  const categorySql = 'SELECT categoryName FROM category WHERE categoryID = ?';
  db.query(categorySql, [categoryID], (err, categoryResults) => {
    if (err) {
      console.error('Error fetching category:', err);
      return res.status(500).send('Database error');
    }

    if (categoryResults.length === 0) {
      return res.status(404).send('Category not found');
    }

    const categoryName = categoryResults[0].name;

    // Get all unique quiz sets for this category
    const sql = `
      SELECT DISTINCT setNumber 
      FROM quiz
      WHERE categoryID = ?
      ORDER BY setNumber;
    `;

    db.query(sql, [categoryID], (err, sets) => {
      if (err) {
        console.error('Error fetching quiz sets:', err);
        return res.status(500).send('Database error');
      }

      res.render('quizSets', { user, sets, categoryID, categoryName });
    });
  });
};

exports.getQuestionBySets = (req, res) => {
  const { categoryID, setNumber } = req.params;

  const user = req.session.user 

  const sql = `
    SELECT * FROM quiz
    WHERE categoryID = ? AND setNumber = ?
    ORDER BY quizID;
  `;

  db.query(sql, [categoryID, setNumber], (err, questions) => {
    if (err) {
      console.error('Error fetching quiz questions:', err);
      return res.status(500).send('Database error');
    }

    req.session.questions = questions;
    req.session.categoryID = categoryID;
    req.session.setNumber = setNumber;

    res.render('quizPage', { user, questions, categoryID, setNumber });
  });
};

exports.postQuiz = (req, res) => {
  const categoryID = Number(req.body.categoryID || 0);
  const setNumber = Number(req.body.setNumber || 0);

  // 🟢 Extract answers from form
  const answers = {};
  for (const key in req.body) {
    if (Object.prototype.hasOwnProperty.call(req.body, key) && key.startsWith('ans_')) {
      const qid = Number(key.slice(4));
      answers[qid] = Number(req.body[key]);
    }
  }

  console.log('🧾 Received body:', req.body); // Debug line (optional)

  const sql = `
    SELECT * FROM quiz
    WHERE categoryID = ? AND setNumber = ? 
    ORDER BY quizID;
  `;

  db.query(sql, [categoryID, setNumber], (err, rows) => {
    if (err) return res.status(500).send('Database error');

    let score = 0;
    const reviewed = rows.map(q => {
      const userAns = answers[q.quizID] || null;
      const correct = Number(q.correctOption);
      if (userAns === correct) score++;

      return {
        id: q.quizID,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        correctOption: correct,
        userAnswer: userAns,
        explanation: q.explanation || '',
        categoryID
      };
    });

    const total = reviewed.length;

    req.session.lastReview = {
      questions: reviewed,
      score,
      total,
      categoryID
    };

    res.redirect(`/quiz/result?score=${score}&total=${total}`);
  });
};

exports.getQuizResult = (req, res) => {
  const { score, total } = req.query;

  const questions = req.session.lastReview?.questions || [];
  const categoryID = req.session.lastReview?.categoryID || null;
  const user = req.session.user 

  db.query('SELECT * FROM category', (err, categories) => {
    if (err) return res.status(500).send('Database error');

    res.render('quizResult', {
  score: Number(score) || 0,
  total: Number(total) || 0,
  categories,
  questions,
  categoryID,
  user
});

  });
};