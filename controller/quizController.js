// controller/quizController.js

exports.getQuizCategories = (req, res, connection) => {
  const sql = 'SELECT * FROM categories';
  connection.query(sql, (err, categories) => {
    if (err) {
      console.error('Error fetching categories:', err);
      return res.status(500).send('Database error');
    }
    res.render('quizCategories', { categories });
  });
};

exports.getQuizSets = (req, res, connection) => {
  const categoryId = req.params.id;

  const categorySql = 'SELECT name FROM categories WHERE id = ?';
  connection.query(categorySql, [categoryId], (err, categoryResults) => {
    if (err) {
      console.error('Error fetching category:', err);
      return res.status(500).send('Database error');
    }

    if (categoryResults.length === 0) {
      return res.status(404).send('Category not found');
    }

    const categoryName = categoryResults[0].name;

    const sql = `
      SELECT DISTINCT set_number 
      FROM quiz_questions 
      WHERE category_id = ?
      ORDER BY set_number;
    `;

    connection.query(sql, [categoryId], (err, sets) => {
      if (err) {
        console.error('Error fetching quiz sets:', err);
        return res.status(500).send('Database error');
      }

      res.render('quizSets', { sets, categoryId, categoryName });
    });
  });
};

exports.getQuizPage = (req, res, connection) => {
  const { categoryId, setNumber } = req.params;

  const sql = `
    SELECT * FROM quiz_questions
    WHERE category_id = ? AND set_number = ?
    ORDER BY id;
  `;

  connection.query(sql, [categoryId, setNumber], (err, questions) => {
    if (err) {
      console.error('Error fetching quiz questions:', err);
      return res.status(500).send('Database error');
    }

    req.session.questions = questions;
    req.session.categoryId = categoryId;
    req.session.setNumber = setNumber;

    res.render('quizPage', { questions, categoryId, setNumber });
  });
};

exports.submitQuiz = (req, res, connection) => {
  const categoryId = Number(req.body.categoryId || 0);
  const setNumber = Number(req.body.setNumber || 0);

  const answers = {};
  for (const key in req.body) {
    if (Object.prototype.hasOwnProperty.call(req.body, key) && key.startsWith('ans_')) {
      const qid = Number(key.slice(4));
      answers[qid] = Number(req.body[key]);
    }
  }

  const sql = `
    SELECT * FROM quiz_questions 
    WHERE category_id = ? AND set_number = ?
    ORDER BY id;
  `;

  connection.query(sql, [categoryId, setNumber], (err, rows) => {
    if (err) return res.status(500).send('Database error');

    let score = 0;
    const reviewed = rows.map(q => {
      const userAns = answers[q.id] || null;
      const correct = Number(q.correct_option);
      if (userAns === correct) score++;

      return {
        id: q.id,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        correct_option: correct,
        userAnswer: userAns,
        explanation: q.explanation || '',
        categoryId
      };
    });

    const total = reviewed.length;

    req.session.lastReview = {
      questions: reviewed,
      score,
      total,
      categoryId
    };

    res.redirect(`/quiz/result?score=${score}&total=${total}`);
  });
};

exports.getResultPage = (req, res, connection) => {
  const { score, total } = req.query;

  const questions = req.session.lastReview?.questions || [];
  const categoryId = req.session.lastReview?.categoryId || null;

  connection.query('SELECT * FROM categories', (err, categories) => {
    if (err) return res.status(500).send('Database error');

    res.render('quizResult', {
      score,
      total,
      categories,
      questions,
      categoryId
    });
  });
};
