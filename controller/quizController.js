
// ===== CONTROLLER METHODS =====
const quizController = {

  // 📘 Show all quiz categories
  getAllCategories: (req, res) => {
    const sql = 'SELECT * FROM categories';
    connection.query(sql, (err, categories) => {
      if (err) {
        console.error('Error fetching categories:', err);
        return res.status(500).send('Database error');
      }
      res.render('quizCategories', { categories });
    });
  },

  // 📗 Show all quiz sets for a category
  getSetsByCategory: (req, res) => {
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
  },

  // 📙 Show all questions in a quiz set
  getQuizBySet: (req, res) => {
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
  },

  // 📒 Handle quiz submission
  submitQuiz: (req, res) => {
    const categoryId = Number(req.body.categoryId || 0);
    const setNumber = Number(req.body.setNumber || 0);

    // Collect answers
    const answers = {};
    for (const key in req.body) {
      if (Object.prototype.hasOwnProperty.call(req.body, key) && key.startsWith('ans_')) {
        const qid = Number(key.slice(4));
        answers[qid] = Number(req.body[key]);
      }
    }

    console.log('🧾 Received body:', req.body);

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

      // store review in session
      req.session.lastReview = {
        questions: reviewed,
        score,
        total,
        categoryId
      };

      // redirect to result
      res.redirect(`/quiz/result?score=${score}&total=${total}`);
    });
  },

  // 📕 Show quiz result
  getQuizResult: (req, res) => {
    const { score, total } = req.query;
    const questions = req.session.lastReview?.questions || [];
    const categoryId = req.session.lastReview?.categoryId || null;

    connection.query('SELECT * FROM categories', (err, categories) => {
      if (err) return res.status(500).send('Database error');

      res.render('quizResult', {
        score: Number(score) || 0,
        total: Number(total) || 0,
        categories,
        questions,
        categoryId
      });
    });
  }
};

module.exports = quizController;
